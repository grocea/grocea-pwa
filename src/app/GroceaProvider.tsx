import { useMemo, useReducer, type ReactNode } from 'react'
import type { ActivityEvent, GroceaState, Ingredient, Recipe, StockOperation } from '../domain/types'
import { initialState } from './fixtures'
import { GroceaContext, type GroceaContextValue } from './grocea-context'

type Action =
  | { type: 'stock'; ingredientId: string; operation: StockOperation; amount: bigint; reason: string }
  | { type: 'ingredient'; ingredient: Ingredient }
  | { type: 'recipe'; recipe: Recipe }
  | { type: 'cook'; event: ActivityEvent }
  | { type: 'reverse'; eventId: string; reversal: ActivityEvent }
  | { type: 'category'; id: string; name: string }
  | { type: 'profile'; displayName: string; preferredServings: number }

function reducer(state: GroceaState, action: Action): GroceaState {
  if (action.type === 'ingredient') return { ...state, ingredients: [...state.ingredients, action.ingredient] }
  if (action.type === 'recipe') return { ...state, recipes: [...state.recipes, action.recipe] }
  if (action.type === 'category') return { ...state, categories: [...state.categories, { id: action.id, name: action.name, scope: 'custom' }] }
  if (action.type === 'profile') return { ...state, profile: { ...state.profile, displayName: action.displayName, preferredServings: action.preferredServings } }
  if (action.type === 'stock') {
    const current = state.balances[action.ingredientId] ?? 0n
    const next = action.operation === 'set' ? action.amount : action.operation === 'add' ? current + action.amount : current - action.amount
    const ingredient = state.ingredients.find(item => item.id === action.ingredientId)
    const verb = action.operation === 'set' ? 'Set' : action.operation === 'add' ? 'Added' : 'Removed'
    const event: ActivityEvent = { id: crypto.randomUUID(), type: 'manual', title: `${verb} ${ingredient?.name ?? 'ingredient'}`, detail: action.reason || 'Manual adjustment', occurredAt: new Date().toISOString(), changes: [{ ingredientId: action.ingredientId, before: current, delta: next - current, after: next }] }
    return { ...state, balances: { ...state.balances, [action.ingredientId]: next }, activity: [event, ...state.activity] }
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
  return { ...state, balances, activity: [action.reversal, ...state.activity.map(event => event.id === action.eventId ? { ...event, reversedAt: action.reversal.occurredAt } : event)] }
}

export function GroceaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo<GroceaContextValue>(() => ({
    ...state,
    categoryName: id => state.categories.find(item => item.id === id)?.name ?? 'Other',
    ingredient: id => state.ingredients.find(item => item.id === id),
    adjustStock: (ingredientId, operation, amount, reason) => dispatch({ type: 'stock', ingredientId, operation, amount, reason }),
    createIngredient: (name, categoryId, family) => { const id = crypto.randomUUID(); dispatch({ type: 'ingredient', ingredient: { id, name, categoryId, family, scope: 'custom' } }); return id },
    createRecipe: recipe => { const id = crypto.randomUUID(); dispatch({ type: 'recipe', recipe: { ...recipe, id, scope: 'custom' } }); return id },
    cookRecipe: (recipeId, servings, changes) => { const id = crypto.randomUUID(); const recipe = state.recipes.find(item => item.id === recipeId); dispatch({ type: 'cook', event: { id, type: 'cooking', title: `Cooked ${recipe?.name ?? 'recipe'}`, detail: `${servings} serving${servings === 1 ? '' : 's'} · ${changes.length} stock changes`, occurredAt: new Date().toISOString(), recipeId, servings, changes } }); return id },
    reverseEvent: eventId => { const original = state.activity.find(event => event.id === eventId); if (!original || original.reversedAt) return; const occurredAt = new Date().toISOString(); const changes = original.changes.map(change => { const before = state.balances[change.ingredientId] ?? 0n; return { ingredientId: change.ingredientId, before, delta: -change.delta, after: before - change.delta } }); dispatch({ type: 'reverse', eventId, reversal: { id: crypto.randomUUID(), type: 'reversal', title: 'Cooking undone', detail: `${original.title.replace(/^Cooked /, '')} · Stock restored`, occurredAt, reversalOf: eventId, changes } }) },
    createCategory: name => dispatch({ type: 'category', id: crypto.randomUUID(), name }),
    updateProfile: (displayName, preferredServings) => dispatch({ type: 'profile', displayName, preferredServings }),
  }), [state])
  return <GroceaContext.Provider value={value}>{children}</GroceaContext.Provider>
}
