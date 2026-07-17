import { createContext, useContext } from 'react'
import type { ActivityEvent, DraftRecipe, GroceaState, Ingredient, MeasurementFamily, StockOperation } from '../domain/types'

export interface GroceaContextValue extends GroceaState {
  categoryName: (id: string) => string
  ingredient: (id: string) => Ingredient | undefined
  adjustStock: (ingredientId: string, operation: StockOperation, amount: bigint, reason: string) => void
  createIngredient: (name: string, categoryId: string, family: MeasurementFamily, createStock?: boolean) => string
  createRecipeDraft: () => string
  updateRecipeDraft: (id: string, patch: Partial<Pick<DraftRecipe, 'name' | 'description' | 'baseServings' | 'ingredients' | 'steps'>>) => void
  deleteRecipeDraft: (id: string) => void
  publishRecipeDraft: (id: string) => boolean
  cookRecipe: (recipeId: string, servings: number, changes: ActivityEvent['changes']) => string
  reverseEvent: (eventId: string) => void
  createCategory: (name: string) => void
  updateProfile: (displayName: string, preferredServings: number) => void
}

export const GroceaContext = createContext<GroceaContextValue | null>(null)
export function useGrocea() { const value = useContext(GroceaContext); if (!value) throw new Error('useGrocea must be used inside GroceaProvider'); return value }
