export type MeasurementFamily = 'mass' | 'volume' | 'count'
export type IngredientScope = 'global' | 'custom'
export type StockOperation = 'add' | 'set' | 'remove'
export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'L' | 'item'
export type RecipeStatus = 'draft' | 'published'
export type GroceryListStatus = 'active' | 'completed'

export interface Category { id: string; name: string; scope: IngredientScope }
export interface Ingredient { id: string; name: string; categoryId: string; family: MeasurementFamily; scope: IngredientScope }
export interface RecipeIngredient { ingredientId: string; quantity: bigint; unit: Unit }
export interface DraftRecipeIngredient { ingredientId: string; quantity: string; unit: Unit }
interface RecipeBase {
  id: string
  name: string
  description: string
  baseServings: number
  steps: string[]
  scope: IngredientScope
}
export interface DraftRecipe extends RecipeBase {
  status: 'draft'
  scope: 'custom'
  ingredients: DraftRecipeIngredient[]
  createdAt: string
  updatedAt: string
}
export interface PublishedRecipe extends RecipeBase {
  status: 'published'
  ingredients: RecipeIngredient[]
}
export type Recipe = DraftRecipe | PublishedRecipe
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
export interface BasketItem {
  recipeId: string
  recipeName: string
  servings: number
  baseServings: number
  valid: boolean
  error?: string
}
export interface GroceryListRecipe {
  recipeId: string
  recipeName: string
  servings: number
  baseServings: number
}
export interface GroceryListItemSource {
  recipeId: string
  recipeName: string
  servings: number
  quantity: bigint
  unit: Unit
}
export interface GroceryListItem {
  id: string
  ingredientId?: string
  label: string
  categoryName: string
  family?: MeasurementFamily
  quantity?: bigint
  unit?: string
  checked: boolean
  origin: 'generated' | 'manual'
  edited: boolean
  originalRequired?: bigint
  originalPantry?: bigint
  originalQuantity?: bigint
  sources: GroceryListItemSource[]
  createdAt: string
  updatedAt: string
}
export interface GroceryList {
  id: string
  title: string
  status: GroceryListStatus
  recipes: GroceryListRecipe[]
  items: GroceryListItem[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}
export interface GroceaState {
  categories: Category[]
  ingredients: Ingredient[]
  balances: Record<string, bigint>
  recipes: Recipe[]
  activity: ActivityEvent[]
  profile: Profile
  basket: BasketItem[]
  groceryLists: GroceryList[]
}

export interface PendingMutation {
  id: string
  deviceId: string
  type: string
  createdAt: string
  payload: unknown
  attempts: number
  lastAttemptAt?: string
  status: 'pending' | 'syncing' | 'failed'
  error?: { code: string; message: string; retryable: boolean }
  dependsOn: string[]
  serverRevision?: number
}

export interface ImportConflict {
  kind: string
  localId: string
  message: string
}

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'pending' | 'failed'

export const isPublishedRecipe = (recipe: Recipe): recipe is PublishedRecipe => recipe.status === 'published'
