import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { GroceaProvider } from '../src/app/GroceaProvider'
import { initialState } from '../src/app/fixtures'
import { cloneState, type GroceaStorage } from '../src/app/persistence'
import type { GroceaState, PendingMutation } from '../src/domain/types'
import { RecipeEditorScreen } from '../src/features/recipes/RecipeEditorScreens'

class DelayedStorage implements GroceaStorage {
  state = cloneState(initialState)
  mutations: PendingMutation[] = []

  constructor(private readonly delayMs: number) {}

  async open() {}
  async loadState() { return cloneState(this.state) }
  async saveState(state: GroceaState) {
    await new Promise(resolve => setTimeout(resolve, this.delayMs))
    this.state = cloneState(state)
  }
  async enqueueMutation(mutation: PendingMutation) { this.mutations.push(mutation) }
  async listPendingMutations() { return this.mutations }
  async removeMutation(id: string) { this.mutations = this.mutations.filter(item => item.id !== id) }
  async reset() { this.state = cloneState(initialState); return cloneState(this.state) }
}

describe('recipe editor', () => {
  it('keeps rapid recipe name input while autosave is in flight', async () => {
    const storage = new DelayedStorage(10)
    storage.state.recipes.push({
      id: 'draft-id',
      status: 'draft',
      scope: 'custom',
      name: '',
      description: '',
      baseServings: 2,
      ingredients: [],
      steps: [''],
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    })

    render(<GroceaProvider storage={storage}><MemoryRouter initialEntries={['/recipes/draft-id/edit/basics']}><Routes><Route path="/recipes/:id/edit/:stage" element={<RecipeEditorScreen />} /></Routes></MemoryRouter></GroceaProvider>)
    const input = await screen.findByPlaceholderText('Recipe name')

    for (const character of 'ab') {
      const next = `${(input as HTMLInputElement).value}${character}`
      fireEvent.input(input, { target: { value: next } })
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    await waitFor(() => expect((input as HTMLInputElement).value).toBe('ab'), { timeout: 1000 })
    await waitFor(() => expect(storage.state.recipes.find(recipe => recipe.id === 'draft-id')?.name).toBe('ab'), { timeout: 1000 })
  })
})
