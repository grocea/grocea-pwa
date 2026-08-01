import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import type { PendingMutation } from '../src/domain/types'
import { initialState } from '../src/app/fixtures'
import {
  cloneState,
  createGroceaStorage,
  DATABASE_NAME,
  DATABASE_VERSION,
  deleteLegacyStorage,
  IndexedDbGroceaStorage,
  legacyStorageExists,
  LEGACY_STORAGE_KEY,
  migrateLegacyStorage,
} from '../src/app/persistence'

const databaseName = () => `grocea-test-${crypto.randomUUID()}`

describe('IndexedDbGroceaStorage', () => {
  it('adds empty Basket and Grocery List history when loading pre-v4 state', async () => {
    const name = databaseName()
    const first = new IndexedDbGroceaStorage(initialState, name)
    await first.open()
    const database = await openDB(name, DATABASE_VERSION)
    const oldState = cloneState(initialState) as unknown as Record<string, unknown>
    delete oldState.basket
    delete oldState.groceryLists
    await database.put('state', { key: 'current', value: oldState })

    const reopened = new IndexedDbGroceaStorage(initialState, name)
    await reopened.open()
    const migrated = await reopened.loadState()
    expect(migrated.basket).toEqual([])
    expect(migrated.groceryLists).toEqual([])
  })

  it('boots from fixtures and round-trips bigint user state', async () => {
    const name = databaseName()
    const storage = new IndexedDbGroceaStorage(initialState, name)
    await storage.open()
    const fresh = await storage.loadState()
    expect(fresh.balances.rice).toBe(2_400_000n)

    const changed = cloneState(fresh)
    changed.profile.displayName = 'Offline Grocie Crumbsworth'
    changed.profile.preferredServings = 5
    changed.balances.rice = 9_876_543_210n
    changed.categories.push({ id: 'ferments', name: 'Ferments', scope: 'custom' })
    changed.ingredients.push({ id: 'kimchi', name: 'Kimchi', categoryId: 'ferments', family: 'mass', scope: 'custom' })
    changed.balances.kimchi = 500_000n
    changed.activity.unshift({
      id: 'offline-event',
      type: 'manual',
      title: 'Added Kimchi',
      detail: 'Offline test',
      occurredAt: new Date().toISOString(),
      changes: [{ ingredientId: 'kimchi', before: 0n, delta: 500_000n, after: 500_000n }],
    })
    await storage.saveState(changed)

    const reopened = new IndexedDbGroceaStorage(initialState, name)
    await reopened.open()
    const restored = await reopened.loadState()
    expect(restored.profile).toMatchObject({ displayName: 'Offline Grocie Crumbsworth', preferredServings: 5 })
    expect(restored.balances.rice).toBe(9_876_543_210n)
    expect(restored.balances.kimchi).toBe(500_000n)
    expect(restored.activity[0].changes[0].delta).toBe(500_000n)
  })

  it('creates account-scoped metadata without fixture state', async () => {
    const userId = crypto.randomUUID()
    const storage = createGroceaStorage(userId)
    await storage.open()
    expect((await storage.getMetadata()).ownerUserId).toBe(userId)
    await expect(storage.loadState()).rejects.toThrow('corrupt or incompatible')
    await storage.destroy()
  })

  it('claims a legacy database before syncing and leaves a recovery copy', async () => {
    await deleteLegacyStorage()
    const legacy = new IndexedDbGroceaStorage(initialState, DATABASE_NAME)
    await legacy.open()
    const state = await legacy.loadState()
    state.profile.displayName = 'Legacy kitchen'
    await legacy.saveState(state)
    legacy.close()

    const userId = crypto.randomUUID()
    await expect(legacyStorageExists()).resolves.toBe(true)
    await migrateLegacyStorage(userId)
    expect(await legacyStorageExists()).toBe(true)

    const account = createGroceaStorage(userId)
    await account.open()
    expect((await account.loadState()).profile.displayName).toBe('Legacy kitchen')
    expect((await account.getMetadata()).legacyClaimed).toBe(true)
    await account.destroy()
    await deleteLegacyStorage()
  })

  it('migrates valid legacy content once and removes its key after commit', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      version: 1,
      categories: [{ id: 'legacy-category', name: 'Legacy', scope: 'custom' }],
      ingredients: [{ id: 'legacy-item', name: 'Legacy item', categoryId: 'legacy-category', family: 'mass', scope: 'custom' }],
      recipes: [{ id: 'legacy-recipe', status: 'published', scope: 'custom', name: 'Legacy recipe', description: '', baseServings: 1, ingredients: [{ ingredientId: 'legacy-item', quantity: '1000', unit: 'g' }], steps: ['Use it'] }],
    }))
    const storage = new IndexedDbGroceaStorage(initialState, databaseName())
    await storage.open()
    const state = await storage.loadState()
    expect(state.ingredients).toContainEqual(expect.objectContaining({ id: 'legacy-item' }))
    expect(state.recipes).toContainEqual(expect.objectContaining({ id: 'legacy-recipe' }))
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })

  it('ignores malformed legacy content without corrupting defaults', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{bad json')
    const storage = new IndexedDbGroceaStorage(initialState, databaseName())
    await storage.open()
    const state = await storage.loadState()
    expect(state.profile).toEqual(initialState.profile)
    expect(state.ingredients).toHaveLength(initialState.ingredients.length)
  })

  it('refreshes global fixtures while preserving custom and user-owned data', async () => {
    const name = databaseName()
    const first = new IndexedDbGroceaStorage(initialState, name)
    await first.open()
    const persisted = await first.loadState()
    persisted.profile.displayName = 'Kept user'
    persisted.categories.push({ id: 'mine', name: 'Mine', scope: 'custom' })
    await first.saveState(persisted)

    const updatedSeed = cloneState(initialState)
    updatedSeed.ingredients = updatedSeed.ingredients.map(item => item.id === 'rice' ? { ...item, name: 'Updated rice' } : item)
    const second = new IndexedDbGroceaStorage(updatedSeed, name)
    await second.open()
    const reconciled = await second.loadState()
    expect(reconciled.ingredients.find(item => item.id === 'rice')?.name).toBe('Updated rice')
    expect(reconciled.categories).toContainEqual(expect.objectContaining({ id: 'mine' }))
    expect(reconciled.profile.displayName).toBe('Kept user')
  })

  it('supports the typed outbox lifecycle', async () => {
    const storage = new IndexedDbGroceaStorage(initialState, databaseName())
    await storage.open()
    const mutation: PendingMutation = { id: crypto.randomUUID(), deviceId: crypto.randomUUID(), type: 'profile.updated', createdAt: '2026-07-18T12:00:00Z', payload: { displayName: 'Grocie Crumbsworth' }, attempts: 0, status: 'pending', dependsOn: [] }
    await storage.enqueueMutation(mutation)
    expect(await storage.listPendingMutations()).toEqual([mutation])
    await storage.removeMutation(mutation.id)
    expect(await storage.listPendingMutations()).toEqual([])
  })

  it('rejects corrupt IndexedDB state instead of overwriting it', async () => {
    const name = databaseName()
    const storage = new IndexedDbGroceaStorage(initialState, name)
    await storage.open()
    const database = await openDB(name, DATABASE_VERSION)
    await database.put('state', { key: 'current', value: { invalid: true } })
    await expect(storage.loadState()).rejects.toThrow('corrupt or incompatible')
  })
})
