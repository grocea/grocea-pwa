import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, fetchState, importLocalState, sendMutation } from '../api/client'
import type {
  ActivityEvent,
  DraftRecipe,
  GroceaState,
  ImportConflict,
  Ingredient,
  PendingMutation,
  PublishedRecipe,
  StockOperation,
  SyncStatus,
} from '../domain/types'
import { isPublishedRecipe } from '../domain/types'
import { familyUnits, formatQuantityValue, parseQuantity } from '../shared/lib/quantity'
import { GroceaContext, type GroceaContextValue, type StorageStatus } from './grocea-context'
import { groceaStorage, type GroceaStorage } from './persistence'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'

type Action =
  | { type: 'stock'; eventId: string; ingredientId: string; operation: StockOperation; amount: bigint; reason: string }
  | { type: 'ingredient'; ingredient: Ingredient; createStock: boolean }
  | { type: 'recipe-create'; recipe: DraftRecipe }
  | {
    type: 'recipe-update'
    id: string
    patch: Partial<Pick<DraftRecipe, 'name' | 'description' | 'baseServings' | 'ingredients' | 'steps'>>
    updatedAt: string
  }
  | { type: 'recipe-delete'; id: string }
  | { type: 'recipe-publish'; recipe: PublishedRecipe }
  | { type: 'cook'; event: ActivityEvent }
  | { type: 'reverse'; eventId: string; reversal: ActivityEvent }
  | { type: 'category'; id: string; name: string }
  | { type: 'profile'; displayName: string; preferredServings: number }

function reducer(state: GroceaState, action: Action): GroceaState {
  if (action.type === 'ingredient') {
    return {
      ...state,
      ingredients: [...state.ingredients, action.ingredient],
      balances: action.createStock ? { ...state.balances, [action.ingredient.id]: 0n } : state.balances,
    }
  }
  if (action.type === 'recipe-create') {
    return state.recipes.some(recipe => recipe.id === action.recipe.id)
      ? state
      : { ...state, recipes: [...state.recipes, action.recipe] }
  }
  if (action.type === 'recipe-update') {
    return {
      ...state,
      recipes: state.recipes.map(recipe => recipe.id === action.id && recipe.status === 'draft'
        ? { ...recipe, ...action.patch, updatedAt: action.updatedAt }
        : recipe),
    }
  }
  if (action.type === 'recipe-delete') {
    return { ...state, recipes: state.recipes.filter(recipe => !(recipe.id === action.id && recipe.status === 'draft')) }
  }
  if (action.type === 'recipe-publish') {
    return { ...state, recipes: state.recipes.map(recipe => recipe.id === action.recipe.id ? action.recipe : recipe) }
  }
  if (action.type === 'category') {
    return { ...state, categories: [...state.categories, { id: action.id, name: action.name, scope: 'custom' }] }
  }
  if (action.type === 'profile') {
    return {
      ...state,
      profile: {
        ...state.profile,
        displayName: action.displayName,
        preferredServings: action.preferredServings,
      },
    }
  }
  if (action.type === 'stock') {
    const current = state.balances[action.ingredientId] ?? 0n
    const next = action.operation === 'set'
      ? action.amount
      : action.operation === 'add'
        ? current + action.amount
        : current - action.amount
    const ingredient = state.ingredients.find(item => item.id === action.ingredientId)
    const verb = action.operation === 'set' ? 'Set' : action.operation === 'add' ? 'Added' : 'Removed'
    const event: ActivityEvent = {
      id: action.eventId,
      type: 'manual',
      title: `${verb} ${ingredient?.name ?? 'ingredient'}`,
      detail: action.reason || 'Manual adjustment',
      occurredAt: new Date().toISOString(),
      changes: [{
        ingredientId: action.ingredientId,
        before: current,
        delta: next - current,
        after: next,
      }],
    }
    return {
      ...state,
      balances: { ...state.balances, [action.ingredientId]: next },
      activity: [event, ...state.activity],
    }
  }
  if (action.type === 'cook') {
    const balances = { ...state.balances }
    action.event.changes.forEach(change => { balances[change.ingredientId] = change.after })
    return { ...state, balances, activity: [action.event, ...state.activity] }
  }
  const original = state.activity.find(event => event.id === action.eventId)
  if (!original || original.reversedAt) return state
  const balances = { ...state.balances }
  action.reversal.changes.forEach(change => { balances[change.ingredientId] = change.after })
  return {
    ...state,
    balances,
    activity: [
      action.reversal,
      ...state.activity.map(event => event.id === action.eventId
        ? { ...event, reversedAt: action.reversal.occurredAt }
        : event),
    ],
  }
}

interface MutationDraft {
  type: string
  payload: unknown
  dependsOn?: string[]
}

interface Transition<T> {
  state: GroceaState
  result: T
  mutation?: MutationDraft
}

export function GroceaProvider({ children, storage = groceaStorage }: { children: ReactNode; storage?: GroceaStorage }) {
  const [state, setState] = useState<GroceaState | null>(null)
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('loading')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [pendingMutationCount, setPendingMutationCount] = useState(0)
  const [syncIssues, setSyncIssues] = useState<PendingMutation[]>([])
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([])
  const [resetRequested, setResetRequested] = useState(false)
  const stateRef = useRef<GroceaState | null>(null)
  const statusRef = useRef<StorageStatus>('loading')
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const syncingRef = useRef(false)
  const deviceIdRef = useRef<string>(crypto.randomUUID())
  const retryTimerRef = useRef<number | null>(null)

  const updateStorageStatus = useCallback((next: StorageStatus, error: string | null = null) => {
    statusRef.current = next
    setStorageStatus(next)
    setStorageError(error)
  }, [])

  const refreshQueueStatus = useCallback(async () => {
    const queued = await storage.listPendingMutations()
    const failed = queued.filter(item => item.status === 'failed')
    setPendingMutationCount(queued.length)
    setSyncIssues(failed)
    if (failed.length) setSyncStatus('failed')
    else if (queued.length) setSyncStatus('pending')
    else setSyncStatus('idle')
    return queued
  }, [storage])

  const scheduleRetry = useCallback((attempts: number) => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5))
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      window.dispatchEvent(new Event('grocea:sync'))
    }, delay)
  }, [])

  const synchronize = useCallback(async (importCandidate?: GroceaState) => {
    if (!storage.getMetadata || !storage.saveMetadata || syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')
    try {
      let metadata = await storage.getMetadata()
      deviceIdRef.current = metadata.deviceId
      setImportConflicts(metadata.importConflicts)
      if (metadata.remoteImportStatus === 'pending' && importCandidate) {
        const imported = await importLocalState(importCandidate, metadata.importId, metadata.deviceId)
        metadata = {
          ...metadata,
          syncCursor: String(imported.revision),
          remoteImportStatus: imported.conflicts.length ? 'conflicts' : 'complete',
          importConflicts: imported.conflicts,
        }
        await storage.saveMetadata(metadata)
        setImportConflicts(imported.conflicts)
      }

      const queued = await storage.listPendingMutations()
      const failedIds = new Set(queued.filter(item => item.status === 'failed').map(item => item.id))
      for (const current of queued) {
        if (current.status === 'failed') continue
        if (current.dependsOn.some(dependency => failedIds.has(dependency))) {
          const failed: PendingMutation = {
            ...current,
            status: 'failed',
            error: {
              code: 'DEPENDENCY_FAILED',
              message: 'An earlier queued change must be resolved first.',
              retryable: false,
            },
          }
          if (storage.updateMutation) await storage.updateMutation(failed)
          failedIds.add(failed.id)
          continue
        }
        const mutation = { ...current, status: 'syncing' as const, lastAttemptAt: new Date().toISOString() }
        if (storage.updateMutation) await storage.updateMutation(mutation)
        try {
          await sendMutation(mutation)
          await storage.removeMutation(mutation.id)
        } catch (error) {
          const apiError = error instanceof ApiError
            ? error
            : new ApiError(0, 'SYNC_FAILED', error instanceof Error ? error.message : 'Sync failed.')
          const failed: PendingMutation = {
            ...mutation,
            status: apiError.retryable ? 'pending' : 'failed',
            attempts: mutation.attempts + 1,
            error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable },
          }
          if (storage.updateMutation) await storage.updateMutation(failed)
          if (apiError.retryable) scheduleRetry(failed.attempts)
          break
        }
      }

      const remaining = await storage.listPendingMutations()
      if (remaining.length === 0 && metadata.remoteImportStatus !== 'conflicts') {
        const remote = await fetchState()
        if (storage.saveCanonicalState) await storage.saveCanonicalState(remote.state)
        else await storage.saveState(remote.state)
        metadata = { ...metadata, syncCursor: String(remote.revision) }
        await storage.saveMetadata(metadata)
        stateRef.current = remote.state
        setState(remote.state)
      }
      await refreshQueueStatus()
    } catch (error) {
      setSyncStatus('offline')
      if (error instanceof ApiError && error.retryable) scheduleRetry(1)
    } finally {
      syncingRef.current = false
    }
  }, [refreshQueueStatus, scheduleRetry, storage])

  const boot = useCallback(async () => {
    updateStorageStatus('loading')
    try {
      await storage.open()
      const loaded = await storage.loadState()
      stateRef.current = loaded
      setState(loaded)
      updateStorageStatus('ready')
      await refreshQueueStatus()
      if (storage.getMetadata) void synchronize(loaded)
    } catch (error) {
      updateStorageStatus('error', error instanceof Error ? error.message : 'Local storage could not be opened.')
    }
  }, [refreshQueueStatus, storage, synchronize, updateStorageStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => { void boot() }, 0)
    const sync = () => { void synchronize() }
    window.addEventListener('online', sync)
    window.addEventListener('focus', sync)
    window.addEventListener('grocea:sync', sync)
    return () => {
      window.clearTimeout(timer)
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      window.removeEventListener('online', sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('grocea:sync', sync)
    }
  }, [boot, synchronize])

  const commit = useCallback(function commit<T>(transition: (current: GroceaState) => Transition<T>): Promise<T> {
    const operation = writeQueue.current.then(async () => {
      if (statusRef.current !== 'ready' || !stateRef.current) {
        throw new Error('Local storage is unavailable. Retry before making changes.')
      }
      const next = transition(stateRef.current)
      if (next.state !== stateRef.current) {
        if (next.mutation) {
          const queued = await storage.listPendingMutations()
          const mutation: PendingMutation = {
            id: crypto.randomUUID(),
            deviceId: deviceIdRef.current,
            type: next.mutation.type,
            createdAt: new Date().toISOString(),
            payload: next.mutation.payload,
            attempts: 0,
            status: 'pending',
            dependsOn: [...new Set([
              ...(next.mutation.dependsOn ?? []),
              ...queued.map(item => item.id),
            ])],
          }
          if (storage.saveStateAndMutation) await storage.saveStateAndMutation(next.state, mutation)
          else {
            await storage.saveState(next.state)
            await storage.enqueueMutation(mutation)
          }
        } else {
          await storage.saveState(next.state)
        }
        stateRef.current = next.state
        setState(next.state)
        void refreshQueueStatus()
        window.dispatchEvent(new Event('grocea:sync'))
      }
      return next.result
    })
    writeQueue.current = operation.then(() => undefined, () => undefined)
    return operation.catch(error => {
      updateStorageStatus('error', error instanceof Error ? error.message : 'Your change could not be saved locally.')
      throw error
    })
  }, [refreshQueueStatus, storage, updateStorageStatus])

  const actions = useMemo(() => ({
    adjustStock: (ingredientId: string, operation: StockOperation, amount: bigint, reason: string) => {
      const eventId = crypto.randomUUID()
      return commit(current => ({
        state: reducer(current, { type: 'stock', eventId, ingredientId, operation, amount, reason }),
        result: undefined,
        mutation: {
          type: 'stock.operation',
          payload: { eventId, ingredientId, operation, amount: amount.toString(), reason },
        },
      }))
    },
    createIngredient: (name: string, categoryId: string, family: Ingredient['family'], createStock = false) => {
      const id = crypto.randomUUID()
      return commit(current => ({
        state: reducer(current, {
          type: 'ingredient',
          ingredient: { id, name, categoryId, family, scope: 'custom' },
          createStock,
        }),
        result: id,
        mutation: { type: 'ingredient.create', payload: { id, name, categoryId, family, createStock } },
      }))
    },
    createRecipeDraft: (sourceRecipeId?: string) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit(current => {
        const source = sourceRecipeId
          ? current.recipes.find((recipe): recipe is PublishedRecipe => recipe.id === sourceRecipeId && isPublishedRecipe(recipe))
          : undefined
        if (sourceRecipeId && !source) throw new Error('Published recipe could not be copied.')
        const recipe: DraftRecipe = {
          id,
          status: 'draft',
          scope: 'custom',
          name: source?.name ?? '',
          description: source?.description ?? '',
          baseServings: source?.baseServings ?? current.profile.preferredServings,
          ingredients: source?.ingredients.map(item => ({
            ingredientId: item.ingredientId,
            quantity: formatQuantityValue(item.quantity, item.unit),
            unit: item.unit,
          })) ?? [],
          steps: source ? [...source.steps] : [''],
          createdAt: now,
          updatedAt: now,
        }
        return {
          state: reducer(current, { type: 'recipe-create', recipe }),
          result: id,
          mutation: { type: 'recipe.create', payload: { recipe } },
        }
      })
    },
    updateRecipeDraft: (
      id: string,
      patch: Partial<Pick<DraftRecipe, 'name' | 'description' | 'baseServings' | 'ingredients' | 'steps'>>,
    ) => commit(current => {
      const next = reducer(current, { type: 'recipe-update', id, patch, updatedAt: new Date().toISOString() })
      const recipe = next.recipes.find((item): item is DraftRecipe => item.id === id && item.status === 'draft')
      return {
        state: next,
        result: undefined,
        mutation: recipe ? { type: 'recipe.update', payload: { id, recipe } } : undefined,
      }
    }),
    deleteRecipeDraft: (id: string) => commit(current => ({
      state: reducer(current, { type: 'recipe-delete', id }),
      result: undefined,
      mutation: { type: 'recipe.delete', payload: { id } },
    })),
    publishRecipeDraft: (id: string) => commit(current => {
      const draft = current.recipes.find((recipe): recipe is DraftRecipe => recipe.id === id && recipe.status === 'draft')
      if (!draft || !draft.name.trim() || draft.name.trim().length > 120 || draft.baseServings < 1
        || !draft.steps.some(step => step.trim()) || !draft.ingredients.length) {
        return { state: current, result: false }
      }
      const ingredients = draft.ingredients.flatMap(item => {
        const source = current.ingredients.find(ingredient => ingredient.id === item.ingredientId)
        const quantity = parseQuantity(item.quantity, item.unit)
        return source && familyUnits[source.family].includes(item.unit) && quantity !== null && quantity > 0n
          ? [{ ingredientId: item.ingredientId, quantity, unit: item.unit }]
          : []
      })
      if (ingredients.length !== draft.ingredients.length
        || new Set(ingredients.map(item => item.ingredientId)).size !== ingredients.length) {
        return { state: current, result: false }
      }
      const recipe: PublishedRecipe = {
        id: draft.id,
        status: 'published',
        scope: 'custom',
        name: draft.name.trim(),
        description: draft.description.trim(),
        baseServings: draft.baseServings,
        ingredients,
        steps: draft.steps.map(step => step.trim()).filter(Boolean),
      }
      return {
        state: reducer(current, { type: 'recipe-publish', recipe }),
        result: true,
        mutation: { type: 'recipe.publish', payload: { id } },
      }
    }),
    cookRecipe: (recipeId: string, servings: number, changes: ActivityEvent['changes']) => {
      const eventId = crypto.randomUUID()
      return commit(current => {
        const recipe = current.recipes.find(item => item.id === recipeId && isPublishedRecipe(item))
        const event: ActivityEvent = {
          id: eventId,
          type: 'cooking',
          title: `Cooked ${recipe?.name ?? 'recipe'}`,
          detail: `${servings} serving${servings === 1 ? '' : 's'} · ${changes.length} stock changes`,
          occurredAt: new Date().toISOString(),
          recipeId,
          servings,
          changes,
        }
        return {
          state: reducer(current, { type: 'cook', event }),
          result: eventId,
          mutation: { type: 'recipe.cook', payload: { eventId, recipeId, servings } },
        }
      })
    },
    reverseEvent: (eventId: string) => commit(current => {
      const original = current.activity.find(event => event.id === eventId)
      if (!original || original.reversedAt) return { state: current, result: undefined }
      const occurredAt = new Date().toISOString()
      const changes = original.changes.map(change => {
        const before = current.balances[change.ingredientId] ?? 0n
        return { ingredientId: change.ingredientId, before, delta: -change.delta, after: before - change.delta }
      })
      const reversal: ActivityEvent = {
        id: crypto.randomUUID(),
        type: 'reversal',
        title: 'Cooking undone',
        detail: `${original.title.replace(/^Cooked /, '')} · Stock restored`,
        occurredAt,
        reversalOf: eventId,
        changes,
      }
      return {
        state: reducer(current, { type: 'reverse', eventId, reversal }),
        result: undefined,
        mutation: { type: 'activity.reverse', payload: { eventId, reversalId: reversal.id } },
      }
    }),
    createCategory: (name: string) => {
      const id = crypto.randomUUID()
      return commit(current => ({
        state: reducer(current, { type: 'category', id, name }),
        result: undefined,
        mutation: { type: 'category.create', payload: { id, name } },
      }))
    },
    updateProfile: (displayName: string, preferredServings: number) => commit(current => ({
      state: reducer(current, { type: 'profile', displayName, preferredServings }),
      result: undefined,
      mutation: { type: 'profile.update', payload: { displayName, preferredServings } },
    })),
  }), [commit])

  const retrySync = useCallback(async () => {
    const queued = await storage.listPendingMutations()
    if (storage.updateMutation) {
      await Promise.all(queued.filter(item => item.status === 'failed').map(item => storage.updateMutation!({
        ...item,
        status: 'pending',
        error: undefined,
      })))
    }
    await synchronize()
  }, [storage, synchronize])

  const discardSyncIssue = useCallback(async (id: string) => {
    const queued = await storage.listPendingMutations()
    const discarded = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      queued.forEach(item => {
        if (!discarded.has(item.id) && item.dependsOn.some(dependency => discarded.has(dependency))) {
          discarded.add(item.id)
          changed = true
        }
      })
    }
    await Promise.all([...discarded].map(mutationId => storage.removeMutation(mutationId)))
    await refreshQueueStatus()
    await synchronize()
  }, [refreshQueueStatus, storage, synchronize])

  const reset = useCallback(async () => {
    updateStorageStatus('loading')
    try {
      const resetState = await storage.reset()
      stateRef.current = resetState
      setState(resetState)
      updateStorageStatus('ready')
    } catch (error) {
      updateStorageStatus('error', error instanceof Error ? error.message : 'Local data could not be reset.')
    }
  }, [storage, updateStorageStatus])

  if (!state) {
    if (storageStatus === 'error') {
      return <><StorageFailure message={storageError} retry={boot} reset={() => setResetRequested(true)} /><ConfirmDialog open={resetRequested} title="Reset all local data?" description="Every pantry balance, recipe, activity event, profile preference, and queued change stored on this device will be permanently removed. This cannot be undone." confirmLabel="Reset local data" pendingLabel="Resetting…" onDismiss={() => setResetRequested(false)} onConfirm={reset} /></>
    }
    return <main className="storage-state" aria-busy="true"><div className="storage-state-card">
      <span className="eyebrow">LOCAL DATA</span><h1>Opening Grocea…</h1><p>Preparing your offline pantry.</p>
    </div></main>
  }

  const value: GroceaContextValue = {
    ...state,
    storageStatus,
    storageError,
    syncStatus,
    pendingMutationCount,
    syncIssues,
    importConflicts,
    retrySync,
    discardSyncIssue,
    categoryName: id => state.categories.find(item => item.id === id)?.name ?? 'Other',
    ingredient: id => state.ingredients.find(item => item.id === id),
    ...actions,
  }

  return <GroceaContext.Provider value={value}>
    {children}
    {storageStatus === 'error' && <div className="storage-error-banner" role="alert">
      <div><strong>Changes are paused</strong><small>{storageError ?? 'Grocea could not save to this device.'}</small></div>
      <button className="button secondary compact" type="button" onClick={() => void boot()}>Retry</button>
      <button className="button danger compact" type="button" onClick={() => setResetRequested(true)}>Reset local data</button>
    </div>}
    <ConfirmDialog open={resetRequested} title="Reset all local data?" description="Every pantry balance, recipe, activity event, profile preference, and queued change stored on this device will be permanently removed. This cannot be undone." confirmLabel="Reset local data" pendingLabel="Resetting…" onDismiss={() => setResetRequested(false)} onConfirm={reset} />
  </GroceaContext.Provider>
}

function StorageFailure({
  message,
  retry,
  reset,
}: {
  message: string | null
  retry: () => Promise<void>
  reset: () => void
}) {
  return <main className="storage-state"><div className="storage-state-card">
    <span className="eyebrow">LOCAL STORAGE ERROR</span>
    <h1>Grocea couldn’t open your data</h1>
    <p>{message ?? 'Your offline data is unavailable.'}</p>
    <div className="form-actions">
      <button className="button primary" type="button" onClick={() => void retry()}>Retry</button>
      <button className="button danger" type="button" onClick={reset}>Reset local data</button>
    </div>
  </div></main>
}
