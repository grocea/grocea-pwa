import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GroceaProvider } from '../src/app/GroceaProvider'
import { initialState } from '../src/app/fixtures'
import { cloneState, type GroceaStorage } from '../src/app/persistence'
import type { GroceaState, PendingMutation } from '../src/domain/types'
import { ActivityListScreen } from '../src/features/activity/ActivityScreens'
import { CategoriesScreen, SyncIssuesScreen } from '../src/features/more/MoreScreens'
import { AddStockScreen, PantryScreen } from '../src/features/pantry/screens'
import { RecipeListScreen } from '../src/features/recipes/RecipeScreens'
import { BasketScreen, GroceriesScreen, GroceryListScreen } from '../src/features/groceries/GroceryScreens'
import { usePendingAction } from '../src/shared/lib/usePendingAction'
import { BackHeader, PageHeading } from '../src/shared/ui/AppShell'
import { ConfirmDialog } from '../src/shared/ui/ConfirmDialog'
import { RouteTransitionManager } from '../src/shared/ui/RouteTransitionManager'

class MemoryStorage implements GroceaStorage {
  state = cloneState(initialState)
  mutations: PendingMutation[] = []
  async open() {}
  async loadState() { return cloneState(this.state) }
  async saveState(state: GroceaState) { this.state = cloneState(state) }
  async enqueueMutation(mutation: PendingMutation) { this.mutations.push(mutation) }
  async listPendingMutations() { return this.mutations }
  async removeMutation(id: string) { this.mutations = this.mutations.filter(item => item.id !== id) }
  async reset() { this.state = cloneState(initialState); return cloneState(this.state) }
}

function renderRoute(element: React.ReactNode, initialEntry: string, storage = new MemoryStorage(), extraRoutes?: React.ReactNode) {
  return { storage, ...render(<GroceaProvider storage={storage}><MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="*" element={element} />{extraRoutes}</Routes></MemoryRouter></GroceaProvider>) }
}

describe('stock and catalog recovery', () => {
  it('groups pantry stock by category and flattens filtered search results', async () => {
    renderRoute(<PantryScreen />, '/pantry')

    const pantryGroup = await screen.findByRole('region', { name: 'Pantry staples' })
    expect(within(pantryGroup).getByRole('link', { name: 'Adjust stock for Basmati rice, 2.4 kg available' })).toBeTruthy()
    expect(screen.queryByText('Adjust')).toBeNull()

    fireEvent.change(screen.getByLabelText('Search pantry ingredients'), { target: { value: 'Basmati' } })
    const results = screen.getByRole('region', { name: 'Search results' })
    expect(within(results).getByText('Pantry staples')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Produce' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Search pantry ingredients'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Needs restock/ }))
    const produceGroup = screen.getByRole('region', { name: 'Produce' })
    expect(within(produceGroup).getByRole('link', { name: 'Adjust stock for Bananas, 0 items available' })).toBeTruthy()
  })

  it('validates quantity on blur and submit, then focuses the invalid quantity', async () => {
    renderRoute(<AddStockScreen />, '/pantry/stock/new?ingredient=rice')
    const quantity = await screen.findByLabelText('Quantity')
    fireEvent.change(quantity, { target: { value: 'abc' } })
    fireEvent.blur(quantity)
    expect((await screen.findByRole('alert')).textContent).toContain('greater than zero')
    expect(quantity.getAttribute('aria-invalid')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Add abc kg$/ }))
    expect(document.activeElement).toBe(quantity)
  })

  it('defaults stock reason to Manual and returns a prefilled recovery to its recipe', async () => {
    renderRoute(<AddStockScreen />, '/pantry/stock/new?ingredient=carrots&quantity=2&unit=item&returnTo=%2Frecipes%2Ffried-rice', undefined, <Route path="/recipes/fried-rice" element={<div>Recipe returned</div>} />)
    await screen.findByLabelText('Quantity')
    expect((screen.getByLabelText('Reason') as HTMLSelectElement).value).toBe('Manual adjustment')
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 item' }))
    expect(await screen.findByText('Recipe returned')).toBeTruthy()
  })

  it('shows duplicate category feedback and restores focus to the name', async () => {
    renderRoute(<CategoriesScreen />, '/categories')
    await screen.findByRole('heading', { name: 'Categories' })
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    const input = screen.getByPlaceholderText('Category name')
    fireEvent.change(input, { target: { value: 'Produce' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect((await screen.findByRole('alert')).textContent).toContain('already exists')
    expect(document.activeElement).toBe(input)
  })
})

describe('pending and destructive actions', () => {
  it('runs a rapid double click only once', async () => {
    let resolve!: () => void
    const action = vi.fn(() => new Promise<void>(done => { resolve = done }))
    function Harness() {
      const pendingAction = usePendingAction(action)
      return <button disabled={pendingAction.pending} onClick={() => void pendingAction.run()}>Run</button>
    }
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Run' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(action).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  })

  it('supports Cancel, Escape, focus restoration, pending lock, and confirmation', async () => {
    let resolve!: () => void
    const confirm = vi.fn(() => new Promise<void>(done => { resolve = done }))
    function Harness() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>Open reset</button><ConfirmDialog open={open} title="Reset?" description="Cannot be undone." confirmLabel="Reset" pendingLabel="Resetting…" onDismiss={() => setOpen(false)} onConfirm={confirm} /></>
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open reset' })
    opener.focus()
    fireEvent.click(opener)
    const cancel = await screen.findByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(opener))
    fireEvent.click(opener)
    const confirmButton = await screen.findByRole('button', { name: 'Reset' })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Resetting…' }) as HTMLButtonElement).disabled).toBe(true)
    resolve()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('keeps a rejected mutation and its dependent when discard is cancelled', async () => {
    const storage = new MemoryStorage()
    const base = { deviceId: 'device', createdAt: new Date().toISOString(), payload: {}, attempts: 1, status: 'failed' as const, error: { code: 'FAILED', message: 'Nope', retryable: false }, serverRevision: undefined }
    storage.mutations = [
      { ...base, id: 'parent', type: 'ingredient.create', dependsOn: [] },
      { ...base, id: 'child', type: 'stock.adjust', dependsOn: ['parent'] },
    ]
    renderRoute(<SyncIssuesScreen />, '/sync-issues', storage)
    const discardButtons = await screen.findAllByRole('button', { name: /Discard local change/ })
    fireEvent.click(discardButtons[0])
    expect(screen.getByText(/every dependent queued change/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(storage.mutations.map(item => item.id)).toEqual(['parent', 'child'])
  })
})

describe('navigation and selection semantics', () => {
  it('moves a Recipe through Basket into an active Grocery List and completes it with Pantry preview', async () => {
    const storage = new MemoryStorage()
    render(<GroceaProvider storage={storage}><MemoryRouter initialEntries={['/recipes']}><Routes>
      <Route path="/recipes" element={<RecipeListScreen />} />
      <Route path="/recipes/basket" element={<BasketScreen />} />
      <Route path="/groceries" element={<GroceriesScreen />} />
      <Route path="/groceries/:id" element={<GroceryListScreen />} />
    </Routes></MemoryRouter></GroceaProvider>)
    await screen.findByRole('heading', { name: 'Recipes' })
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Chickpea bowl to Basket' }))
    await screen.findByRole('button', { name: 'Chickpea bowl is in Basket' })
    fireEvent.click(screen.getByRole('link', { name: 'Basket, 1 recipe' }))

    expect(await screen.findByRole('heading', { name: 'Plan your groceries' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create Grocery List' }))
    expect(await screen.findByText('Grocery List created from your Basket.')).toBeTruthy()
    const purchase = screen.getAllByRole('checkbox')[0]
    fireEvent.click(purchase)
    await waitFor(() => expect((purchase as HTMLInputElement).checked).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Complete list' }))
    expect(await screen.findByRole('heading', { name: 'Complete Grocery List?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Update Pantry & complete/ }))
    expect(await screen.findByRole('heading', { name: 'Groceries' })).toBeTruthy()
    expect(screen.getByText('Grocery List completed.')).toBeTruthy()
  })

  it('exposes pressed state for recipe and activity filters', async () => {
    const { unmount } = renderRoute(<RecipeListScreen />, '/recipes')
    const ready = await screen.findByRole('button', { name: 'Ready' })
    expect(ready.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    unmount()
    renderRoute(<ActivityListScreen />, '/activity')
    const cooking = await screen.findByRole('button', { name: 'Cooking' })
    fireEvent.click(cooking)
    expect(cooking.getAttribute('aria-pressed')).toBe('true')
  })

  it('offers a recovery path when no recipes are fully stocked', async () => {
    const storage = new MemoryStorage()
    storage.state.balances = Object.fromEntries(Object.keys(storage.state.balances).map(id => [id, 0n]))
    renderRoute(<RecipeListScreen />, '/recipes', storage)
    await screen.findByRole('heading', { name: 'No recipes ready yet' })
    fireEvent.click(screen.getByRole('button', { name: 'View all recipes' }))
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows readiness and ownership as independent recipe labels', async () => {
    renderRoute(<RecipeListScreen />, '/recipes')
    await screen.findByRole('heading', { name: 'Recipes' })
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    const customCard = screen.getByRole('link', { name: /Chickpea bowl/ })
    expect(customCard.textContent).toContain('CHECK 1')
    expect(within(customCard).getByRole('img', { name: 'Your recipe' })).toBeTruthy()
    const globalCard = screen.getByRole('link', { name: /Oat porridge/ })
    expect(globalCard.textContent).toContain('READY')
    expect(within(globalCard).queryByRole('img', { name: 'Your recipe' })).toBeNull()
  })

  it('keeps activity-history details behind contextual help', async () => {
    renderRoute(<ActivityListScreen />, '/activity')
    await screen.findByRole('heading', { name: 'Activity history' })
    expect(screen.queryByText('Immutable history')).toBeNull()
    const trigger = screen.getByRole('button', { name: 'About activity history' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(await screen.findByRole('heading', { name: 'Why records stay unchanged' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('uses the logical fallback for a deep-linked back action', () => {
    render(<MemoryRouter initialEntries={['/deep']}><Routes><Route path="/deep" element={<BackHeader title="Deep page" fallbackTo="/recipes" />} /><Route path="/recipes" element={<div>Recipe parent</div>} /></Routes></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(screen.getByText('Recipe parent')).toBeTruthy()
  })

  it('updates the title and focuses the next page heading on pathname changes', async () => {
    function First() { const navigate = useNavigate(); return <><PageHeading title="First" /><button onClick={() => navigate('/second')}>Next page</button></> }
    function LocationProbe() { const location = useLocation(); return <span>{location.pathname}</span> }
    render(<MemoryRouter initialEntries={['/first']}><RouteTransitionManager /><LocationProbe /><Routes><Route path="/first" element={<First />} /><Route path="/second" element={<PageHeading title="Second" />} /></Routes></MemoryRouter>)
    await waitFor(() => expect(document.title).toBe('First · Grocea'))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    const heading = await screen.findByRole('heading', { name: 'Second' })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(document.title).toBe('Second · Grocea')
  })
})
