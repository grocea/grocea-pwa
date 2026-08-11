import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroceaProvider } from '../src/app/GroceaProvider'
import { setCsrfToken } from '../src/api/client'
import { initialState } from '../src/app/fixtures'
import { useGrocea } from '../src/app/grocea-context'
import { BootSplashProvider, useBootSplash } from '../src/app/boot-context'
import { cloneState, createGroceaStorage, DATABASE_NAME, DATABASE_VERSION, type DatabaseMetadata, type GroceaStorage } from '../src/app/persistence'
import type { GroceaState, PendingMutation } from '../src/domain/types'
import { GroceaLoadingSplash } from '../src/shared/ui/GroceaLoadingSplash'

class MemoryStorage implements GroceaStorage {
  state = cloneState(initialState)
  saves: string[] = []
  failWrites = false
  mutations: PendingMutation[] = []

  async open() {}
  async loadState() { return cloneState(this.state) }
  async saveState(state: GroceaState) {
    if (this.failWrites) throw new Error('Quota exceeded')
    if (state.profile.displayName === 'First') await new Promise(resolve => setTimeout(resolve, 10))
    this.state = cloneState(state)
    this.saves.push(state.profile.displayName)
  }
  async enqueueMutation(mutation: PendingMutation) { this.mutations.push(mutation) }
  async listPendingMutations() { return this.mutations }
  async removeMutation(id: string) { this.mutations = this.mutations.filter(item => item.id !== id) }
  async reset() { this.state = cloneState(initialState); return cloneState(this.state) }
}

class FailingStorage extends MemoryStorage {
  async open() { throw new Error('Stored Grocea data could not be reconciled.') }
}

afterEach(() => {
  setCsrfToken(null)
  vi.unstubAllGlobals()
})

function Probe() {
  const { profile, updateProfile } = useGrocea()
  return <div>
    <span data-testid="profile-name">{profile.displayName}</span>
    <button onClick={() => void updateProfile('First', 2).catch(() => undefined)}>First</button>
    <button onClick={() => void updateProfile('Second', 2).catch(() => undefined)}>Second</button>
  </div>
}

function CloneProbe() {
  const { recipes, createRecipeDraft } = useGrocea()
  const source = recipes.find(recipe => recipe.id === 'tomato-egg-rice')
  const clone = recipes.find(recipe => recipe.status === 'draft' && recipe.name === 'Tomato egg rice')
  return <div>
    <button onClick={() => void createRecipeDraft('tomato-egg-rice')}>Clone recipe</button>
    <span data-testid="source-status">{source?.status}</span>
    {clone?.status === 'draft' && <output data-testid="clone">{JSON.stringify({
      name: clone.name,
      description: clone.description,
      servings: clone.baseServings,
      ingredients: clone.ingredients,
      steps: clone.steps,
    })}</output>}
  </div>
}

function SyncProbe() {
  const { pendingMutationCount, retrySync } = useGrocea()
  return <div>
    <span data-testid="queued-count">{pendingMutationCount}</span>
    <button onClick={() => void retrySync()}>Retry sync</button>
  </div>
}

function InitialSyncProbe() {
  const { profile, ingredients, canMutate, syncStatus, syncError, retrySync, updateProfile } = useGrocea()
  const { phase } = useBootSplash()
  return <div>
    <span data-testid="boot-phase">{phase}</span>
    <span data-testid="sync-status">{syncStatus}</span>
    <span data-testid="sync-error">{syncError ? `${syncError.code}:${syncError.status}:${syncError.message}` : ''}</span>
    <span data-testid="can-mutate">{String(canMutate)}</span>
    <span data-testid="profile-name">{profile.displayName}</span>
    <span data-testid="ingredient-count">{ingredients.length}</span>
    <button onClick={() => void retrySync()}>Retry initial sync</button>
    <button onClick={() => void updateProfile('Offline edit', 2).catch(() => undefined)}>Edit profile</button>
  </div>
}

function remoteStateResponse() {
  const timestamp = '2026-08-07T00:00:00Z'
  return new Response(JSON.stringify({
    revision: 9,
    profile: {
      id: crypto.randomUUID(),
      display_name: 'Remote Grocie',
      preferred_servings: 4,
      measurement_system: 'metric',
      created_at: timestamp,
      updated_at: timestamp,
    },
    categories: [{
      id: 'pantry',
      name: 'Pantry staples',
      scope: 'global',
      archived_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    ingredients: [{
      id: 'rice',
      name: 'Remote rice',
      category_id: 'pantry',
      measurement_family: 'mass',
      scope: 'global',
      tracked_in_pantry: true,
      archived_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    }],
    pantry_stocks: [{
      id: crypto.randomUUID(),
      ingredient_id: 'rice',
      quantity: '1.000',
      created_at: timestamp,
      updated_at: timestamp,
    }],
    recipes: [],
    activity: [],
    basket: { items: [] },
    grocery_lists: [],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function GroceryProbe() {
  const { basket, groceryLists, addRecipeToBasket, confirmBasket } = useGrocea()
  return <div>
    <span data-testid="basket-count">{basket.length}</span>
    <span data-testid="basket-servings">{basket[0]?.servings ?? 0}</span>
    <span data-testid="list-count">{groceryLists.length}</span>
    <span data-testid="list-items">{groceryLists[0]?.items.length ?? 0}</span>
    <button onClick={() => void addRecipeToBasket('tomato-egg-rice', 4)}>Add recipe</button>
    <button onClick={() => void addRecipeToBasket('tomato-egg-rice')}>Ensure recipe</button>
    <button onClick={() => void confirmBasket()}>Create groceries</button>
  </div>
}

function BootFailureProbe() {
  const { failure } = useBootSplash()
  return <GroceaLoadingSplash failure={failure} />
}

function DuplicatePantryProbe() {
  const { balances, activity, completeGroceryList } = useGrocea()
  const latest = activity[0]
  return <div>
    <span data-testid="rice-balance">{balances.rice?.toString() ?? '0'}</span>
    <span data-testid="change-count">{latest?.changes.length ?? 0}</span>
    <span data-testid="change-delta">{latest?.changes[0]?.delta.toString() ?? '0'}</span>
    <button onClick={() => void completeGroceryList('duplicate-list', ['rice-one', 'rice-two'])}>Complete duplicates</button>
  </div>
}

describe('GroceaProvider persistence', () => {
  it('opens provisional seed state while initial server state is unavailable', async () => {
    const storage = createGroceaStorage(crypto.randomUUID())
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))

    render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('initial-sync'))
    expect(screen.getByTestId('can-mutate').textContent).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await waitFor(() => expect(storage.listPendingMutations()).resolves.toHaveLength(0))
    await waitFor(() => expect(screen.getByTestId('boot-phase').textContent).toBe('ready'))
    expect(screen.getByTestId('profile-name').textContent).toBe(initialState.profile.displayName)
    expect(screen.getByTestId('ingredient-count').textContent).toBe(String(initialState.ingredients.length))
    expect(screen.getByTestId('sync-error').textContent).toBe('NETWORK_UNAVAILABLE:0:Backend API is unavailable.')
    await storage.destroy()
  })

  it('imports migrated local data before fetching the canonical remote state', async () => {
    const userId = crypto.randomUUID()
    const storage = new MemoryStorage()
    storage.state.profile.displayName = 'Legacy kitchen'
    const metadata: DatabaseMetadata = {
      key: 'database',
      schemaVersion: 4,
      seedVersion: 1,
      migrationStatus: 'none',
      deviceId: crypto.randomUUID(),
      syncCursor: null,
      remoteImportStatus: 'pending',
      importId: crypto.randomUUID(),
      importConflicts: [],
      ownerUserId: userId,
      legacyClaimed: true,
    }
    Object.assign(storage, {
      getMetadata: async () => ({ ...metadata }),
      saveMetadata: async (next: DatabaseMetadata) => { Object.assign(metadata, next) },
      saveCanonicalState: async (next: GroceaState) => { storage.state = cloneState(next) },
    })
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input)
      calls.push(url)
      if (url === '/api/imports/local-state') {
        return new Response(JSON.stringify({ revision: 3, id_map: {}, conflicts: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/state') return remoteStateResponse()
      throw new Error(`Unexpected request: ${url}`)
    }))

    render(<GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider>)

    await waitFor(() => expect(metadata.remoteImportStatus).toBe('complete'))
    expect(calls.indexOf('/api/imports/local-state')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('/api/imports/local-state')).toBeLessThan(calls.indexOf('/api/state'))
    expect(screen.getByTestId('can-mutate').textContent).toBe('true')
  })

  it('replaces provisional seed state after initial sync retry succeeds', async () => {
    const storage = createGroceaStorage(crypto.randomUUID())
    let attempts = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Failed to fetch')
      return remoteStateResponse()
    }))

    render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('initial-sync'))
    fireEvent.click(screen.getByRole('button', { name: 'Retry initial sync' }))
    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('idle'))
    expect(screen.getByTestId('profile-name').textContent).toBe('Remote Grocie')
    expect(screen.getByTestId('sync-error').textContent).toBe('')
    expect((await storage.getMetadata()).syncCursor).toBe('9')
    await storage.destroy()
  })

  it('waits for authenticated reconnect before synchronizing queued mutations', async () => {
    const storage = new MemoryStorage()
    const metadata: DatabaseMetadata = {
      key: 'database',
      schemaVersion: 4,
      seedVersion: 1,
      migrationStatus: 'none',
      deviceId: crypto.randomUUID(),
      syncCursor: '8',
      remoteImportStatus: 'complete',
      importId: crypto.randomUUID(),
      importConflicts: [],
      ownerUserId: crypto.randomUUID(),
    }
    let metadataAvailable = false
    Object.assign(storage, {
      getMetadata: async () => metadataAvailable ? ({ ...metadata }) : null,
      saveMetadata: async () => undefined,
      updateMutation: async (next: PendingMutation) => {
        storage.mutations = storage.mutations.map(item => item.id === next.id ? next : item)
      },
    })
    const mutation: PendingMutation = {
      id: crypto.randomUUID(),
      deviceId: metadata.deviceId,
      type: 'profile.update',
      createdAt: new Date().toISOString(),
      payload: { displayName: 'Reconnected', preferredServings: 2 },
      attempts: 0,
      status: 'pending',
      dependsOn: [],
    }
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url === '/api/profile') return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', 'X-State-Revision': '9' } })
      if (url === '/api/state') return remoteStateResponse()
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider>)
    await waitFor(() => expect(screen.getByTestId('boot-phase').textContent).toBe('ready'))
    metadataAvailable = true
    storage.mutations = [mutation]

    window.dispatchEvent(new Event('online'))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fetchMock).not.toHaveBeenCalled()

    setCsrfToken('csrf-token')
    window.dispatchEvent(new Event('grocea:auth-validated'))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/profile')).toBe(true))
  })

  it('keeps provisional seed state usable after reopening the account database offline', async () => {
    const userId = crypto.randomUUID()
    const firstStorage = createGroceaStorage(userId)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const firstView = render(<BootSplashProvider><GroceaProvider storage={firstStorage}><InitialSyncProbe /></GroceaProvider></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('initial-sync'))
    expect(screen.getByTestId('profile-name').textContent).toBe(initialState.profile.displayName)
    firstView.unmount()

    const reopenedStorage = createGroceaStorage(userId)
    const reopenedView = render(<BootSplashProvider><GroceaProvider storage={reopenedStorage}><InitialSyncProbe /></GroceaProvider></BootSplashProvider>)
    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('initial-sync'))
    expect(screen.getByTestId('profile-name').textContent).toBe(initialState.profile.displayName)
    reopenedView.unmount()
    await reopenedStorage.destroy()
  })

  it('keeps an initial authentication failure out of local-storage recovery', async () => {
    const storage = createGroceaStorage(crypto.randomUUID())
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })))
    const view = render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider><BootFailureProbe /></BootSplashProvider>)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByTestId('profile-name')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeNull()
    view.unmount()
    await storage.destroy()
  })

  it('resets corrupt account data to seed and starts the initial sync again', async () => {
    const userId = crypto.randomUUID()
    const storage = createGroceaStorage(userId)
    await storage.open()
    storage.close()
    const database = await openDB(`${DATABASE_NAME}:${userId}`, DATABASE_VERSION)
    await database.put('state', { key: 'current', value: { invalid: true } })
    database.close()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const view = render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider><BootFailureProbe /></BootSplashProvider>)

    expect(await screen.findByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset local data' }))
    expect(await screen.findByRole('heading', { name: 'Reset all local data?' })).toBeTruthy()
    const resetButtons = screen.getAllByRole('button', { name: 'Reset local data' })
    fireEvent.click(resetButtons[0])
    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('initial-sync'))
    expect(screen.getByTestId('profile-name').textContent).toBe(initialState.profile.displayName)
    expect((await storage.getMetadata()).syncCursor).toBeNull()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeNull())
    view.unmount()
    await storage.destroy()
  })

  it('reopens an existing account from its canonical snapshot when working state is corrupt', async () => {
    const userId = crypto.randomUUID()
    const storage = createGroceaStorage(userId)
    await storage.open()
    const existing = await storage.loadState()
    existing.profile.displayName = 'Existing account'
    await storage.saveCanonicalState(existing)
    await storage.saveMetadata({ ...(await storage.getMetadata()), syncCursor: '8', remoteImportStatus: 'complete' })
    storage.close()
    const database = await openDB(`${DATABASE_NAME}:${userId}`, DATABASE_VERSION)
    await database.put('state', { key: 'current', value: { invalid: true } })
    database.close()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const view = render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider><BootFailureProbe /></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Existing account'))
    expect(screen.getByTestId('boot-phase').textContent).toBe('ready')
    expect(screen.queryByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeNull()
    view.unmount()
    await storage.destroy()
  })

  it('keeps a valid existing account usable when remote sync is unavailable', async () => {
    const userId = crypto.randomUUID()
    const storage = createGroceaStorage(userId)
    await storage.open()
    const existing = await storage.loadState()
    existing.profile.displayName = 'Existing account'
    await storage.saveState(existing)
    await storage.saveMetadata({ ...(await storage.getMetadata()), syncCursor: '8', remoteImportStatus: 'complete' })
    storage.close()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const view = render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider><BootFailureProbe /></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Existing account'))
    await waitFor(() => expect(screen.getByTestId('sync-status').textContent).toBe('offline'))
    expect(screen.getByTestId('boot-phase').textContent).toBe('ready')
    expect(screen.queryByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeNull()
    view.unmount()
    await storage.destroy()
  })

  it('recovers an existing account from the server when local snapshots are invalid', async () => {
    const userId = crypto.randomUUID()
    const storage = createGroceaStorage(userId)
    await storage.open()
    await storage.saveMetadata({ ...(await storage.getMetadata()), syncCursor: '8', remoteImportStatus: 'complete' })
    storage.close()

    const database = await openDB(`${DATABASE_NAME}:${userId}`, DATABASE_VERSION)
    await database.put('state', { key: 'current', value: { invalid: true } })
    await database.delete('canonical', 'current')
    database.close()

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      expect(String(input)).toBe('/api/state')
      return remoteStateResponse()
    }))

    const view = render(<BootSplashProvider><GroceaProvider storage={storage}><InitialSyncProbe /></GroceaProvider><BootFailureProbe /></BootSplashProvider>)

    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Remote Grocie'))
    await waitFor(() => expect(screen.getByTestId('boot-phase').textContent).toBe('ready'))
    expect(screen.queryByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeNull()
    view.unmount()
    await storage.destroy()
  })

  it('reports boot failures through the shared splash recovery dialog', async () => {
    render(<BootSplashProvider><GroceaProvider storage={new FailingStorage()} /><BootFailureProbe /></BootSplashProvider>)

    expect(await screen.findByRole('heading', { name: 'Grocea couldn’t open your data' })).toBeTruthy()
    expect(screen.getByText('Stored Grocea data could not be reconciled.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('plans groceries optimistically while offline and queues Basket then confirmation mutations', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><GroceryProbe /></GroceaProvider>)
    await screen.findByRole('button', { name: 'Add recipe' })

    fireEvent.click(screen.getByRole('button', { name: 'Add recipe' }))
    await waitFor(() => expect(screen.getByTestId('basket-count').textContent).toBe('1'))
    expect(screen.getByTestId('basket-servings').textContent).toBe('4')

    fireEvent.click(screen.getByRole('button', { name: 'Create groceries' }))
    await waitFor(() => expect(screen.getByTestId('basket-count').textContent).toBe('0'))
    expect(screen.getByTestId('list-count').textContent).toBe('1')
    expect(Number(screen.getByTestId('list-items').textContent)).toBeGreaterThan(0)
    expect(storage.mutations.map(item => item.type)).toEqual([
      'basket.recipe.upsert',
      'grocery-list.create',
    ])
    expect(storage.mutations[1].dependsOn).toEqual([storage.mutations[0].id])
  })

  it('does not reset planned servings when a recipe is already in Basket', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><GroceryProbe /></GroceaProvider>)
    await screen.findByRole('button', { name: 'Add recipe' })

    fireEvent.click(screen.getByRole('button', { name: 'Add recipe' }))
    await waitFor(() => expect(screen.getByTestId('basket-servings').textContent).toBe('4'))
    fireEvent.click(screen.getByRole('button', { name: 'Ensure recipe' }))
    await waitFor(() => expect(screen.getByTestId('basket-servings').textContent).toBe('4'))
    expect(storage.mutations).toHaveLength(1)
  })

  it('aggregates duplicate catalog rows into one Pantry change while offline', async () => {
    const storage = new MemoryStorage()
    const now = '2026-07-31T00:00:00Z'
    storage.state.balances.rice = 0n
    storage.state.groceryLists = [{
      id: 'duplicate-list',
      title: 'Duplicate rice',
      status: 'active',
      recipes: [],
      items: [
        {
          id: 'rice-one',
          ingredientId: 'rice',
          label: 'Rice',
          categoryName: 'Pantry',
          family: 'mass',
          quantity: 300_000n,
          unit: 'g',
          checked: true,
          origin: 'manual',
          edited: false,
          sources: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'rice-two',
          ingredientId: 'rice',
          label: 'Rice',
          categoryName: 'Pantry',
          family: 'mass',
          quantity: 100_000n,
          unit: 'g',
          checked: true,
          origin: 'manual',
          edited: false,
          sources: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }]
    render(<GroceaProvider storage={storage}><DuplicatePantryProbe /></GroceaProvider>)
    await screen.findByRole('button', { name: 'Complete duplicates' })

    fireEvent.click(screen.getByRole('button', { name: 'Complete duplicates' }))

    await waitFor(() => expect(screen.getByTestId('rice-balance').textContent).toBe('400000'))
    expect(screen.getByTestId('change-count').textContent).toBe('1')
    expect(screen.getByTestId('change-delta').textContent).toBe('400000')
  })

  it('hydrates before rendering children and serializes rapid durable writes', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><Probe /></GroceaProvider>)
    expect(screen.queryByText('Your pantry is almost ready.')).toBeNull()
    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Grocie Crumbsworth'))

    fireEvent.click(screen.getByRole('button', { name: 'First' }))
    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Second'))
    expect(storage.saves).toEqual(['First', 'Second'])
    expect(storage.state.profile.displayName).toBe('Second')
    expect(storage.mutations.map(item => item.type)).toEqual(['profile.update', 'profile.update'])
  })

  it('keeps last committed UI state and blocks changes after a write failure', async () => {
    const storage = new MemoryStorage()
    storage.failWrites = true
    render(<GroceaProvider storage={storage}><Probe /></GroceaProvider>)
    await waitFor(() => expect(screen.getByTestId('profile-name').textContent).toBe('Grocie Crumbsworth'))
    fireEvent.click(screen.getByRole('button', { name: 'First' }))

    await screen.findByText('Changes are paused')
    expect(screen.getByText('Quota exceeded')).toBeTruthy()
    expect(screen.getByTestId('profile-name').textContent).toBe('Grocie Crumbsworth')
    expect(storage.state.profile.displayName).toBe('Grocie Crumbsworth')

    fireEvent.click(screen.getByRole('button', { name: 'Second' }))
    await waitFor(() => expect(storage.saves).toEqual([]))
  })

  it('clones every published recipe field into editable values without mutating the original', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><CloneProbe /></GroceaProvider>)
    await screen.findByRole('button', { name: 'Clone recipe' })
    fireEvent.click(screen.getByRole('button', { name: 'Clone recipe' }))
    const clone = JSON.parse((await screen.findByTestId('clone')).textContent ?? '{}')
    expect(clone.name).toBe('Tomato egg rice')
    expect(clone.description).toBe('A fast, comforting rice bowl with soft eggs and juicy tomatoes.')
    expect(clone.servings).toBe(2)
    expect(clone.ingredients).toEqual([
      { ingredientId: 'rice', quantity: '300', unit: 'g' },
      { ingredientId: 'eggs', quantity: '2', unit: 'item' },
      { ingredientId: 'tomatoes', quantity: '3', unit: 'item' },
    ])
    expect(clone.steps).toEqual(['Cook the rice until tender.', 'Scramble the eggs and set aside.', 'Cook tomatoes, return eggs, and serve over rice.'])
    expect(screen.getByTestId('source-status').textContent).toBe('published')
    expect(storage.state.recipes.find(recipe => recipe.id === 'tomato-egg-rice')?.status).toBe('published')
  })

  it('continues unrelated queued mutations after a permanent failure', async () => {
    const storage = new MemoryStorage()
    const metadata: DatabaseMetadata = {
      key: 'database',
      schemaVersion: 4,
      seedVersion: 1,
      migrationStatus: 'none',
      deviceId: crypto.randomUUID(),
      syncCursor: '8',
      remoteImportStatus: 'complete',
      importId: crypto.randomUUID(),
      importConflicts: [],
      ownerUserId: crypto.randomUUID(),
    }
    const failedId = crypto.randomUUID()
    const goodId = crypto.randomUUID()
    const ingredientId = crypto.randomUUID()
    storage.mutations = [
      {
        id: failedId,
        deviceId: metadata.deviceId,
        type: 'stock.operation',
        createdAt: '2026-08-01T00:00:00Z',
        payload: { eventId: crypto.randomUUID(), ingredientId, operation: 'add', amount: '1000', reason: 'Test' },
        attempts: 0,
        status: 'pending',
        dependsOn: [],
      },
      {
        id: goodId,
        deviceId: metadata.deviceId,
        type: 'profile.update',
        createdAt: '2026-08-01T00:00:01Z',
        payload: { displayName: 'Updated', preferredServings: 2 },
        attempts: 0,
        status: 'pending',
        dependsOn: [],
      },
    ]
    Object.assign(storage, {
      getMetadata: async () => ({ ...metadata }),
      saveMetadata: async () => undefined,
      updateMutation: async (next: PendingMutation) => {
        storage.mutations = storage.mutations.map(item => item.id === next.id ? next : item)
      },
    })
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.startsWith('/api/pantry-stocks/')) {
        return new Response(JSON.stringify({ code: 'VALIDATION_ERROR', message: 'Rejected', details: {} }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url === '/api/profile') return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GroceaProvider storage={storage}><SyncProbe /></GroceaProvider>)

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/profile')).toBe(true))
    expect(storage.mutations).toHaveLength(1)
    expect(storage.mutations[0]).toMatchObject({ id: failedId, status: 'failed' })
    expect(storage.mutations[0].error?.code).toBe('VALIDATION_ERROR')
  })

  it('remaps legacy IDs from an incomplete import before retrying queued stock operations', async () => {
    const riceId = '93de2904-5359-5dca-9c36-17611d9f7a86'
    const storage = new MemoryStorage()
    const metadata: DatabaseMetadata = {
      key: 'database',
      schemaVersion: 3,
      seedVersion: 1,
      migrationStatus: 'none',
      deviceId: '22222222-2222-4222-8222-222222222222',
      syncCursor: '3',
      remoteImportStatus: 'conflicts',
      importId: '11111111-1111-4111-8111-111111111111',
      importConflicts: [{ kind: 'recipe', localId: 'legacy-recipe', message: 'Backend Recipe already uses this name.' }],
    }
    storage.mutations = [{
      id: '44444444-4444-4444-8444-444444444444',
      deviceId: metadata.deviceId,
      type: 'stock.operation',
      createdAt: '2026-07-31T14:25:24Z',
      payload: {
        eventId: '33333333-3333-4333-8333-333333333333',
        ingredientId: 'rice',
        operation: 'add',
        amount: '1000',
        reason: 'Groceries',
      },
      attempts: 1,
      status: 'failed',
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', retryable: false },
      dependsOn: [],
    }]
    Object.assign(storage, {
      getMetadata: async () => ({ ...metadata }),
      saveMetadata: async (next: DatabaseMetadata) => { Object.assign(metadata, next) },
      updateMutation: async (next: PendingMutation) => {
        storage.mutations = storage.mutations.map(item => item.id === next.id ? next : item)
      },
      saveCanonicalState: async (state: GroceaState) => { storage.state = cloneState(state) },
    })
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input)
      if (url === '/api/imports/local-state') return new Response(JSON.stringify({
        revision: 3,
        id_map: { rice: riceId },
        conflicts: [{ kind: 'recipe', local_id: 'legacy-recipe', message: 'Backend Recipe already uses this name.' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url === `/api/pantry-stocks/${riceId}/operations`) {
        return new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } })
      }
      if (url === '/api/state') return new Response(JSON.stringify({
        revision: 4,
        profile: {
          id: '55555555-5555-4555-8555-555555555555',
          display_name: 'Grocie Crumbsworth',
          preferred_servings: 2,
          measurement_system: 'metric',
          created_at: '2026-07-31T00:00:00Z',
          updated_at: '2026-07-31T00:00:00Z',
        },
        categories: [],
        ingredients: [],
        pantry_stocks: [],
        recipes: [],
        activity: [],
        basket: { items: [] },
        grocery_lists: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<GroceaProvider storage={storage}><SyncProbe /></GroceaProvider>)
    await waitFor(() => expect((storage.mutations[0].payload as { ingredientId: string }).ingredientId).toBe(riceId))
    fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }))
    await waitFor(() => expect(screen.getByTestId('queued-count').textContent).toBe('0'))

    expect(fetchMock.mock.calls.some(([url]) => String(url) === `/api/pantry-stocks/${riceId}/operations`)).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/pantry-stocks/rice/operations')).toBe(false)
    expect(metadata.remoteImportStatus).toBe('conflicts')
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/state')).toBe(false)
  })
})
