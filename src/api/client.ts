import type {
  ActivityEvent,
  Category,
  DraftRecipe,
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
    default:
      throw new ApiError(400, 'UNKNOWN_MUTATION', `Unsupported mutation type: ${mutation.type}`)
  }
  await request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
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
