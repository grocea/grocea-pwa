import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapApiState, minorToDecimal, sendMutation } from '../src/api/client'
import type { schemas } from '../src/api/generated'
import type { DraftRecipe, PendingMutation } from '../src/domain/types'

afterEach(() => vi.unstubAllGlobals())

describe('API contract mapping', () => {
  it('maps exact decimal strings to bigint minor units', () => {
    expect(minorToDecimal(2_400_001n)).toBe('2400.001')
    expect(minorToDecimal(-500_000n)).toBe('-500.000')

    const apiState: schemas['StateResponse'] = {
      revision: 7,
      profile: {
        id: crypto.randomUUID(),
        display_name: 'Grocie Crumbsworth',
        preferred_servings: 2,
        measurement_system: 'metric',
        created_at: '2026-07-26T00:00:00Z',
        updated_at: '2026-07-26T00:00:00Z',
      },
      categories: [{
        id: crypto.randomUUID(),
        name: 'Pantry',
        scope: 'global',
        archived_at: null,
        created_at: '2026-07-26T00:00:00Z',
        updated_at: '2026-07-26T00:00:00Z',
      }],
      ingredients: [],
      pantry_stocks: [{
        id: crypto.randomUUID(),
        ingredient_id: 'rice',
        quantity: '-500.125',
        created_at: '2026-07-26T00:00:00Z',
        updated_at: '2026-07-26T00:00:00Z',
      }],
      recipes: [],
      activity: [],
      basket: { items: [] },
      grocery_lists: [],
    }
    const mapped = mapApiState(apiState)
    expect(mapped.revision).toBe(7)
    expect(mapped.state.balances.rice).toBe(-500_125n)
  })

  it('uses create and update recipe wire shapes from OpenAPI', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const recipe: DraftRecipe = {
      id: crypto.randomUUID(),
      status: 'draft',
      scope: 'custom',
      name: 'Draft',
      description: '',
      baseServings: 2,
      ingredients: [],
      steps: [''],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const base: PendingMutation = {
      id: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      type: 'recipe.create',
      createdAt: new Date().toISOString(),
      payload: { recipe },
      attempts: 0,
      status: 'pending',
      dependsOn: [],
    }
    await sendMutation(base)
    await sendMutation({ ...base, id: crypto.randomUUID(), type: 'recipe.update', payload: { id: recipe.id, recipe } })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveProperty('id', recipe.id)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('id')
  })

  it('sends stable generated Item IDs when confirming an offline Basket', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const listId = crypto.randomUUID()
    const ingredientId = crypto.randomUUID()
    const itemId = crypto.randomUUID()
    const mutation: PendingMutation = {
      id: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      type: 'grocery-list.create',
      createdAt: new Date().toISOString(),
      payload: { listId, id: listId, generatedItemIds: [{ ingredientId, id: itemId }] },
      attempts: 0,
      status: 'pending',
      dependsOn: [],
    }

    await sendMutation(mutation)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/grocery-lists/from-basket')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      id: listId,
      generated_item_ids: [{ ingredient_id: ingredientId, id: itemId }],
      recipe_basis: [],
      pantry_basis: [],
    })
  })
})
