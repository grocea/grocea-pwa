import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GroceaProvider } from '../src/app/GroceaProvider'
import { initialState } from '../src/app/fixtures'
import { useGrocea } from '../src/app/grocea-context'
import { cloneState, type GroceaStorage } from '../src/app/persistence'
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
})
