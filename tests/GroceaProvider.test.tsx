import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroceaProvider } from '../src/app/GroceaProvider'
import { initialState } from '../src/app/fixtures'
import { useGrocea } from '../src/app/grocea-context'
import { cloneState, type DatabaseMetadata, type GroceaStorage } from '../src/app/persistence'
import type { GroceaState, PendingMutation } from '../src/domain/types'

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

afterEach(() => vi.unstubAllGlobals())

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

describe('GroceaProvider persistence', () => {
  it('hydrates before rendering children and serializes rapid durable writes', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><Probe /></GroceaProvider>)
    expect(screen.getByText('Opening Grocea…')).toBeTruthy()
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
    expect(metadata.remoteImportStatus).toBe('complete')
  })
})
