import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  ActivityEvent,
  Category,
  DraftRecipe,
  GroceaState,
  GroceryList,
  GroceryListItem,
  Ingredient,
  MeasurementFamily,
  ImportConflict,
  PendingMutation,
  Profile,
  PublishedRecipe,
  Recipe,
  StockChange,
  Unit,
} from '../domain/types'
import { familyUnits } from '../shared/lib/quantity'
import { initialState } from './fixtures'

export const DATABASE_NAME = 'grocea'
export const DATABASE_VERSION = 4
export const LEGACY_STORAGE_KEY = 'grocea:user-content:v1'
export const LEGACY_OWNER_KEY = 'grocea:legacy-owner'
const CURRENT_STATE_KEY = 'current'
const DATABASE_METADATA_KEY = 'database'
const SEED_VERSION = 1

export interface DatabaseMetadata {
  key: typeof DATABASE_METADATA_KEY
  schemaVersion: number
  seedVersion: number
  migrationStatus: 'none' | 'imported' | 'ignored-invalid'
  deviceId: string
  syncCursor: string | null
  remoteImportStatus: 'pending' | 'complete' | 'conflicts'
  importId: string
  importConflicts: ImportConflict[]
  ownerUserId?: string
  legacyClaimed?: boolean
}

interface GroceaDatabase extends DBSchema {
  canonical: {
    key: typeof CURRENT_STATE_KEY
    value: { key: typeof CURRENT_STATE_KEY; value: GroceaState }
  }
  state: {
    key: typeof CURRENT_STATE_KEY
    value: { key: typeof CURRENT_STATE_KEY; value: GroceaState }
  }
  outbox: {
    key: string
    value: PendingMutation
    indexes: { 'by-created-at': string }
  }
  metadata: {
    key: typeof DATABASE_METADATA_KEY
    value: DatabaseMetadata
  }
}

export interface GroceaStorage {
  open(): Promise<void>
  loadState(): Promise<GroceaState>
  saveState(state: GroceaState): Promise<void>
  saveCanonicalState?(state: GroceaState): Promise<void>
  enqueueMutation(mutation: PendingMutation): Promise<void>
  listPendingMutations(): Promise<PendingMutation[]>
  removeMutation(id: string): Promise<void>
  updateMutation?(mutation: PendingMutation): Promise<void>
  saveStateAndMutation?(state: GroceaState, mutation: PendingMutation): Promise<void>
  getMetadata?(): Promise<DatabaseMetadata>
  saveMetadata?(metadata: DatabaseMetadata): Promise<void>
  reset(): Promise<GroceaState>
  close?(): void
  destroy?(): Promise<void>
}

type StoredRecipe = Omit<Recipe, 'ingredients'> & {
  ingredients: Array<{ ingredientId: string; quantity: string; unit: Unit }>
}

interface LegacyContent {
  version: 1
  recipes: StoredRecipe[]
  ingredients: Ingredient[]
  categories: Category[]
}

const units: Unit[] = ['mg', 'g', 'kg', 'ml', 'L', 'item']
const families: MeasurementFamily[] = ['mass', 'volume', 'count']

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
const isString = (value: unknown): value is string => typeof value === 'string'
const isUnit = (value: unknown): value is Unit => isString(value) && units.includes(value as Unit)
const isFamily = (value: unknown): value is MeasurementFamily => isString(value) && families.includes(value as MeasurementFamily)
const isScope = (value: unknown): value is 'global' | 'custom' => value === 'global' || value === 'custom'

function isCategory(value: unknown): value is Category {
  return isRecord(value) && isString(value.id) && isString(value.name) && isScope(value.scope)
}

function isIngredient(value: unknown): value is Ingredient {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isString(value.categoryId)
    && isFamily(value.family)
    && isScope(value.scope)
}

function isRecipeIngredient(value: unknown): value is PublishedRecipe['ingredients'][number] {
  return isRecord(value) && isString(value.ingredientId) && typeof value.quantity === 'bigint' && value.quantity > 0n && isUnit(value.unit)
}

function isDraftIngredient(value: unknown): value is DraftRecipe['ingredients'][number] {
  return isRecord(value) && isString(value.ingredientId) && isString(value.quantity) && isUnit(value.unit)
}

function isRecipeBase(value: Record<string, unknown>): boolean {
  return isString(value.id)
    && isString(value.name)
    && isString(value.description)
    && typeof value.baseServings === 'number'
    && Number.isInteger(value.baseServings)
    && value.baseServings > 0
    && Array.isArray(value.steps)
    && value.steps.every(isString)
}

function isRecipe(value: unknown): value is Recipe {
  if (!isRecord(value) || !isRecipeBase(value) || !Array.isArray(value.ingredients)) return false
  if (value.status === 'draft') {
    return value.scope === 'custom'
      && isString(value.createdAt)
      && isString(value.updatedAt)
      && value.ingredients.every(isDraftIngredient)
  }
  return value.status === 'published' && isScope(value.scope) && value.ingredients.every(isRecipeIngredient)
}

function isStockChange(value: unknown): value is StockChange {
  return isRecord(value)
    && isString(value.ingredientId)
    && typeof value.before === 'bigint'
    && typeof value.delta === 'bigint'
    && typeof value.after === 'bigint'
    && value.before + value.delta === value.after
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  return isRecord(value)
    && isString(value.id)
    && (value.type === 'cooking' || value.type === 'manual' || value.type === 'reversal')
    && isString(value.title)
    && isString(value.detail)
    && isString(value.occurredAt)
    && (value.recipeId === undefined || isString(value.recipeId))
    && (value.servings === undefined || (typeof value.servings === 'number' && Number.isInteger(value.servings)))
    && (value.reversedAt === undefined || isString(value.reversedAt))
    && (value.reversalOf === undefined || isString(value.reversalOf))
    && Array.isArray(value.changes)
    && value.changes.every(isStockChange)
}

function isProfile(value: unknown): value is Profile {
  return isRecord(value)
    && isString(value.displayName)
    && value.measurementSystem === 'metric'
    && typeof value.preferredServings === 'number'
    && Number.isInteger(value.preferredServings)
    && value.preferredServings >= 1
}

function isBasketItem(value: unknown): boolean {
  return isRecord(value)
    && isString(value.recipeId)
    && isString(value.recipeName)
    && typeof value.servings === 'number'
    && Number.isInteger(value.servings)
    && value.servings >= 1
    && value.servings <= 12
    && typeof value.baseServings === 'number'
    && Number.isInteger(value.baseServings)
    && typeof value.valid === 'boolean'
    && (value.error === undefined || isString(value.error))
}

function isGroceryListItem(value: unknown): value is GroceryListItem {
  return isRecord(value)
    && isString(value.id)
    && (value.ingredientId === undefined || isString(value.ingredientId))
    && isString(value.label)
    && isString(value.categoryName)
    && (value.family === undefined || isFamily(value.family))
    && (value.quantity === undefined || typeof value.quantity === 'bigint')
    && (value.unit === undefined || isString(value.unit))
    && typeof value.checked === 'boolean'
    && (value.origin === 'generated' || value.origin === 'manual')
    && typeof value.edited === 'boolean'
    && Array.isArray(value.sources)
    && value.sources.every(source => isRecord(source)
      && isString(source.recipeId)
      && isString(source.recipeName)
      && typeof source.servings === 'number'
      && typeof source.quantity === 'bigint'
      && isUnit(source.unit))
    && isString(value.createdAt)
    && isString(value.updatedAt)
}

function isGroceryList(value: unknown): value is GroceryList {
  return isRecord(value)
    && isString(value.id)
    && isString(value.title)
    && (value.status === 'active' || value.status === 'completed')
    && Array.isArray(value.recipes)
    && value.recipes.every(recipe => isRecord(recipe)
      && isString(recipe.recipeId)
      && isString(recipe.recipeName)
      && typeof recipe.servings === 'number'
      && typeof recipe.baseServings === 'number')
    && Array.isArray(value.items)
    && value.items.every(isGroceryListItem)
    && isString(value.createdAt)
    && isString(value.updatedAt)
    && (value.completedAt === undefined || isString(value.completedAt))
}

function normalizeStateShape(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...value,
    basket: Array.isArray(value.basket) ? value.basket : [],
    groceryLists: Array.isArray(value.groceryLists) ? value.groceryLists : [],
  }
}

export function isGroceaState(value: unknown): value is GroceaState {
  if (!isRecord(value)
    || !Array.isArray(value.categories)
    || !value.categories.every(isCategory)
    || !Array.isArray(value.ingredients)
    || !value.ingredients.every(isIngredient)
    || !Array.isArray(value.recipes)
    || !value.recipes.every(isRecipe)
    || !Array.isArray(value.activity)
    || !value.activity.every(isActivityEvent)
    || !Array.isArray(value.basket)
    || !value.basket.every(isBasketItem)
    || !Array.isArray(value.groceryLists)
    || !value.groceryLists.every(isGroceryList)
    || !isProfile(value.profile)
    || !isRecord(value.balances)) return false

  if (!Object.values(value.balances).every(balance => typeof balance === 'bigint')) return false

  const hasUniqueIds = (items: Array<{ id: string }>) => new Set(items.map(item => item.id)).size === items.length
  if (!hasUniqueIds(value.categories) || !hasUniqueIds(value.ingredients) || !hasUniqueIds(value.recipes) || !hasUniqueIds(value.activity)) return false
  const categoryIds = new Set(value.categories.map(category => category.id))
  const ingredients = new Map(value.ingredients.map(ingredient => [ingredient.id, ingredient]))
  if (value.ingredients.some(ingredient => !categoryIds.has(ingredient.categoryId))) return false
  if (value.recipes.some(recipe => recipe.ingredients.some(item => {
    const ingredient = ingredients.get(item.ingredientId)
    return !ingredient || !familyUnits[ingredient.family].includes(item.unit)
  }))) return false
  return !value.activity.some(event => event.changes.some(change => !ingredients.has(change.ingredientId)))
}

export function cloneState(state: GroceaState): GroceaState {
  return {
    categories: state.categories.map(category => ({ ...category })),
    ingredients: state.ingredients.map(ingredient => ({ ...ingredient })),
    balances: { ...state.balances },
    recipes: state.recipes.map(recipe => ({
      ...recipe,
      ingredients: recipe.ingredients.map(ingredient => ({ ...ingredient })),
      steps: [...recipe.steps],
    })) as Recipe[],
    activity: state.activity.map(event => ({ ...event, changes: event.changes.map(change => ({ ...change })) })),
    profile: { ...state.profile },
    basket: state.basket.map(item => ({ ...item })),
    groceryLists: state.groceryLists.map(list => ({
      ...list,
      recipes: list.recipes.map(recipe => ({ ...recipe })),
      items: list.items.map(item => ({ ...item, sources: item.sources.map(source => ({ ...source })) })),
    })),
  }
}

function decodeLegacyRecipe(value: unknown): Recipe | null {
  if (!isRecord(value) || !isRecipeBase(value) || !Array.isArray(value.ingredients)) return null
  const ingredients = value.ingredients.flatMap(raw => {
    if (!isRecord(raw) || !isString(raw.ingredientId) || !isString(raw.quantity) || !isUnit(raw.unit)) return []
    return [{ ingredientId: raw.ingredientId, quantity: raw.quantity, unit: raw.unit }]
  })
  if (ingredients.length !== value.ingredients.length) return null
  if (value.status === 'draft' && value.scope === 'custom' && isString(value.createdAt) && isString(value.updatedAt)) {
    return { ...value, ingredients } as unknown as DraftRecipe
  }
  if (value.status === 'published' && isScope(value.scope)) {
    try {
      return { ...value, ingredients: ingredients.map(ingredient => ({ ...ingredient, quantity: BigInt(ingredient.quantity) })) } as unknown as PublishedRecipe
    } catch {
      return null
    }
  }
  return null
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  return [...base.filter(item => !incoming.some(candidate => candidate.id === item.id)), ...incoming]
}

function importLegacy(base: GroceaState, raw: string | null): { state: GroceaState; status: DatabaseMetadata['migrationStatus'] } {
  if (!raw) return { state: cloneState(base), status: 'none' }
  try {
    const value = JSON.parse(raw) as LegacyContent
    if (!isRecord(value)
      || value.version !== 1
      || !Array.isArray(value.recipes)
      || !Array.isArray(value.ingredients)
      || !Array.isArray(value.categories)) return { state: cloneState(base), status: 'ignored-invalid' }

    const categories = value.categories.filter(item => isCategory(item) && item.scope === 'custom')
    const ingredients = value.ingredients.filter(item => isIngredient(item) && item.scope === 'custom')
    const mergedCategories = mergeById(base.categories, categories)
    const mergedIngredients = mergeById(base.ingredients, ingredients)
    const recipes = value.recipes.map(decodeLegacyRecipe).filter((recipe): recipe is Recipe => Boolean(recipe)).filter(recipe => {
      if (recipe.scope !== 'custom') return false
      return recipe.ingredients.every(item => {
        const ingredient = mergedIngredients.find(candidate => candidate.id === item.ingredientId)
        return ingredient && familyUnits[ingredient.family].includes(item.unit)
      })
    })
    const balances = { ...base.balances }
    ingredients.forEach(ingredient => { if (!(ingredient.id in balances)) balances[ingredient.id] = 0n })
    const state = {
      ...cloneState(base),
      categories: mergedCategories,
      ingredients: mergedIngredients,
      recipes: mergeById(base.recipes, recipes),
      balances,
    }
    return isGroceaState(state)
      ? { state, status: 'imported' }
      : { state: cloneState(base), status: 'ignored-invalid' }
  } catch {
    return { state: cloneState(base), status: 'ignored-invalid' }
  }
}

export function reconcileGlobalFixtures(persisted: GroceaState, seed: GroceaState): GroceaState {
  const categories = [
    ...mergeById(persisted.categories.filter(item => item.scope === 'global'), seed.categories.filter(item => item.scope === 'global')).map(item => ({ ...item })),
    ...persisted.categories.filter(item => item.scope === 'custom').map(item => ({ ...item })),
  ]
  const ingredients = [
    ...mergeById(persisted.ingredients.filter(item => item.scope === 'global'), seed.ingredients.filter(item => item.scope === 'global')).map(item => ({ ...item })),
    ...persisted.ingredients.filter(item => item.scope === 'custom').map(item => ({ ...item })),
  ]
  const recipes = [
    ...mergeById(persisted.recipes.filter(item => item.scope === 'global'), seed.recipes.filter(item => item.scope === 'global')),
    ...persisted.recipes.filter(item => item.scope === 'custom'),
  ].map(recipe => ({ ...recipe, ingredients: recipe.ingredients.map(item => ({ ...item })), steps: [...recipe.steps] })) as Recipe[]
  const balances = Object.fromEntries(ingredients.map(ingredient => [
    ingredient.id,
    persisted.balances[ingredient.id] ?? seed.balances[ingredient.id] ?? 0n,
  ]))
  return { ...cloneState(persisted), categories, ingredients, recipes, balances }
}

function requestPersistentStorage(): void {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => false)
  }
}

export class IndexedDbGroceaStorage implements GroceaStorage {
  private database?: IDBPDatabase<GroceaDatabase>
  private readonly seed: GroceaState
  private readonly databaseName: string
  private readonly ownerUserId?: string

  constructor(seed: GroceaState = initialState, databaseName: string = DATABASE_NAME, ownerUserId?: string) {
    this.seed = seed
    this.databaseName = databaseName
    this.ownerUserId = ownerUserId
  }

  async open(): Promise<void> {
    if (this.database) return
    const database = await openDB<GroceaDatabase>(this.databaseName, DATABASE_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('canonical')) db.createObjectStore('canonical', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
          outbox.createIndex('by-created-at', 'createdAt')
        }
        if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' })
      },
    })
    this.database = database

    const existing = await database.get('state', CURRENT_STATE_KEY)
    const existingMetadata = await database.get('metadata', DATABASE_METADATA_KEY)
    if (!existing) {
      const accountScoped = Boolean(this.ownerUserId)
      const legacyRaw = accountScoped || typeof localStorage === 'undefined' ? null : localStorage.getItem(LEGACY_STORAGE_KEY)
      const imported = accountScoped
        ? { state: cloneState(this.seed), status: 'none' as const }
        : importLegacy(this.seed, legacyRaw)
      if (!existing || !existingMetadata) {
        const transaction = database.transaction(['state', 'metadata'], 'readwrite')
        await Promise.all([
          ...(!existing ? [transaction.objectStore('state').put({ key: CURRENT_STATE_KEY, value: imported.state })] : []),
          ...(!existingMetadata ? [transaction.objectStore('metadata').put({
            key: DATABASE_METADATA_KEY,
            schemaVersion: DATABASE_VERSION,
            seedVersion: SEED_VERSION,
            migrationStatus: imported.status,
            deviceId: crypto.randomUUID(),
            syncCursor: null,
            remoteImportStatus: accountScoped ? 'complete' : 'pending',
            importId: crypto.randomUUID(),
            importConflicts: [],
            ownerUserId: this.ownerUserId,
            legacyClaimed: false,
          })] : []),
          transaction.done,
        ])
      }
      if (legacyRaw !== null) localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    const metadata = await database.get('metadata', DATABASE_METADATA_KEY)
    if (this.ownerUserId && metadata?.ownerUserId !== this.ownerUserId) {
      throw new Error('Grocea database belongs to another account.')
    }
    requestPersistentStorage()
  }

  async loadState(): Promise<GroceaState> {
    const database = this.requireDatabase()
    const [record, metadata] = await Promise.all([
      database.get('state', CURRENT_STATE_KEY),
      database.get('metadata', DATABASE_METADATA_KEY),
    ])
    const normalized = record ? normalizeStateShape(record.value) : null
    if (!normalized || !isGroceaState(normalized)) throw new Error('Stored Grocea data is corrupt or incompatible.')
    const reconciled = reconcileGlobalFixtures(normalized, this.seed)
    if (!isGroceaState(reconciled)) throw new Error('Stored Grocea data could not be reconciled.')
    const transaction = database.transaction(['state', 'metadata'], 'readwrite')
    await Promise.all([
      transaction.objectStore('state').put({ key: CURRENT_STATE_KEY, value: reconciled }),
      transaction.objectStore('metadata').put({
        key: DATABASE_METADATA_KEY,
        schemaVersion: DATABASE_VERSION,
        seedVersion: SEED_VERSION,
        migrationStatus: metadata?.migrationStatus ?? 'none',
        deviceId: metadata?.deviceId ?? crypto.randomUUID(),
        syncCursor: metadata?.syncCursor ?? null,
        remoteImportStatus: metadata?.remoteImportStatus ?? 'pending',
        importId: metadata?.importId ?? crypto.randomUUID(),
        importConflicts: metadata?.importConflicts ?? [],
        ownerUserId: this.ownerUserId ?? metadata?.ownerUserId,
        legacyClaimed: metadata?.legacyClaimed ?? false,
      }),
      transaction.done,
    ])
    return cloneState(reconciled)
  }

  async saveState(state: GroceaState): Promise<void> {
    if (!isGroceaState(state)) throw new Error('Refusing to persist invalid Grocea data.')
    await this.requireDatabase().put('state', { key: CURRENT_STATE_KEY, value: cloneState(state) })
  }

  async saveCanonicalState(state: GroceaState): Promise<void> {
    if (!isGroceaState(state)) throw new Error('Refusing to persist invalid Grocea data.')
    const transaction = this.requireDatabase().transaction(['canonical', 'state'], 'readwrite')
    const value = { key: CURRENT_STATE_KEY, value: cloneState(state) } as const
    await Promise.all([
      transaction.objectStore('canonical').put(value),
      transaction.objectStore('state').put(value),
      transaction.done,
    ])
  }

  async enqueueMutation(mutation: PendingMutation): Promise<void> {
    await this.requireDatabase().put('outbox', mutation)
  }

  async updateMutation(mutation: PendingMutation): Promise<void> {
    await this.requireDatabase().put('outbox', mutation)
  }

  async saveStateAndMutation(state: GroceaState, mutation: PendingMutation): Promise<void> {
    if (!isGroceaState(state)) throw new Error('Refusing to persist invalid Grocea data.')
    const transaction = this.requireDatabase().transaction(['state', 'outbox'], 'readwrite')
    const outbox = transaction.objectStore('outbox')
    const existing = await outbox.getAll()
    const superseded = existing.filter(item => {
      if (item.status !== 'pending' || item.type !== mutation.type) return false
      if (mutation.type === 'profile.update') return true
      const currentPayload = item.payload as { id?: unknown }
      const nextPayload = mutation.payload as { id?: unknown }
      if (mutation.type === 'recipe.update') return currentPayload.id === nextPayload.id
      const current = item.payload as { recipeId?: unknown; listId?: unknown; item?: { id?: unknown } }
      const next = mutation.payload as { recipeId?: unknown; listId?: unknown; item?: { id?: unknown } }
      if (mutation.type === 'basket.recipe.upsert') return current.recipeId === next.recipeId
      if (mutation.type === 'grocery-list.update') return current.listId === next.listId
      if (mutation.type === 'grocery-list.item.update') {
        return current.listId === next.listId && current.item?.id === next.item?.id
      }
      return false
    })
    await Promise.all([
      transaction.objectStore('state').put({ key: CURRENT_STATE_KEY, value: cloneState(state) }),
      ...superseded.map(item => outbox.delete(item.id)),
      outbox.put(mutation),
      transaction.done,
    ])
  }

  async getMetadata(): Promise<DatabaseMetadata> {
    const metadata = await this.requireDatabase().get('metadata', DATABASE_METADATA_KEY)
    if (!metadata) throw new Error('Grocea database metadata is missing.')
    return metadata
  }

  async saveMetadata(metadata: DatabaseMetadata): Promise<void> {
    await this.requireDatabase().put('metadata', metadata)
  }

  async listPendingMutations(): Promise<PendingMutation[]> {
    return this.requireDatabase().getAllFromIndex('outbox', 'by-created-at')
  }

  async removeMutation(id: string): Promise<void> {
    await this.requireDatabase().delete('outbox', id)
  }

  async reset(): Promise<GroceaState> {
    const database = this.requireDatabase()
    const metadata = await database.get('metadata', DATABASE_METADATA_KEY)
    const resetState = cloneState(this.seed)
    const transaction = database.transaction(['canonical', 'state', 'outbox', 'metadata'], 'readwrite')
    await Promise.all([
      transaction.objectStore('state').put({ key: CURRENT_STATE_KEY, value: resetState }),
      transaction.objectStore('canonical').delete(CURRENT_STATE_KEY),
      transaction.objectStore('outbox').clear(),
      transaction.objectStore('metadata').put({
        key: DATABASE_METADATA_KEY,
        schemaVersion: DATABASE_VERSION,
        seedVersion: SEED_VERSION,
        migrationStatus: 'none',
        deviceId: metadata?.deviceId ?? crypto.randomUUID(),
        syncCursor: null,
        remoteImportStatus: 'complete',
        importId: metadata?.importId ?? crypto.randomUUID(),
        importConflicts: [],
        ownerUserId: this.ownerUserId ?? metadata?.ownerUserId,
        legacyClaimed: metadata?.legacyClaimed ?? false,
      }),
      transaction.done,
    ])
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_STORAGE_KEY)
    return cloneState(resetState)
  }

  close(): void {
    this.database?.close()
    this.database = undefined
  }

  async destroy(): Promise<void> {
    this.close()
    await deleteDB(this.databaseName)
  }

  private requireDatabase(): IDBPDatabase<GroceaDatabase> {
    if (!this.database) throw new Error('Grocea storage is not open.')
    return this.database
  }
}

export const groceaStorage = new IndexedDbGroceaStorage()

export function createGroceaStorage(userId: string): IndexedDbGroceaStorage {
  return new IndexedDbGroceaStorage(initialState, `${DATABASE_NAME}:${userId}`, userId)
}

export async function legacyStorageExists(): Promise<boolean> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_STORAGE_KEY) !== null) return true
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return false
  const databases = await indexedDB.databases()
  return databases.some(database => database.name === DATABASE_NAME)
}

export async function legacyStorageOwner(): Promise<string | null> {
  if (typeof localStorage !== 'undefined') {
    const localOwner = localStorage.getItem(LEGACY_OWNER_KEY)
    if (localOwner) return localOwner
  }
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return null
  const databases = await indexedDB.databases()
  if (!databases.some(database => database.name === DATABASE_NAME)) return null
  const database = await openDB<GroceaDatabase>(DATABASE_NAME)
  try {
    if (!database.objectStoreNames.contains('metadata')) return null
    return (await database.get('metadata', DATABASE_METADATA_KEY))?.ownerUserId ?? null
  } finally {
    database.close()
  }
}

export async function deleteLegacyStorage(expectedOwner?: string): Promise<void> {
  const owner = await legacyStorageOwner()
  if (expectedOwner && owner && owner !== expectedOwner) throw new Error('Legacy local data is owned by another account.')
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem(LEGACY_OWNER_KEY)
  }
  if (typeof indexedDB !== 'undefined') await deleteDB(DATABASE_NAME)
}

export async function migrateLegacyStorage(userId: string): Promise<void> {
  const accountStorage = createGroceaStorage(userId)
  await accountStorage.open()
  let legacyClaimed = false
  let localStorageClaimed = false

  const legacyRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null
  const localOwner = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_OWNER_KEY) : null
  if (localOwner && localOwner !== userId) {
    accountStorage.close()
    throw new Error('Legacy local data is already claimed by another account.')
  }
  if (legacyRaw !== null) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LEGACY_OWNER_KEY, userId)
    const imported = importLegacy(initialState, legacyRaw)
    await accountStorage.saveState(imported.state)
    localStorageClaimed = true
  }

  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases()
    if (databases.some(database => database.name === DATABASE_NAME)) {
      const legacy = await openDB<GroceaDatabase>(DATABASE_NAME)
      const metadata = legacy.objectStoreNames.contains('metadata')
        ? await legacy.get('metadata', DATABASE_METADATA_KEY)
        : undefined
      if (metadata?.ownerUserId && metadata.ownerUserId !== userId) {
        legacy.close()
        accountStorage.close()
        throw new Error('Legacy local data is already claimed by another account.')
      }
      if (legacy.objectStoreNames.contains('metadata')) {
        await legacy.put('metadata', {
          key: DATABASE_METADATA_KEY,
          schemaVersion: metadata?.schemaVersion ?? DATABASE_VERSION,
          seedVersion: metadata?.seedVersion ?? SEED_VERSION,
          migrationStatus: metadata?.migrationStatus ?? 'none',
          deviceId: metadata?.deviceId ?? crypto.randomUUID(),
          syncCursor: metadata?.syncCursor ?? null,
          remoteImportStatus: metadata?.remoteImportStatus ?? 'pending',
          importId: metadata?.importId ?? crypto.randomUUID(),
          importConflicts: metadata?.importConflicts ?? [],
          ownerUserId: userId,
          legacyClaimed: true,
        })
      }
      const state = legacy.objectStoreNames.contains('state')
        ? await legacy.get('state', CURRENT_STATE_KEY)
        : undefined
      const canonical = legacy.objectStoreNames.contains('canonical')
        ? await legacy.get('canonical', CURRENT_STATE_KEY)
        : undefined
      const mutations = legacy.objectStoreNames.contains('outbox') ? await legacy.getAll('outbox') : []
      if (legacy.objectStoreNames.contains('metadata')) {
        const nextMetadata: DatabaseMetadata = {
          key: DATABASE_METADATA_KEY,
          schemaVersion: metadata?.schemaVersion ?? DATABASE_VERSION,
          seedVersion: metadata?.seedVersion ?? SEED_VERSION,
          migrationStatus: metadata?.migrationStatus ?? 'none',
          deviceId: metadata?.deviceId ?? crypto.randomUUID(),
          syncCursor: null,
          remoteImportStatus: 'pending',
          importId: metadata?.importId ?? crypto.randomUUID(),
          importConflicts: metadata?.importConflicts ?? [],
          ownerUserId: userId,
          legacyClaimed: true,
        }
        await legacy.put('metadata', nextMetadata)
        const accountMetadata = await accountStorage.getMetadata()
        await accountStorage.saveMetadata({ ...accountMetadata, ...nextMetadata, ownerUserId: userId, legacyClaimed: true })
        const normalizedCanonical = canonical ? normalizeStateShape(canonical.value) : null
        if (normalizedCanonical && isGroceaState(normalizedCanonical)) await accountStorage.saveCanonicalState(normalizedCanonical)
        const normalized = state ? normalizeStateShape(state.value) : null
        if (normalized && isGroceaState(normalized)) await accountStorage.saveState(normalized)
        await Promise.all(mutations.map(mutation => accountStorage.enqueueMutation(mutation)))
        legacyClaimed = true
      }
      legacy.close()
    }
  }
  const metadata = await accountStorage.getMetadata()
  await accountStorage.saveMetadata({ ...metadata, legacyClaimed: metadata.legacyClaimed || legacyClaimed || localStorageClaimed, remoteImportStatus: 'pending', syncCursor: null })
  accountStorage.close()
}
