import type { Category, DraftRecipe, GroceaState, Ingredient, MeasurementFamily, PublishedRecipe, Recipe, Unit } from '../domain/types'
import { familyUnits } from '../shared/lib/quantity'

const STORAGE_KEY = 'grocea:user-content:v1'
const units: Unit[] = ['mg', 'g', 'kg', 'ml', 'L', 'item']
const families: MeasurementFamily[] = ['mass', 'volume', 'count']

type StoredRecipe = Omit<Recipe, 'ingredients'> & {
  ingredients: Array<{ ingredientId: string; quantity: string; unit: Unit }>
}
interface StoredContent {
  version: 1
  recipes: StoredRecipe[]
  ingredients: Ingredient[]
  categories: Category[]
}

const isUnit = (value: unknown): value is Unit => typeof value === 'string' && units.includes(value as Unit)

function decodeRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.description !== 'string' || typeof item.baseServings !== 'number' || !Array.isArray(item.ingredients) || !Array.isArray(item.steps)) return null
  const ingredients = item.ingredients.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []
    const ingredient = raw as Record<string, unknown>
    return typeof ingredient.ingredientId === 'string' && typeof ingredient.quantity === 'string' && isUnit(ingredient.unit)
      ? [{ ingredientId: ingredient.ingredientId, quantity: ingredient.quantity, unit: ingredient.unit }]
      : []
  })
  if (ingredients.length !== item.ingredients.length || !item.steps.every(step => typeof step === 'string')) return null
  if (item.status === 'draft' && item.scope === 'custom' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string') {
    return { id: item.id, status: 'draft', scope: 'custom', name: item.name, description: item.description, baseServings: item.baseServings, ingredients, steps: item.steps as string[], createdAt: item.createdAt, updatedAt: item.updatedAt } satisfies DraftRecipe
  }
  if (item.status === 'published' && (item.scope === 'custom' || item.scope === 'global')) {
    try {
      return { id: item.id, status: 'published', scope: item.scope, name: item.name, description: item.description, baseServings: item.baseServings, ingredients: ingredients.map(ingredient => ({ ...ingredient, quantity: BigInt(ingredient.quantity) })), steps: item.steps as string[] } satisfies PublishedRecipe
    } catch { return null }
  }
  return null
}

export function hydrateState(base: GroceaState): GroceaState {
  if (typeof localStorage === 'undefined') return base
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredContent | null
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.categories)) return base
    const merge = <T extends { id: string }>(fixtures: T[], stored: T[]) => [...fixtures.filter(item => !stored.some(saved => saved.id === item.id)), ...stored]
    const ingredients = parsed.ingredients.filter(item => item?.scope === 'custom' && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.categoryId === 'string' && families.includes(item.family))
    const categories = parsed.categories.filter(item => item?.scope === 'custom' && typeof item.id === 'string' && typeof item.name === 'string')
    const mergedIngredients = merge(base.ingredients, ingredients)
    const decodedRecipes = parsed.recipes.map(decodeRecipe).filter((recipe): recipe is Recipe => Boolean(recipe))
    const recipes = decodedRecipes.filter(recipe => recipe.status === 'draft'
      ? recipe.ingredients.every(item => { const source = mergedIngredients.find(ingredient => ingredient.id === item.ingredientId); return source && familyUnits[source.family].includes(item.unit) })
      : recipe.ingredients.every(item => { const source = mergedIngredients.find(ingredient => ingredient.id === item.ingredientId); return source && familyUnits[source.family].includes(item.unit) && item.quantity > 0n }))
    const balances = { ...base.balances }
    ingredients.forEach(ingredient => { if (!(ingredient.id in balances)) balances[ingredient.id] = 0n })
    return { ...base, recipes: merge(base.recipes, recipes), ingredients: mergedIngredients, categories: merge(base.categories, categories), balances }
  } catch { return base }
}

export function persistUserContent(state: GroceaState) {
  if (typeof localStorage === 'undefined') return
  const recipes = state.recipes.filter(recipe => recipe.scope === 'custom').map(recipe => ({ ...recipe, ingredients: recipe.ingredients.map(ingredient => ({ ...ingredient, quantity: ingredient.quantity.toString() })) })) as StoredRecipe[]
  const ingredients = state.ingredients.filter(ingredient => ingredient.scope === 'custom')
  const categoryIds = new Set(ingredients.map(ingredient => ingredient.categoryId))
  const categories = state.categories.filter(category => category.scope === 'custom' && categoryIds.has(category.id))
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, recipes, ingredients, categories } satisfies StoredContent)) } catch { /* Storage is best-effort until the backend exists. */ }
}
