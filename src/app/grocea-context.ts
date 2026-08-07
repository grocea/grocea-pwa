import { createContext, useContext } from 'react'
import type {
  ActivityEvent,
  DraftRecipe,
  GroceaState,
  GroceryListItem,
  ImportConflict,
  Ingredient,
  MeasurementFamily,
  PendingMutation,
  StockOperation,
  SyncError,
  SyncStatus,
} from '../domain/types'

export type StorageStatus = 'loading' | 'ready' | 'error'

export interface GroceaContextValue extends GroceaState {
  storageStatus: StorageStatus
  storageError: string | null
  syncStatus: SyncStatus
  syncError: SyncError | null
  pendingMutationCount: number
  syncIssues: PendingMutation[]
  importConflicts: ImportConflict[]
  categoryName: (id: string) => string
  ingredient: (id: string) => Ingredient | undefined
  adjustStock: (ingredientId: string, operation: StockOperation, amount: bigint, reason: string) => Promise<void>
  createIngredient: (name: string, categoryId: string, family: MeasurementFamily, createStock?: boolean) => Promise<string>
  createRecipeDraft: (sourceRecipeId?: string) => Promise<string>
  updateRecipeDraft: (id: string, patch: Partial<Pick<DraftRecipe, 'name' | 'description' | 'baseServings' | 'ingredients' | 'steps'>>) => Promise<void>
  deleteRecipeDraft: (id: string) => Promise<void>
  publishRecipeDraft: (id: string) => Promise<boolean>
  cookRecipe: (recipeId: string, servings: number, changes: ActivityEvent['changes']) => Promise<string>
  reverseEvent: (eventId: string) => Promise<void>
  createCategory: (name: string) => Promise<void>
  updateProfile: (displayName: string, preferredServings: number) => Promise<void>
  addRecipeToBasket: (recipeId: string, servings?: number) => Promise<void>
  removeRecipeFromBasket: (recipeId: string) => Promise<void>
  clearBasket: () => Promise<void>
  confirmBasket: () => Promise<string>
  renameGroceryList: (listId: string, title: string) => Promise<void>
  addGroceryItem: (listId: string, item: Pick<GroceryListItem, 'label' | 'ingredientId' | 'quantity' | 'unit'>) => Promise<string>
  updateGroceryItem: (listId: string, item: GroceryListItem) => Promise<void>
  removeGroceryItem: (listId: string, itemId: string) => Promise<void>
  completeGroceryList: (listId: string, pantryItemIds: string[]) => Promise<void>
  reuseGroceryList: (listId: string) => Promise<void>
  deleteGroceryList: (listId: string, restoreRecipes?: boolean) => Promise<void>
  retrySync: () => Promise<void>
  flushPending: () => Promise<boolean>
  discardSyncIssue: (id: string) => Promise<void>
  discardAllPending: () => Promise<void>
}

export const GroceaContext = createContext<GroceaContextValue | null>(null)
export function useGrocea() { const value = useContext(GroceaContext); if (!value) throw new Error('useGrocea must be used inside GroceaProvider'); return value }
