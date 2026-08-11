import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, fetchState, hasCsrfToken, importLocalState, sendMutation } from '../api/client'
import type {
  ActivityEvent,
  BasketItem,
  DraftRecipe,
  GroceaState,
  GroceryList,
  GroceryListItem,
  ImportConflict,
  Ingredient,
  PendingMutation,
  PublishedRecipe,
  StockOperation,
  SyncError,
  SyncStatus,
} from '../domain/types'
import { isPublishedRecipe } from '../domain/types'
import { familyUnits, formatQuantityValue, parseQuantity, scaleQuantity } from '../shared/lib/quantity'
import { GroceaContext, type GroceaContextValue, type StorageStatus } from './grocea-context'
import { useBootSplash } from './boot-context'
import { deleteLegacyStorage, groceaStorage, type DatabaseMetadata, type GroceaStorage } from './persistence'
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

class MutationBlockedError extends Error {
  constructor() {
    super('Connect once before making changes to this account.')
    this.name = 'MutationBlockedError'
  }
}

function canonicalUnit(ingredient: Ingredient) {
  return ingredient.family === 'mass' ? 'g' : ingredient.family === 'volume' ? 'ml' : 'item'
}

function buildGroceryList(state: GroceaState, id: string, now: string): GroceryList {
  if (state.groceryLists.some(list => list.status === 'active')) {
    throw new Error('Complete or delete the active Grocery List first.')
  }
  if (!state.basket.length) throw new Error('Add at least one recipe to Basket first.')
  const recipes = state.basket.map(item => {
    const recipe = state.recipes.find((candidate): candidate is PublishedRecipe => (
      candidate.id === item.recipeId && isPublishedRecipe(candidate)
    ))
    if (!recipe || !item.valid) throw new Error(`${item.recipeName} is no longer available.`)
    return { basket: item, recipe }
  })
  const aggregates = new Map<string, {
    required: bigint
    sources: GroceryListItem['sources']
  }>()
  recipes.forEach(({ basket, recipe }) => {
    recipe.ingredients.forEach(requirement => {
      const ingredient = state.ingredients.find(candidate => candidate.id === requirement.ingredientId)
      if (!ingredient) throw new Error('A Recipe Ingredient is no longer available.')
      const contribution = scaleQuantity(requirement.quantity, basket.servings, recipe.baseServings)
      const existing = aggregates.get(ingredient.id) ?? { required: 0n, sources: [] }
      const unit = canonicalUnit(ingredient)
      existing.required += contribution
      existing.sources.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        servings: basket.servings,
        quantity: contribution,
        unit,
      })
      aggregates.set(ingredient.id, existing)
    })
  })
  const items = [...aggregates.entries()].flatMap(([ingredientId, aggregate]) => {
    const ingredient = state.ingredients.find(candidate => candidate.id === ingredientId)!
    const pantry = state.balances[ingredientId] ?? 0n
    const quantity = aggregate.required - pantry
    if (quantity <= 0n) return []
    const unit = canonicalUnit(ingredient)
    return [{
      id: crypto.randomUUID(),
      ingredientId,
      label: ingredient.name,
      categoryName: state.categories.find(category => category.id === ingredient.categoryId)?.name ?? 'Other',
      family: ingredient.family,
      quantity,
      unit,
      checked: false,
      origin: 'generated' as const,
      edited: false,
      originalRequired: aggregate.required,
      originalPantry: pantry,
      originalQuantity: quantity,
      sources: aggregate.sources,
      createdAt: now,
      updatedAt: now,
    }]
  })
  const first = recipes[0].recipe.name
  return {
    id,
    title: `Groceries — ${first}${recipes.length > 1 ? ` + ${recipes.length - 1}` : ''}`,
    status: items.length ? 'active' : 'completed',
    recipes: recipes.map(({ basket, recipe }) => ({
      recipeId: recipe.id,
      recipeName: recipe.name,
      servings: basket.servings,
      baseServings: recipe.baseServings,
    })),
    items,
    createdAt: now,
    updatedAt: now,
    completedAt: items.length ? undefined : now,
  }
}

const remapMutationIds = (mutation: PendingMutation, idMap: Record<string, string>): PendingMutation => {
  const payload = mutation.payload as Record<string, unknown>
  const remap = (value: unknown) => typeof value === 'string' ? idMap[value] ?? value : value
  const remapRecipe = (value: unknown) => {
    if (!value || typeof value !== 'object') return value
    const recipe = value as Record<string, unknown>
    return {
      ...recipe,
      id: remap(recipe.id),
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map(item => {
          if (!item || typeof item !== 'object') return item
          const ingredient = item as Record<string, unknown>
          return { ...ingredient, ingredientId: remap(ingredient.ingredientId) }
        })
        : recipe.ingredients,
    }
  }
  const remapObjects = (value: unknown, fields: string[]) => Array.isArray(value)
    ? value.map(item => {
        if (!item || typeof item !== 'object') return item
        const record = item as Record<string, unknown>
        return Object.fromEntries(Object.entries(record).map(([key, entry]) => [
          key,
          fields.includes(key) ? remap(entry) : entry,
        ]))
      })
    : value
  const remapBasisRecipes = (value: unknown) => Array.isArray(value)
    ? value.map(item => {
        if (!item || typeof item !== 'object') return item
        const recipe = item as Record<string, unknown>
        return {
          ...recipe,
          recipeId: remap(recipe.recipeId),
          ingredients: remapObjects(recipe.ingredients, ['ingredientId']),
        }
      })
    : value
  const remapItem = (value: unknown) => {
    if (!value || typeof value !== 'object') return value
    const item = value as Record<string, unknown>
    return {
      ...item,
      id: remap(item.id),
      ingredientId: remap(item.ingredientId),
      sources: remapObjects(item.sources, ['recipeId']),
    }
  }
  return {
    ...mutation,
    payload: {
      ...payload,
      id: remap(payload.id),
      categoryId: remap(payload.categoryId),
      ingredientId: remap(payload.ingredientId),
      recipeId: remap(payload.recipeId),
      listId: remap(payload.listId),
      itemId: remap(payload.itemId),
      eventId: remap(payload.eventId),
      reversalId: remap(payload.reversalId),
      recipe: remapRecipe(payload.recipe),
      item: remapItem(payload.item),
      generatedItemIds: remapObjects(payload.generatedItemIds, ['ingredientId', 'id']),
      recipeBasis: remapBasisRecipes(payload.recipeBasis),
      pantryBasis: remapObjects(payload.pantryBasis, ['ingredientId']),
    },
  }
}

type MutationLike = Pick<PendingMutation, 'type' | 'payload'> | MutationDraft

function mutationCreatedIds(mutation: MutationLike): string[] {
  const payload = mutation.payload as Record<string, unknown>
  const recipe = payload.recipe as Record<string, unknown> | undefined
  const item = payload.item as Record<string, unknown> | undefined
  const generatedItemIds = Array.isArray(payload.generatedItemIds) ? payload.generatedItemIds : []
  const ids: unknown[] = []
  if (mutation.type === 'category.create' || mutation.type === 'ingredient.create') ids.push(payload.id)
  if (mutation.type === 'recipe.create') ids.push(recipe?.id)
  if (mutation.type === 'stock.operation' || mutation.type === 'recipe.cook' || mutation.type === 'grocery-list.complete') ids.push(payload.eventId)
  if (mutation.type === 'activity.reverse') ids.push(payload.reversalId)
  if (mutation.type === 'grocery-list.create') {
    ids.push(payload.id, payload.listId)
    generatedItemIds.forEach(value => {
      if (value && typeof value === 'object') ids.push((value as Record<string, unknown>).id)
    })
  }
  if (mutation.type === 'grocery-list.item.create') ids.push(item?.id)
  return ids.filter((value): value is string => typeof value === 'string')
}

function mutationReferencedIds(mutation: MutationLike): string[] {
  const created = new Set(mutationCreatedIds(mutation))
  const collect = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(collect)
    if (!value || typeof value !== 'object') return []
    return Object.values(value).flatMap(collect)
  }
  return [...new Set(collect(mutation.payload).filter(value => !created.has(value)))]
}

function deriveMutationDependencies(mutation: MutationDraft, queued: PendingMutation[]): string[] {
  const creators = new Map<string, string>()
  queued.forEach(item => mutationCreatedIds(item).forEach(id => creators.set(id, item.id)))
  const operationDependencies = mutation.type === 'grocery-list.create'
    ? queued.filter(item => item.type === 'basket.recipe.upsert').map(item => item.id)
    : []
  return [...new Set([
    ...(mutation.dependsOn ?? []),
    ...operationDependencies,
    ...mutationReferencedIds(mutation).flatMap(id => {
      const creator = creators.get(id)
      return creator ? [creator] : []
    }),
  ])]
}

function toSyncError(error: unknown): { apiError: ApiError; syncError: SyncError } {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(0, 'SYNC_FAILED', error instanceof Error ? error.message : 'Synchronization failed.')
  return {
    apiError,
    syncError: {
      code: apiError.code,
      status: apiError.status,
      message: apiError.message,
      retryable: apiError.retryable,
    },
  }
}

function accountSyncIncomplete(metadata: DatabaseMetadata | null): boolean {
  return Boolean(metadata?.ownerUserId && (metadata.syncCursor === null || metadata.remoteImportStatus !== 'complete'))
}

function freshAccountNeedsRemote(metadata: DatabaseMetadata | null): boolean {
  return Boolean(
    metadata?.ownerUserId
      && metadata.syncCursor === null
      && !metadata.legacyClaimed
      && metadata.remoteImportStatus === 'complete',
  )
}

function mutationRevision(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

export function GroceaProvider({ children, storage = groceaStorage }: { children: ReactNode; storage?: GroceaStorage }) {
  const [state, setState] = useState<GroceaState | null>(null)
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('loading')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [canMutate, setCanMutate] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline')
  const [syncError, setSyncError] = useState<SyncError | null>(null)
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
  const bootReportRef = useRef<string | null>(null)
  const initialSyncPendingRef = useRef(false)
  const canMutateRef = useRef(true)
  const { markReady, markFailure } = useBootSplash()

  const updateStorageStatus = useCallback((next: StorageStatus, error: string | null = null) => {
    statusRef.current = next
    setStorageStatus(next)
    setStorageError(error)
  }, [])

  const updateMutationAvailability = useCallback((metadata: DatabaseMetadata | null) => {
    const next = !accountSyncIncomplete(metadata)
    canMutateRef.current = next
    setCanMutate(next)
    return next
  }, [])

  const refreshQueueStatus = useCallback(async () => {
    const queued = await storage.listPendingMutations()
    const failed = queued.filter(item => item.status === 'failed')
    setPendingMutationCount(queued.length)
    setSyncIssues(failed)
    if (failed.length) setSyncStatus('failed')
    else if (queued.length) setSyncStatus('pending')
    else if (initialSyncPendingRef.current) setSyncStatus('initial-sync')
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
    if (!storage.getMetadata || !storage.saveMetadata || statusRef.current !== 'ready' || syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')
    let initialSyncPending = initialSyncPendingRef.current
    try {
      let metadata = await storage.getMetadata()
      initialSyncPending = accountSyncIncomplete(metadata)
      initialSyncPendingRef.current = initialSyncPending
      updateMutationAvailability(metadata)
      let idMap: Record<string, string> = {}
      let remoteRevision = metadata.syncCursor === null ? undefined : Number(metadata.syncCursor)
      if (!Number.isFinite(remoteRevision)) remoteRevision = undefined
      deviceIdRef.current = metadata.deviceId
      setImportConflicts(metadata.importConflicts)
      const localCandidate = importCandidate ?? stateRef.current
      if (metadata.remoteImportStatus !== 'complete' && localCandidate) {
        const imported = await importLocalState(localCandidate, metadata.importId, metadata.deviceId)
        idMap = imported.idMap
        metadata = {
          ...metadata,
          syncCursor: String(imported.revision),
          remoteImportStatus: imported.conflicts.length ? 'conflicts' : 'complete',
          importConflicts: imported.conflicts,
        }
        remoteRevision = imported.revision
        await storage.saveMetadata(metadata)
        setImportConflicts(imported.conflicts)
        updateMutationAvailability(metadata)
      }

      let queued = await storage.listPendingMutations()
      if (storage.updateMutation && Object.keys(idMap).length) {
        queued = await Promise.all(queued.map(async item => {
          const remapped = remapMutationIds(item, idMap)
          await storage.updateMutation!(remapped)
          return remapped
        }))
      }
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
        const expectedRevision = remoteRevision
        const mutation = {
          ...current,
          expectedRevision,
          serverRevision: expectedRevision,
          status: 'syncing' as const,
          lastAttemptAt: new Date().toISOString(),
        }
        if (storage.updateMutation) await storage.updateMutation(mutation)
        try {
          const nextRevision = await sendMutation(mutation)
          if (nextRevision !== undefined) remoteRevision = nextRevision
        } catch (error) {
          const { apiError, syncError: nextSyncError } = toSyncError(error)
          if (apiError.authRequired) {
            if (storage.updateMutation) {
              await storage.updateMutation({ ...mutation, status: 'pending', error: undefined })
            }
            setSyncError(null)
            setSyncStatus('offline')
            break
          }
          setSyncError(nextSyncError)
          const failed: PendingMutation = {
            ...mutation,
            status: apiError.retryable ? 'pending' : 'failed',
            attempts: mutation.attempts + 1,
            error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable },
          }
          if (storage.updateMutation) await storage.updateMutation(failed)
          if (apiError.code === 'GROCERY_CALCULATION_STALE' && mutation.type === 'grocery-list.create') {
            const listId = (mutation.payload as { id?: unknown }).id
            const currentState = stateRef.current
            const provisional = currentState?.groceryLists.find(list => list.id === listId)
            if (currentState && provisional) {
              const restored = provisional.recipes.flatMap(source => {
                if (currentState.basket.some(item => item.recipeId === source.recipeId)) return []
                const recipe = currentState.recipes.find(
                  (item): item is PublishedRecipe => item.id === source.recipeId && isPublishedRecipe(item),
                )
                return recipe ? [{
                  recipeId: recipe.id,
                  recipeName: recipe.name,
                  servings: source.servings,
                  baseServings: recipe.baseServings,
                  valid: true,
                } satisfies BasketItem] : []
              })
              const recovered = {
                ...currentState,
                basket: [...currentState.basket, ...restored],
                groceryLists: currentState.groceryLists.filter(list => list.id !== listId),
              }
              await storage.saveState(recovered)
              stateRef.current = recovered
              setState(recovered)
            }
          }
          if (apiError.code === 'STATE_REVISION_CONFLICT') {
            const currentRevision = mutationRevision(apiError.details.current_revision)
            if (currentRevision !== undefined) {
              remoteRevision = currentRevision
              metadata = { ...metadata, syncCursor: String(currentRevision) }
              await storage.saveMetadata(metadata)
            }
            break
          }
          if (apiError.retryable) {
            scheduleRetry(failed.attempts)
            break
          }
          continue
        }
        await storage.removeMutation(mutation.id)
      }

      const remaining = await storage.listPendingMutations()
      if (remaining.length === 0 && metadata.remoteImportStatus !== 'conflicts') {
        const remote = await fetchState()
        if (storage.saveCanonicalState) await storage.saveCanonicalState(remote.state)
        else await storage.saveState(remote.state)
        metadata = { ...metadata, syncCursor: String(remote.revision), remoteImportStatus: 'complete' }
        await storage.saveMetadata(metadata)
        if (metadata.legacyClaimed) await deleteLegacyStorage()
        initialSyncPendingRef.current = false
        updateMutationAvailability(metadata)
        setSyncError(null)
        stateRef.current = remote.state
        setState(remote.state)
      }
      await refreshQueueStatus()
    } catch (error) {
      const { apiError, syncError: nextSyncError } = toSyncError(error)
      if (apiError.authRequired) {
        setSyncError(null)
        setSyncStatus('offline')
        return
      }
      if (!(error instanceof ApiError)) {
        updateStorageStatus('error', error instanceof Error ? error.message : 'Local storage could not be updated.')
        return
      }
      setSyncError(nextSyncError)
      setSyncStatus(initialSyncPendingRef.current || initialSyncPending ? 'initial-sync' : 'offline')
      if (apiError.retryable) scheduleRetry(1)
    } finally {
      syncingRef.current = false
    }
  }, [refreshQueueStatus, scheduleRetry, storage, updateMutationAvailability, updateStorageStatus])

  const boot = useCallback(async () => {
    bootReportRef.current = null
    updateStorageStatus('loading')
    try {
      await storage.open()
      let loaded: GroceaState | undefined
      let metadata = storage.getMetadata ? await storage.getMetadata() : null
      if (metadata) deviceIdRef.current = metadata.deviceId
      const freshAccount = freshAccountNeedsRemote(metadata)
      let needsSync = Boolean(metadata && !freshAccount)
      initialSyncPendingRef.current = accountSyncIncomplete(metadata)
      updateMutationAvailability(metadata)
      if (freshAccount) {
        let remote: Awaited<ReturnType<typeof fetchState>> | null = null
        try {
          remote = await fetchState()
        } catch (error) {
          const { apiError, syncError: nextSyncError } = toSyncError(error)
          if (apiError.authRequired) throw error
          loaded = await storage.loadState()
          setSyncError(nextSyncError)
          setSyncStatus('initial-sync')
          if (apiError.retryable) scheduleRetry(1)
        }
        if (remote) {
          loaded = remote.state
          if (storage.saveCanonicalState) await storage.saveCanonicalState(remote.state)
          else await storage.saveState(remote.state)
          if (metadata && storage.saveMetadata) {
            metadata = { ...metadata, syncCursor: String(remote.revision), remoteImportStatus: 'complete' }
            await storage.saveMetadata(metadata)
          }
          initialSyncPendingRef.current = false
          updateMutationAvailability(metadata)
          needsSync = false
          setSyncError(null)
        }
      } else {
        try {
          loaded = await storage.loadState()
        } catch (localError) {
          try {
            const remote = await fetchState()
            loaded = remote.state
            if (storage.saveCanonicalState) await storage.saveCanonicalState(remote.state)
            else await storage.saveState(remote.state)
            if (metadata && storage.saveMetadata) {
              metadata = { ...metadata, syncCursor: String(remote.revision), remoteImportStatus: 'complete' }
              await storage.saveMetadata(metadata)
            }
            updateMutationAvailability(metadata)
            setSyncError(null)
          } catch (remoteError) {
            if (remoteError instanceof ApiError && remoteError.authRequired) throw remoteError
            throw localError
          }
        }
      }
      if (!loaded) throw new Error('Stored Grocea data could not be loaded.')
      stateRef.current = loaded
      setState(loaded)
      updateStorageStatus('ready')
      await refreshQueueStatus()
      if (storage.getMetadata && needsSync) void synchronize(loaded)
    } catch (error) {
      if (error instanceof ApiError && error.authRequired) return
      updateStorageStatus('error', error instanceof Error ? error.message : 'Local storage could not be opened.')
    }
  }, [refreshQueueStatus, scheduleRetry, storage, synchronize, updateMutationAvailability, updateStorageStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => { void boot() }, 0)
    const sync = () => { if (hasCsrfToken()) void synchronize() }
    const syncAfterAuth = () => { void synchronize() }
    window.addEventListener('focus', sync)
    window.addEventListener('grocea:sync', sync)
    window.addEventListener('grocea:auth-validated', syncAfterAuth)
    return () => {
      window.clearTimeout(timer)
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
      window.removeEventListener('focus', sync)
      window.removeEventListener('grocea:sync', sync)
      window.removeEventListener('grocea:auth-validated', syncAfterAuth)
      storage.close?.()
    }
  }, [boot, storage, synchronize])

  useEffect(() => {
    const reportKey = state
      ? 'ready'
      : storageStatus === 'error'
        ? `error:${storageError ?? ''}`
        : 'loading'
    if (bootReportRef.current === reportKey) return
    bootReportRef.current = reportKey
    if (state) markReady()
    else if (storageStatus === 'error') {
      markFailure({
        message: storageError ?? 'Your offline data is unavailable.',
        retry: boot,
        requestReset: () => setResetRequested(true),
      })
    }
  }, [boot, markFailure, markReady, state, storageError, storageStatus])

  const commit = useCallback(function commit<T>(transition: (current: GroceaState) => Transition<T>): Promise<T> {
    const operation = writeQueue.current.then(async () => {
      if (statusRef.current !== 'ready' || !stateRef.current) {
        throw new Error('Local storage is unavailable. Retry before making changes.')
      }
      if (!canMutateRef.current) {
        throw new MutationBlockedError()
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
            dependsOn: deriveMutationDependencies(next.mutation, queued),
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
      if (!(error instanceof MutationBlockedError)) {
        updateStorageStatus('error', error instanceof Error ? error.message : 'Your change could not be saved locally.')
      }
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
    addRecipeToBasket: (recipeId: string, requestedServings?: number) => commit(current => {
      const recipe = current.recipes.find(item => item.id === recipeId && isPublishedRecipe(item))
      if (!recipe) throw new Error('Only published Recipes can be added to Basket.')
      const existing = current.basket.find(item => item.recipeId === recipeId)
      if (existing && requestedServings === undefined) return { state: current, result: undefined }
      const servings = Math.max(1, Math.min(12, requestedServings ?? recipe.baseServings))
      const item: BasketItem = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        servings,
        baseServings: recipe.baseServings,
        valid: true,
      }
      const exists = current.basket.some(candidate => candidate.recipeId === recipeId)
      return {
        state: {
          ...current,
          basket: exists
            ? current.basket.map(candidate => candidate.recipeId === recipeId ? item : candidate)
            : [...current.basket, item],
        },
        result: undefined,
        mutation: { type: 'basket.recipe.upsert', payload: { recipeId, servings } },
      }
    }),
    removeRecipeFromBasket: (recipeId: string) => commit(current => ({
      state: { ...current, basket: current.basket.filter(item => item.recipeId !== recipeId) },
      result: undefined,
      mutation: { type: 'basket.recipe.remove', payload: { recipeId } },
    })),
    clearBasket: () => commit(current => ({
      state: { ...current, basket: [] },
      result: undefined,
      mutation: { type: 'basket.clear', payload: {} },
    })),
    confirmBasket: () => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit(current => {
        const groceryList = buildGroceryList(current, id, now)
        const selectedRecipes = current.basket.map(item => current.recipes.find(
          (recipe): recipe is PublishedRecipe => recipe.id === item.recipeId && isPublishedRecipe(recipe),
        )!)
        const ingredientIds = [...new Set(selectedRecipes.flatMap(recipe => recipe.ingredients.map(item => item.ingredientId)))]
        return {
          state: { ...current, basket: [], groceryLists: [groceryList, ...current.groceryLists] },
          result: id,
          mutation: {
            type: 'grocery-list.create',
            payload: {
              id,
              generatedItemIds: groceryList.items.flatMap(item => item.ingredientId
                ? [{ ingredientId: item.ingredientId, id: item.id }]
                : []),
              recipeBasis: selectedRecipes.map(recipe => ({
                recipeId: recipe.id,
                baseServings: recipe.baseServings,
                ingredients: recipe.ingredients.map(item => ({
                  ingredientId: item.ingredientId,
                  quantity: item.quantity.toString(),
                })),
              })),
              pantryBasis: ingredientIds.map(ingredientId => ({
                ingredientId,
                quantity: (current.balances[ingredientId] ?? 0n).toString(),
              })),
            },
          },
        }
      })
    },
    renameGroceryList: (listId: string, title: string) => commit(current => {
      const value = title.trim()
      if (!value) throw new Error('Grocery List title is required.')
      return {
        state: {
          ...current,
          groceryLists: current.groceryLists.map(list => list.id === listId && list.status === 'active'
            ? { ...list, title: value, updatedAt: new Date().toISOString() }
            : list),
        },
        result: undefined,
        mutation: { type: 'grocery-list.update', payload: { listId, title: value } },
      }
    }),
    addGroceryItem: (
      listId: string,
      input: Pick<GroceryListItem, 'label' | 'ingredientId' | 'quantity' | 'unit'>,
    ) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit(current => {
        const list = current.groceryLists.find(candidate => candidate.id === listId && candidate.status === 'active')
        if (!list) throw new Error('Active Grocery List was not found.')
        const ingredient = input.ingredientId
          ? current.ingredients.find(candidate => candidate.id === input.ingredientId)
          : undefined
        if (input.ingredientId && !ingredient) throw new Error('Ingredient was not found.')
        const item: GroceryListItem = {
          id,
          ingredientId: ingredient?.id,
          label: ingredient?.name ?? input.label.trim(),
          categoryName: ingredient
            ? current.categories.find(category => category.id === ingredient.categoryId)?.name ?? 'Other'
            : 'Other',
          family: ingredient?.family,
          quantity: input.quantity,
          unit: ingredient && input.quantity !== undefined ? canonicalUnit(ingredient) : input.unit,
          checked: false,
          origin: 'manual',
          edited: false,
          sources: [],
          createdAt: now,
          updatedAt: now,
        }
        return {
          state: {
            ...current,
            groceryLists: current.groceryLists.map(candidate => candidate.id === listId
              ? { ...candidate, items: [...candidate.items, item], updatedAt: now }
              : candidate),
          },
          result: id,
          mutation: { type: 'grocery-list.item.create', payload: { listId, item } },
        }
      })
    },
    updateGroceryItem: (listId: string, item: GroceryListItem) => commit(current => {
      const now = new Date().toISOString()
      const list = current.groceryLists.find(candidate => candidate.id === listId && candidate.status === 'active')
      if (!list || !list.items.some(candidate => candidate.id === item.id)) {
        throw new Error('Active Grocery List Item was not found.')
      }
      const previous = list.items.find(candidate => candidate.id === item.id)!
      const ingredient = item.ingredientId
        ? current.ingredients.find(candidate => candidate.id === item.ingredientId)
        : undefined
      if (item.ingredientId && !ingredient) throw new Error('Ingredient was not found.')
      const normalizedItem: GroceryListItem = {
        ...item,
        ingredientId: ingredient?.id,
        label: ingredient?.name ?? item.label.trim(),
        categoryName: ingredient
          ? current.categories.find(category => category.id === ingredient.categoryId)?.name ?? 'Other'
          : 'Other',
        family: ingredient?.family,
        unit: ingredient && item.quantity !== undefined ? canonicalUnit(ingredient) : item.unit,
      }
      const changed = previous.ingredientId !== normalizedItem.ingredientId
        || previous.label !== normalizedItem.label
        || previous.quantity !== normalizedItem.quantity
        || previous.unit !== normalizedItem.unit
      const nextItem = { ...normalizedItem, edited: item.edited || changed, updatedAt: now }
      return {
        state: {
          ...current,
          groceryLists: current.groceryLists.map(candidate => candidate.id === listId
            ? { ...candidate, items: candidate.items.map(value => value.id === item.id ? nextItem : value), updatedAt: now }
            : candidate),
        },
        result: undefined,
        mutation: { type: 'grocery-list.item.update', payload: { listId, item: nextItem } },
      }
    }),
    removeGroceryItem: (listId: string, itemId: string) => commit(current => ({
      state: {
        ...current,
        groceryLists: current.groceryLists.map(list => list.id === listId && list.status === 'active'
          ? { ...list, items: list.items.filter(item => item.id !== itemId), updatedAt: new Date().toISOString() }
          : list),
      },
      result: undefined,
      mutation: { type: 'grocery-list.item.delete', payload: { listId, itemId } },
    })),
    completeGroceryList: (listId: string, pantryItemIds: string[]) => {
      const eventId = crypto.randomUUID()
      const now = new Date().toISOString()
      return commit(current => {
        const list = current.groceryLists.find(candidate => candidate.id === listId && candidate.status === 'active')
        if (!list) throw new Error('Active Grocery List was not found.')
        const selected = list.items.filter(item => pantryItemIds.includes(item.id))
        if (selected.some(item => !item.checked || !item.ingredientId || item.quantity === undefined)) {
          throw new Error('Pantry updates require checked catalog items with quantities.')
        }
        const additions = new Map<string, bigint>()
        selected.forEach(item => {
          const ingredientId = item.ingredientId!
          additions.set(ingredientId, (additions.get(ingredientId) ?? 0n) + item.quantity!)
        })
        const balances = { ...current.balances }
        const changes = [...additions].map(([ingredientId, quantity]) => {
          const before = balances[ingredientId] ?? 0n
          const after = before + quantity
          balances[ingredientId] = after
          return { ingredientId, before, delta: quantity, after }
        })
        const activity = changes.length
          ? [{
              id: eventId,
              type: 'manual' as const,
              title: 'Groceries added to pantry',
              detail: `${selected.length} purchased item${selected.length === 1 ? '' : 's'}`,
              occurredAt: now,
              changes,
            }, ...current.activity]
          : current.activity
        return {
          state: {
            ...current,
            balances,
            activity,
            groceryLists: current.groceryLists.map(candidate => candidate.id === listId
              ? { ...candidate, status: 'completed', completedAt: now, updatedAt: now }
              : candidate),
          },
          result: undefined,
          mutation: { type: 'grocery-list.complete', payload: { listId, eventId, pantryItemIds } },
        }
      })
    },
    reuseGroceryList: (listId: string) => commit(current => {
      const list = current.groceryLists.find(candidate => candidate.id === listId && candidate.status === 'completed')
      if (!list) throw new Error('Completed Grocery List was not found.')
      const additions = list.recipes.flatMap(source => {
        if (current.basket.some(item => item.recipeId === source.recipeId)) return []
        const recipe = current.recipes.find(candidate => candidate.id === source.recipeId && isPublishedRecipe(candidate))
        if (!recipe) throw new Error(`${source.recipeName} is no longer available.`)
        return [{
          recipeId: recipe.id,
          recipeName: recipe.name,
          servings: source.servings,
          baseServings: recipe.baseServings,
          valid: true,
        } satisfies BasketItem]
      })
      return {
        state: { ...current, basket: [...current.basket, ...additions] },
        result: undefined,
        mutation: { type: 'grocery-list.reuse', payload: { listId } },
      }
    }),
    deleteGroceryList: (listId: string, restoreRecipes = false) => commit(current => {
      const list = current.groceryLists.find(candidate => candidate.id === listId)
      if (!list) return { state: current, result: undefined }
      let basket = current.basket
      if (restoreRecipes) {
        const additions = list.recipes.flatMap(source => {
          if (basket.some(item => item.recipeId === source.recipeId)) return []
          const recipe = current.recipes.find(candidate => candidate.id === source.recipeId && isPublishedRecipe(candidate))
          if (!recipe) throw new Error(`${source.recipeName} is no longer available.`)
          return [{ recipeId: recipe.id, recipeName: recipe.name, servings: source.servings, baseServings: recipe.baseServings, valid: true } satisfies BasketItem]
        })
        basket = [...basket, ...additions]
      }
      return {
        state: { ...current, basket, groceryLists: current.groceryLists.filter(candidate => candidate.id !== listId) },
        result: undefined,
        mutation: { type: 'grocery-list.delete', payload: { listId, restoreRecipes } },
      }
    }),
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

  const flushPending = useCallback(async () => {
    await synchronize()
    return (await storage.listPendingMutations()).length === 0
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

  const discardAllPending = useCallback(async () => {
    const queued = await storage.listPendingMutations()
    await Promise.all(queued.map(item => storage.removeMutation(item.id)))
    await refreshQueueStatus()
  }, [refreshQueueStatus, storage])

  const reset = useCallback(async () => {
    updateStorageStatus('loading')
    try {
      const resetState = await storage.reset()
      const metadata = storage.getMetadata ? await storage.getMetadata() : null
      initialSyncPendingRef.current = accountSyncIncomplete(metadata)
      updateMutationAvailability(metadata)
      setSyncError(null)
      stateRef.current = resetState
      setState(resetState)
      updateStorageStatus('ready')
      if (metadata) {
        setSyncStatus('initial-sync')
        void synchronize(resetState)
      }
    } catch (error) {
      updateStorageStatus('error', error instanceof Error ? error.message : 'Local data could not be reset.')
    }
  }, [storage, synchronize, updateMutationAvailability, updateStorageStatus])

  if (!state) {
    if (storageStatus === 'error') {
      return <ConfirmDialog open={resetRequested} title="Reset all local data?" description="Every pantry balance, recipe, activity event, profile preference, and queued change stored on this device will be permanently removed. This cannot be undone." confirmLabel="Reset local data" pendingLabel="Resetting…" onDismiss={() => setResetRequested(false)} onConfirm={reset} />
    }
    return null
  }

  const value: GroceaContextValue = {
    ...state,
    storageStatus,
    storageError,
    canMutate,
    syncStatus,
    syncError,
    pendingMutationCount,
    syncIssues,
    importConflicts,
    retrySync,
    flushPending,
    discardSyncIssue,
    discardAllPending,
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
