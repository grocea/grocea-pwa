import type {
  ActivityEvent,
  Category,
  DraftRecipe,
  GroceryList,
  GroceryListItem,
  GroceaState,
  Ingredient,
  PendingMutation,
  Profile,
  PublishedRecipe,
  Recipe,
} from '../domain/types'
import type { schemas } from './generated'

const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }

  get retryable() {
    return this.status === 0 || this.status >= 500
  }
}

type ApiRecipe = schemas['RecipeResponse']
type ApiActivity = schemas['ActivityResponse']
type ApiState = schemas['StateResponse']
type ApiGroceryList = schemas['GroceryListResponse']

const decimalToMinor = (value: string): bigint => {
  const match = value.match(/^(-?)(\d+)(?:\.(\d{1,3}))?$/)
  if (!match) throw new Error(`Invalid API quantity: ${value}`)
  const [, sign, whole, fraction = ''] = match
  const quantity = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'))
  return sign ? -quantity : quantity
}

export const minorToDecimal = (value: bigint): string => {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? '-' : ''}${absolute / 1000n}.${(absolute % 1000n).toString().padStart(3, '0')}`
}

function mapRecipe(recipe: ApiRecipe): Recipe {
  const base = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    baseServings: recipe.base_servings,
    steps: recipe.steps,
    scope: recipe.scope,
  }
  if (recipe.status === 'draft') {
    return {
      ...base,
      status: 'draft',
      scope: 'custom',
      ingredients: recipe.ingredients.map(item => ({
        ingredientId: item.ingredient_id,
        quantity: item.quantity_input,
        unit: item.unit,
      })),
      createdAt: recipe.created_at,
      updatedAt: recipe.updated_at,
    } satisfies DraftRecipe
  }
  return {
    ...base,
    status: 'published',
    ingredients: recipe.ingredients.map(item => ({
      ingredientId: item.ingredient_id,
      quantity: decimalToMinor(item.quantity ?? '0.000'),
      unit: item.unit,
    })),
  } satisfies PublishedRecipe
}

function mapActivity(event: ApiActivity): ActivityEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    detail: event.detail,
    occurredAt: event.occurred_at,
    recipeId: event.recipe_id ?? undefined,
    servings: event.servings ?? undefined,
    changes: event.changes.map(change => ({
      ingredientId: change.ingredient_id,
      before: decimalToMinor(change.before),
      delta: decimalToMinor(change.delta),
      after: decimalToMinor(change.after),
    })),
    reversedAt: event.reversed_at ?? undefined,
    reversalOf: event.reversal_of ?? undefined,
  }
}

function mapGroceryList(list: ApiGroceryList): GroceryList {
  return {
    id: list.id,
    title: list.title,
    status: list.status,
    recipes: list.recipes.map(recipe => ({
      recipeId: recipe.recipe_id,
      recipeName: recipe.recipe_name,
      servings: recipe.servings,
      baseServings: recipe.base_servings,
    })),
    items: list.items.map(item => ({
      id: item.id,
      ingredientId: item.ingredient_id ?? undefined,
      label: item.label,
      categoryName: item.category_name,
      family: item.measurement_family ?? undefined,
      quantity: item.quantity === null ? undefined : decimalToMinor(item.quantity),
      unit: item.unit ?? undefined,
      checked: item.checked,
      origin: item.origin,
      edited: item.edited,
      originalRequired: item.original_required === null ? undefined : decimalToMinor(item.original_required),
      originalPantry: item.original_pantry === null ? undefined : decimalToMinor(item.original_pantry),
      originalQuantity: item.original_quantity === null ? undefined : decimalToMinor(item.original_quantity),
      sources: item.sources.map(source => ({
        recipeId: source.recipe_id,
        recipeName: source.recipe_name,
        servings: source.servings,
        quantity: decimalToMinor(source.quantity),
        unit: source.unit,
      })),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    completedAt: list.completed_at ?? undefined,
  }
}

export function mapApiState(value: ApiState): { state: GroceaState; revision: number } {
  const categories: Category[] = value.categories.map(category => ({ ...category }))
  const ingredients: Ingredient[] = value.ingredients.map(ingredient => ({
    id: ingredient.id,
    name: ingredient.name,
    categoryId: ingredient.category_id,
    family: ingredient.measurement_family,
    scope: ingredient.scope,
  }))
  const balances = Object.fromEntries(value.pantry_stocks.map(stock => [stock.ingredient_id, decimalToMinor(stock.quantity)]))
  const profile: Profile = {
    displayName: value.profile.display_name,
    preferredServings: value.profile.preferred_servings ?? 2,
    measurementSystem: 'metric',
  }
  return {
    revision: value.revision,
    state: {
      categories,
      ingredients,
      balances,
      recipes: value.recipes.map(mapRecipe),
      activity: value.activity.map(mapActivity),
      profile,
      basket: value.basket.items.map(item => ({
        recipeId: item.recipe_id,
        recipeName: item.recipe_name,
        servings: item.servings,
        baseServings: item.base_servings,
        valid: item.valid,
        error: item.error ?? undefined,
      })),
      groceryLists: value.grocery_lists.map(mapGroceryList),
    },
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Backend API is unavailable.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      code?: string
      message?: string
      details?: Record<string, unknown>
    } | null
    throw new ApiError(
      response.status,
      body?.code ?? 'API_ERROR',
      body?.message ?? `API request failed with ${response.status}.`,
      body?.details,
    )
  }
  return response.json() as Promise<T>
}

export async function checkReady(): Promise<boolean> {
  try {
    await request<{ status: 'ok' }>('/api/health/ready')
    return true
  } catch {
    return false
  }
}

export async function fetchState() {
  return mapApiState(await request<ApiState>('/api/state'))
}

const mutationHeaders = (mutation: PendingMutation) => ({
  'Idempotency-Key': mutation.id,
  'X-Device-ID': mutation.deviceId,
})

const recipePayload = (recipe: DraftRecipe, includeId = true) => ({
  ...(includeId ? { id: recipe.id } : {}),
  name: recipe.name,
  description: recipe.description,
  base_servings: recipe.baseServings,
  ingredients: recipe.ingredients.map(item => ({
    ingredient_id: item.ingredientId,
    quantity: item.quantity,
    unit: item.unit,
  })),
  steps: recipe.steps,
})

export async function sendMutation(mutation: PendingMutation): Promise<void> {
  const headers = mutationHeaders(mutation)
  const payload = mutation.payload as Record<string, unknown>
  let path: string
  let method = 'POST'
  let body: unknown
  switch (mutation.type) {
    case 'profile.update':
      path = '/api/profile'
      method = 'PATCH'
      body = { display_name: payload.displayName, preferred_servings: payload.preferredServings }
      break
    case 'category.create':
      path = '/api/categories'
      body = { id: payload.id, name: payload.name }
      break
    case 'ingredient.create':
      path = '/api/ingredients'
      body = {
        id: payload.id,
        name: payload.name,
        category_id: payload.categoryId,
        measurement_family: payload.family,
        track_in_pantry: payload.createStock,
      }
      break
    case 'stock.operation':
      path = `/api/pantry-stocks/${payload.ingredientId}/operations`
      body = {
        event_id: payload.eventId,
        operation: payload.operation,
        amount: minorToDecimal(BigInt(payload.amount as string)),
        reason: payload.reason,
      }
      break
    case 'recipe.create':
      path = '/api/recipes'
      body = recipePayload(payload.recipe as unknown as DraftRecipe)
      break
    case 'recipe.update':
      path = `/api/recipes/${payload.id}`
      method = 'PATCH'
      body = recipePayload(payload.recipe as unknown as DraftRecipe, false)
      break
    case 'recipe.delete':
      path = `/api/recipes/${payload.id}`
      method = 'DELETE'
      body = undefined
      break
    case 'recipe.publish':
      path = `/api/recipes/${payload.id}/publish`
      body = {}
      break
    case 'recipe.cook':
      path = `/api/recipes/${payload.recipeId}/cook`
      body = { event_id: payload.eventId, servings: payload.servings }
      break
    case 'activity.reverse':
      path = `/api/activity/${payload.eventId}/reverse`
      body = { event_id: payload.reversalId }
      break
    case 'basket.recipe.upsert':
      path = `/api/basket/recipes/${payload.recipeId}`
      method = 'PUT'
      body = { servings: payload.servings }
      break
    case 'basket.recipe.remove':
      path = `/api/basket/recipes/${payload.recipeId}`
      method = 'DELETE'
      body = undefined
      break
    case 'basket.clear':
      path = '/api/basket'
      method = 'DELETE'
      body = undefined
      break
    case 'grocery-list.create':
      path = '/api/grocery-lists/from-basket'
      body = {
        id: payload.id,
        ...(payload.title ? { title: payload.title } : {}),
        generated_item_ids: ((payload.generatedItemIds as Array<{ ingredientId: string; id: string }> | undefined) ?? []).map(item => ({
          ingredient_id: item.ingredientId,
          id: item.id,
        })),
        recipe_basis: ((payload.recipeBasis as Array<{
          recipeId: string
          baseServings: number
          ingredients: Array<{ ingredientId: string; quantity: string }>
        }> | undefined) ?? []).map(recipe => ({
          recipe_id: recipe.recipeId,
          base_servings: recipe.baseServings,
          ingredients: recipe.ingredients.map(item => ({
            ingredient_id: item.ingredientId,
            quantity: minorToDecimal(BigInt(item.quantity)),
          })),
        })),
        pantry_basis: ((payload.pantryBasis as Array<{ ingredientId: string; quantity: string }> | undefined) ?? []).map(item => ({
          ingredient_id: item.ingredientId,
          quantity: minorToDecimal(BigInt(item.quantity)),
        })),
      }
      break
    case 'grocery-list.update':
      path = `/api/grocery-lists/${payload.listId}`
      method = 'PATCH'
      body = { title: payload.title }
      break
    case 'grocery-list.item.create': {
      const item = payload.item as GroceryListItem
      path = `/api/grocery-lists/${payload.listId}/items`
      body = groceryItemPayload(item, true)
      break
    }
    case 'grocery-list.item.update': {
      const item = payload.item as GroceryListItem
      path = `/api/grocery-lists/${payload.listId}/items/${item.id}`
      method = 'PUT'
      body = groceryItemPayload(item, false)
      break
    }
    case 'grocery-list.item.delete':
      path = `/api/grocery-lists/${payload.listId}/items/${payload.itemId}`
      method = 'DELETE'
      body = undefined
      break
    case 'grocery-list.complete':
      path = `/api/grocery-lists/${payload.listId}/complete`
      body = { event_id: payload.eventId, pantry_item_ids: payload.pantryItemIds }
      break
    case 'grocery-list.reuse':
      path = `/api/grocery-lists/${payload.listId}/reuse-recipes`
      body = {}
      break
    case 'grocery-list.delete':
      path = `/api/grocery-lists/${payload.listId}?restore_recipes=${payload.restoreRecipes ? 'true' : 'false'}`
      method = 'DELETE'
      body = undefined
      break
    default:
      throw new ApiError(400, 'UNKNOWN_MUTATION', `Unsupported mutation type: ${mutation.type}`)
  }
  await request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

function groceryItemPayload(item: GroceryListItem, includeId: boolean) {
  return {
    ...(includeId ? { id: item.id } : {}),
    ingredient_id: item.ingredientId ?? null,
    label: item.label,
    quantity: item.quantity === undefined ? null : minorToDecimal(item.quantity),
    unit: item.unit ?? null,
    ...(!includeId ? { checked: item.checked } : {}),
  }
}

export interface ImportResult {
  revision: number
  idMap: Record<string, string>
  conflicts: Array<{ kind: string; localId: string; message: string }>
}

export async function importLocalState(
  state: GroceaState,
  importId: string,
  deviceId: string,
): Promise<ImportResult> {
  const serializable = JSON.parse(JSON.stringify(state, (_key, value) => typeof value === 'bigint' ? value.toString() : value))
  const response = await request<{
    revision: number
    id_map: Record<string, string>
    conflicts: Array<{ kind: string; local_id: string; message: string }>
  }>('/api/imports/local-state', {
    method: 'POST',
    headers: { 'Idempotency-Key': importId, 'X-Device-ID': deviceId },
    body: JSON.stringify({ import_id: importId, state: serializable }),
  })
  return {
    revision: response.revision,
    idMap: response.id_map,
    conflicts: response.conflicts.map(item => ({ kind: item.kind, localId: item.local_id, message: item.message })),
  }
}
