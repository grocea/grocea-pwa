import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { ActivityEvent, DraftRecipe, GroceaState, Ingredient, PublishedRecipe, StockOperation } from '../domain/types'
import { isPublishedRecipe } from '../domain/types'
import { familyUnits, parseQuantity } from '../shared/lib/quantity'
import { initialState } from './fixtures'
import { GroceaContext, type GroceaContextValue } from './grocea-context'
import { hydrateState, persistUserContent } from './persistence'

type Action =
  | { type: 'stock'; ingredientId: string; operation: StockOperation; amount: bigint; reason: string }
  | { type: 'ingredient'; ingredient: Ingredient; createStock: boolean }
  | { type: 'recipe-create'; recipe: DraftRecipe }
  | { type: 'recipe-update'; id: string; patch: Partial<Pick<DraftRecipe, 'name' | 'description' | 'baseServings' | 'ingredients' | 'steps'>>; updatedAt: string }
  | { type: 'recipe-delete'; id: string }
  | { type: 'recipe-publish'; recipe: PublishedRecipe }
  | { type: 'cook'; event: ActivityEvent }
  | { type: 'reverse'; eventId: string; reversal: ActivityEvent }
  | { type: 'category'; id: string; name: string }
  | { type: 'profile'; displayName: string; preferredServings: number }

function reducer(state: GroceaState, action: Action): GroceaState {
  if (action.type === 'ingredient') return { ...state, ingredients: [...state.ingredients, action.ingredient], balances: action.createStock ? { ...state.balances, [action.ingredient.id]: 0n } : state.balances }
  if (action.type === 'recipe-create') return state.recipes.some(recipe => recipe.id === action.recipe.id) ? state : { ...state, recipes: [...state.recipes, action.recipe] }
  if (action.type === 'recipe-update') return { ...state, recipes: state.recipes.map(recipe => recipe.id === action.id && recipe.status === 'draft' ? { ...recipe, ...action.patch, updatedAt: action.updatedAt } : recipe) }
  if (action.type === 'recipe-delete') return { ...state, recipes: state.recipes.filter(recipe => !(recipe.id === action.id && recipe.status === 'draft')) }
  if (action.type === 'recipe-publish') return { ...state, recipes: state.recipes.map(recipe => recipe.id === action.recipe.id ? action.recipe : recipe) }
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
  const [state, dispatch] = useReducer(reducer, initialState, hydrateState)
  useEffect(() => persistUserContent(state), [state])
  const value = useMemo<GroceaContextValue>(() => ({
    ...state,
    categoryName: id => state.categories.find(item => item.id === id)?.name ?? 'Other',
    ingredient: id => state.ingredients.find(item => item.id === id),
    adjustStock: (ingredientId, operation, amount, reason) => dispatch({ type: 'stock', ingredientId, operation, amount, reason }),
    createIngredient: (name, categoryId, family, createStock = false) => { const id = crypto.randomUUID(); dispatch({ type: 'ingredient', ingredient: { id, name, categoryId, family, scope: 'custom' }, createStock }); return id },
    createRecipeDraft: () => { const id = crypto.randomUUID(); const now = new Date().toISOString(); dispatch({ type: 'recipe-create', recipe: { id, status: 'draft', scope: 'custom', name: '', description: '', baseServings: state.profile.preferredServings, ingredients: [], steps: [''], createdAt: now, updatedAt: now } }); return id },
    updateRecipeDraft: (id, patch) => dispatch({ type: 'recipe-update', id, patch, updatedAt: new Date().toISOString() }),
    deleteRecipeDraft: id => dispatch({ type: 'recipe-delete', id }),
    publishRecipeDraft: id => {
      const draft = state.recipes.find((recipe): recipe is DraftRecipe => recipe.id === id && recipe.status === 'draft')
      if (!draft || !draft.name.trim() || draft.name.trim().length > 120 || draft.baseServings < 1 || !draft.steps.some(step => step.trim()) || !draft.ingredients.length) return false
      const ingredients = draft.ingredients.flatMap(item => {
        const source = state.ingredients.find(ingredient => ingredient.id === item.ingredientId)
        const quantity = parseQuantity(item.quantity, item.unit)
        return source && familyUnits[source.family].includes(item.unit) && quantity !== null && quantity > 0n ? [{ ingredientId: item.ingredientId, quantity, unit: item.unit }] : []
      })
      if (ingredients.length !== draft.ingredients.length || new Set(ingredients.map(item => item.ingredientId)).size !== ingredients.length) return false
      dispatch({ type: 'recipe-publish', recipe: { id: draft.id, status: 'published', scope: 'custom', name: draft.name.trim(), description: draft.description.trim(), baseServings: draft.baseServings, ingredients, steps: draft.steps.map(step => step.trim()).filter(Boolean) } })
      return true
    },
    cookRecipe: (recipeId, servings, changes) => { const id = crypto.randomUUID(); const recipe = state.recipes.find(item => item.id === recipeId && isPublishedRecipe(item)); dispatch({ type: 'cook', event: { id, type: 'cooking', title: `Cooked ${recipe?.name ?? 'recipe'}`, detail: `${servings} serving${servings === 1 ? '' : 's'} · ${changes.length} stock changes`, occurredAt: new Date().toISOString(), recipeId, servings, changes } }); return id },
    reverseEvent: eventId => { const original = state.activity.find(event => event.id === eventId); if (!original || original.reversedAt) return; const occurredAt = new Date().toISOString(); const changes = original.changes.map(change => { const before = state.balances[change.ingredientId] ?? 0n; return { ingredientId: change.ingredientId, before, delta: -change.delta, after: before - change.delta } }); dispatch({ type: 'reverse', eventId, reversal: { id: crypto.randomUUID(), type: 'reversal', title: 'Cooking undone', detail: `${original.title.replace(/^Cooked /, '')} · Stock restored`, occurredAt, reversalOf: eventId, changes } }) },
    createCategory: name => dispatch({ type: 'category', id: crypto.randomUUID(), name }),
    updateProfile: (displayName, preferredServings) => dispatch({ type: 'profile', displayName, preferredServings }),
  }), [state])
  return <GroceaContext.Provider value={value}>{children}</GroceaContext.Provider>
}
