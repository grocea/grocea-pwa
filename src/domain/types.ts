export type MeasurementFamily = 'mass' | 'volume' | 'count'
export type IngredientScope = 'global' | 'custom'
export type StockOperation = 'add' | 'set' | 'remove'
export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'L' | 'item'

export interface Category { id: string; name: string; scope: IngredientScope }
export interface Ingredient { id: string; name: string; categoryId: string; family: MeasurementFamily; scope: IngredientScope }
export interface RecipeIngredient { ingredientId: string; quantity: bigint }
export interface Recipe {
  id: string
  name: string
  description: string
  baseServings: number
  ingredients: RecipeIngredient[]
  steps: string[]
  scope: IngredientScope
}
export interface StockChange { ingredientId: string; before: bigint; delta: bigint; after: bigint }
export interface ActivityEvent {
  id: string
  type: 'cooking' | 'manual' | 'reversal'
  title: string
  detail: string
  occurredAt: string
  recipeId?: string
  servings?: number
  changes: StockChange[]
  reversedAt?: string
  reversalOf?: string
}
export interface Profile { displayName: string; measurementSystem: 'metric'; preferredServings: number }
export interface GroceaState {
  categories: Category[]
  ingredients: Ingredient[]
  balances: Record<string, bigint>
  recipes: Recipe[]
  activity: ActivityEvent[]
  profile: Profile
}
