import type { GroceaState } from '../domain/types'
import { initialState } from './fixtures'
import { IndexedDbGroceaStorage } from './persistence'

// Vite replaces DEV with false in every production build, regardless of env flags.
export const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
export const demoAccount = { id: 'development-demo', email: 'demo@grocea.test' }

export function createDemoStorage() {
  const now = new Date().toISOString()
  const seed: GroceaState = {
    ...structuredClone(initialState),
    profile: { displayName: 'Demo kitchen', measurementSystem: 'metric', preferredServings: 2 },
    // Keep an untracked catalog item available for testing track/untrack.
    trackedIngredientIds: initialState.trackedIngredientIds.filter(id => id !== 'cucumber'),
    basket: [{ recipeId: 'fried-rice', recipeName: 'Vegetable fried rice', servings: 2, baseServings: 2, valid: true }],
    recipes: [...structuredClone(initialState.recipes), {
      id: 'demo-draft', status: 'draft', scope: 'custom', name: 'Breakfast pancakes',
      description: 'A draft to try the recipe editor.', baseServings: 2,
      ingredients: [{ ingredientId: 'flour', quantity: '150', unit: 'g' }, { ingredientId: 'milk', quantity: '200', unit: 'ml' }],
      steps: ['Mix the ingredients.', 'Cook in a warm pan.'], createdAt: now, updatedAt: now,
    }],
    groceryLists: [{
      id: 'demo-groceries', title: 'This week’s groceries', status: 'active', recipes: [],
      createdAt: now, updatedAt: now,
      items: [{
        id: 'demo-carrots', ingredientId: 'carrots', label: 'Carrots', categoryName: 'Produce',
        family: 'count', quantity: 2_000n, unit: 'item', checked: false,
        origin: 'manual', edited: false, sources: [], createdAt: now, updatedAt: now,
      }],
    }, {
      id: 'demo-completed', title: 'Last grocery run', status: 'completed', recipes: [],
      items: [], createdAt: now, updatedAt: now, completedAt: now,
    }],
    activity: initialState.activity.map(event => ({ ...structuredClone(event), occurredAt: now })),
  }
  // An owner prevents legacy imports; the separate name isolates real account data.
  return new IndexedDbGroceaStorage(seed, 'grocea:development-demo:v1', demoAccount.id)
}
