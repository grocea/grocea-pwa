import {
  ArrowRight,
  ArrowsLeftRight,
  CaretRight,
  Circle,
  ClockCounterClockwise,
  Drop,
  Egg,
  Equals,
  Grains,
  Info,
  Lightbulb,
  LockSimple,
  MagnifyingGlass,
  Minus,
  NotePencil,
  Package,
  Plus,
  User,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell, BackHeader, BrandHeader, OwnershipMark } from '../../shared/ui/AppShell'
import { defaultUnit, familyUnits, formatQuantity, parseQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { useGrocea as usePantry } from '../../app/grocea-context'
import type { DraftRecipe, Ingredient, MeasurementFamily, StockOperation, Unit } from '../../domain/types'

function ingredientIcon(ingredient: Ingredient) {
  const props = { size: 23, weight: 'regular' as const }
  if (ingredient.id === 'rice' || ingredient.family === 'mass') return <Grains {...props} />
  if (ingredient.family === 'volume') return <Drop {...props} />
  if (ingredient.id === 'eggs') return <Egg {...props} />
  return <Circle {...props} />
}

function SuccessNotice({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="success-notice" role="status">
      {message}
    </div>
  )
}

function safeRecipeReturnTo(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && url.pathname.startsWith('/recipes/')
      ? `${url.pathname}${url.search}${url.hash}`
      : null
  } catch {
    return null
  }
}

export function PantryScreen() {
  const { ingredients, balances, categories, categoryName, recipes } = usePantry()
  const location = useLocation()
  const navigate = useNavigate()
  const routeMessage = (location.state as { message?: string } | null)?.message
  const [notice] = useState(routeMessage)
  const [tab, setTab] = useState<'stock' | 'restock'>('stock')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const inStockCount = ingredients.filter((item) => (balances[item.id] ?? 0n) > 0n).length
  const restockCount = ingredients.length - inStockCount
  const publishedRecipeCount = recipes.filter((recipe) => recipe.status === 'published').length
  useEffect(() => {
    if (routeMessage) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, routeMessage])

  const shown = useMemo(
    () =>
      ingredients
        .filter((item) => {
          const balance = balances[item.id] ?? 0n
          const matchesTab = tab === 'stock' ? balance > 0n : balance <= 0n
          const matchesQuery = item.name.toLowerCase().includes(query.trim().toLowerCase())
          const matchesCategory = category === 'all' || item.categoryId === category
          return matchesTab && matchesQuery && matchesCategory
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [balances, category, ingredients, query, tab],
  )
  const ingredientGroups = useMemo(() => {
    if (query.trim()) {
      return [{ id: 'search-results', name: 'Search results', ingredients: shown, showCategory: true }]
    }

    const visibleCategories = category === 'all'
      ? categories
      : categories.filter((item) => item.id === category)
    const groups = visibleCategories
      .map((item) => ({
        id: item.id,
        name: item.name,
        ingredients: shown.filter((ingredient) => ingredient.categoryId === item.id),
        showCategory: false,
      }))
      .filter((group) => group.ingredients.length > 0)
    const knownCategoryIds = new Set(categories.map((item) => item.id))
    const uncategorized = shown.filter((ingredient) => !knownCategoryIds.has(ingredient.categoryId))

    if (uncategorized.length > 0) {
      groups.push({ id: 'other', name: 'Other', ingredients: uncategorized, showCategory: false })
    }
    return groups
  }, [categories, category, query, shown])

  return (
    <AppShell navigation>
      <BrandHeader />
      <main className="screen-content pantry-content">
        <SuccessNotice message={notice} />
        <header className="page-heading">
          <h1 data-page-title tabIndex={-1}>Pantry</h1>
          <p>{inStockCount} in stock · {restockCount} need restock</p>
        </header>

        <section className="pantry-pulse" aria-label="Pantry overview">
          <div>
            <span className="eyebrow">Pantry pulse</span>
            <strong>{inStockCount} <small>ingredients ready</small></strong>
            <p>{publishedRecipeCount ? `Browse ${publishedRecipeCount} recipes and see what your stock can make.` : 'Add recipes to connect your stock to cooking.'}</p>
          </div>
          <Link to="/recipes" className="pulse-action">Find a recipe <ArrowRight size={18} /></Link>
        </section>

        <div className="pantry-tools">
          <div className="segmented-control pantry-view-tabs" aria-label="Pantry stock view">
            <button type="button" className={tab === 'stock' ? 'selected' : ''} onClick={() => setTab('stock')} aria-pressed={tab === 'stock'}>
              <span>In stock</span><small>{inStockCount}</small>
            </button>
            <button type="button" className={tab === 'restock' ? 'selected' : ''} onClick={() => setTab('restock')} aria-pressed={tab === 'restock'}>
              <span>Needs restock</span><small>{restockCount}</small>
            </button>
          </div>

          <div className="filter-row pantry-filters">
            <label className="search-field">
              <MagnifyingGlass size={23} aria-hidden="true" />
              <span className="sr-only">Search pantry ingredients</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredients…" />
            </label>
            <label className="compact-select">
              <span className="sr-only">Filter by category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <Link className="floating-action pantry-add-stock" to="/pantry/stock/new"><Plus size={24} /> Add stock</Link>

        <section className="stock-list" aria-live="polite" aria-label={tab === 'stock' ? 'In-stock ingredients' : 'Ingredients needing restock'}>
          {ingredientGroups.map((group) => (
            <section className="stock-group" key={group.id} aria-labelledby={`stock-group-${group.id}`}>
              <header className="stock-group-heading">
                <h2 id={`stock-group-${group.id}`}>{group.name}</h2>
                <span>{group.ingredients.length} {group.ingredients.length === 1 ? 'ingredient' : 'ingredients'}</span>
              </header>
              <div className="stock-group-rows">
                {group.ingredients.map((ingredient) => {
                  const quantity = formatQuantity(balances[ingredient.id] ?? 0n, ingredient.family)
                  return (
                    <Link
                      key={ingredient.id}
                      className={`stock-row${(balances[ingredient.id] ?? 0n) <= 0n ? ' warning' : ''}`}
                      to={`/pantry/stock/new?ingredient=${ingredient.id}`}
                      aria-label={`Adjust stock for ${ingredient.name}, ${quantity} available`}
                    >
                      <span className="ingredient-icon">{ingredientIcon(ingredient)}</span>
                      <span className="stock-name"><strong>{ingredient.name}</strong>{group.showCategory && <small>{categoryName(ingredient.categoryId)}</small>}</span>
                      <span className="stock-quantity"><strong>{quantity}</strong></span>
                      <CaretRight className="stock-row-caret" size={18} weight="bold" aria-hidden="true" />
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
          {shown.length === 0 && <div className="empty-state"><strong>No ingredients found</strong><span>Try another search or category.</span></div>}
        </section>
      </main>
    </AppShell>
  )
}

export function AddStockScreen() {
  const { ingredients, balances, adjustStock } = usePantry()
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const returnTo = safeRecipeReturnTo(params.get('returnTo'))
  const sortedIngredients = useMemo(() => [...ingredients].sort((a, b) => a.name.localeCompare(b.name)), [ingredients])
  const requestedIngredient = params.get('ingredient')
  const firstId =
    sortedIngredients.find((item) => item.id === requestedIngredient)?.id ??
    sortedIngredients.find((item) => item.id === 'rice')?.id ??
    sortedIngredients[0]?.id ??
    ''
  const [ingredientId, setIngredientId] = useState(firstId)
  const [operation, setOperation] = useState<StockOperation>('add')
  const ingredient = sortedIngredients.find((item) => item.id === ingredientId) ?? sortedIngredients[0]
  const requestedUnit = params.get('unit') as Unit | null
  const initialUnit = requestedUnit && ingredient && familyUnits[ingredient.family].includes(requestedUnit)
    ? requestedUnit
    : defaultUnit(ingredient?.family ?? 'mass')
  const [unit, setUnit] = useState<Unit>(initialUnit)
  const [quantity, setQuantity] = useState(params.get('quantity') ?? '1')
  const [reason, setReason] = useState('Manual adjustment')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [quantityTouched, setQuantityTouched] = useState(false)
  const [reasonTouched, setReasonTouched] = useState(false)
  const [formError, setFormError] = useState('')
  const [projectionAnnouncement, setProjectionAnnouncement] = useState('')
  const quantityRef = useRef<HTMLInputElement>(null)
  const reasonRef = useRef<HTMLSelectElement>(null)

  const current = ingredient ? balances[ingredient.id] ?? 0n : 0n
  const parsed = parseQuantity(quantity, unit)
  const amountIsValid = parsed !== null && (operation === 'set' || parsed > 0n)
  const projected = !amountIsValid
    ? current
    : operation === 'set'
      ? parsed
      : operation === 'add'
        ? current + parsed
        : current - parsed
  const formattedAmount = parsed !== null && amountIsValid ? formatQuantity(parsed, ingredient?.family ?? 'mass') : null
  const deltaLabel = formattedAmount
    ? operation === 'set'
      ? 'Set balance'
      : `${operation === 'add' ? '+' : '−'}${formattedAmount}`
    : '—'
  const reasonLabel = reason === 'Manual adjustment' ? 'Manual' : reason
  const SubmitIcon = operation === 'add' ? Plus : operation === 'set' ? Equals : Minus
  const { pending, run } = usePendingAction(async () => {
    if (!ingredient || parsed === null || !amountIsValid || !reason || note.length > 500) return
    const detail = note.trim() ? `${reason}: ${note.trim()}` : reason
    await adjustStock(ingredient.id, operation, parsed, detail)
    const verb = operation === 'set' ? 'Set' : operation === 'add' ? 'Added' : 'Removed'
    const message = `${verb} ${formatQuantity(parsed, ingredient.family)} ${operation === 'set' ? 'for' : operation === 'add' ? 'to' : 'from'} ${ingredient.name}.`
    navigate(returnTo ?? '/pantry', { state: { message } })
  })
  const submitLabel = pending
    ? 'Saving…'
    : operation === 'set'
      ? 'Set balance'
      : `${operation === 'add' ? 'Add' : 'Remove'} ${quantity || 'quantity'} ${unit}`
  const quantityInvalid = (submitted || quantityTouched) && !amountIsValid
  const reasonInvalid = (submitted || reasonTouched) && !reason
  const noteInvalid = note.length > 500

  if (!ingredient) return null

  function announceProjectedBalance(overrides: { ingredient?: Ingredient; operation?: StockOperation; unit?: Unit } = {}) {
    const nextIngredient = overrides.ingredient ?? ingredient
    const nextOperation = overrides.operation ?? operation
    const nextUnit = overrides.unit ?? unit
    const nextParsed = parseQuantity(quantity, nextUnit)
    if (nextParsed === null || (nextOperation !== 'set' && nextParsed <= 0n)) {
      setProjectionAnnouncement('')
      return
    }
    const nextCurrent = balances[nextIngredient.id] ?? 0n
    const nextProjected = nextOperation === 'set'
      ? nextParsed
      : nextOperation === 'add'
        ? nextCurrent + nextParsed
        : nextCurrent - nextParsed
    const amount = formatQuantity(nextParsed, nextIngredient.family)
    const action = nextOperation === 'set' ? `Set balance to ${amount}` : `${nextOperation === 'add' ? 'Add' : 'Remove'} ${amount}`
    setProjectionAnnouncement(`${action}. New balance ${formatQuantity(nextProjected, nextIngredient.family)}.`)
  }

  function changeIngredient(id: string) {
    const next = sortedIngredients.find((item) => item.id === id)
    if (!next) return
    const nextUnit = defaultUnit(next.family)
    setIngredientId(id)
    setUnit(nextUnit)
    announceProjectedBalance({ ingredient: next, unit: nextUnit })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (!amountIsValid || parsed === null) { quantityRef.current?.focus(); return }
    if (!reason) { reasonRef.current?.focus(); return }
    if (note.length > 500) return
    try {
      await run()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Stock could not be updated. Try again.')
    }
  }

  return (
    <AppShell>
      <BackHeader title="Adjust stock" eyebrow={operation === 'add' ? 'Increase pantry stock' : operation === 'set' ? 'Set pantry balance' : 'Decrease pantry stock'} fallbackTo={returnTo ?? '/pantry'} action={<span className="history-status" role="status" aria-label="Creates an activity record after saving"><ClockCounterClockwise aria-hidden="true" /><span>Creates activity record</span></span>} />
      <form className="form-screen stock-adjustment-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <div className="form-error-banner" role="alert"><WarningCircle size={20} aria-hidden="true" /><span><strong>Stock was not updated</strong><small>{formError}</small></span></div>}
        <p className="sr-only" data-testid="stock-projection-announcement" role="status" aria-live="polite" aria-atomic="true">{projectionAnnouncement}</p>
        <div className="stock-adjustment-layout">
          <section className="workflow-card stock-form-card">
            <section className="workflow-section" aria-labelledby="stock-item-heading">
              <header className="workflow-section-heading"><span><Package aria-hidden="true" /></span><h2 id="stock-item-heading">1. Stock item</h2></header>
              <div className="field-group ingredient-field">
                <label htmlFor="ingredient">Ingredient</label>
                <div className="ingredient-select-control">
                  <span className="ingredient-select-icon" aria-hidden="true">{ingredientIcon(ingredient)}</span>
                  <select id="ingredient" value={ingredient.id} disabled={pending} onChange={(event) => changeIngredient(event.target.value)}>
                    {sortedIngredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section className="workflow-section" aria-labelledby="adjustment-heading">
              <header className="workflow-section-heading"><span><ArrowsLeftRight aria-hidden="true" /></span><h2 id="adjustment-heading">2. Adjustment</h2></header>
              <fieldset className="field-group">
                <legend>Operation</legend>
                <div className="segmented-control three operation-control">
                  {(['add', 'set', 'remove'] as StockOperation[]).map((item) => {
                    const Icon = item === 'add' ? Plus : item === 'set' ? Equals : Minus
                    return <button key={item} type="button" disabled={pending} className={operation === item ? 'selected' : ''} onClick={() => { setOperation(item); announceProjectedBalance({ operation: item }) }} aria-pressed={operation === item}><Icon aria-hidden="true" />{item[0].toUpperCase() + item.slice(1)}</button>
                  })}
                </div>
              </fieldset>

              <div className="stock-quantity-row">
                <div className="field-group quantity-field">
                  <label htmlFor="quantity">Quantity</label>
                  <input ref={quantityRef} id="quantity" inputMode="decimal" value={quantity} disabled={pending} onBlur={() => { setQuantityTouched(true); announceProjectedBalance() }} onChange={(event) => setQuantity(event.target.value)} aria-describedby={`quantity-help${quantityInvalid ? ' quantity-error' : ''}`} aria-invalid={quantityInvalid} />
                </div>
                <div className="field-group unit-field">
                  <label htmlFor="unit">Unit</label>
                  <select id="unit" value={unit} disabled={pending} onChange={(event) => { const nextUnit = event.target.value as Unit; setUnit(nextUnit); announceProjectedBalance({ unit: nextUnit }) }}>
                    {familyUnits[ingredient.family].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              <small className="field-help" id="quantity-help"><Info aria-hidden="true" />{ingredient.family[0].toUpperCase() + ingredient.family.slice(1)} units only for {ingredient.name}.</small>
              {quantityInvalid && <span className="field-error" id="quantity-error" role="alert">Enter {operation === 'set' ? 'a valid signed balance' : 'a quantity greater than zero'}.</span>}

              <div className={`balance-preview mobile-balance-preview${projected <= 0n ? ' warning' : ''}`}>
                <span><small>Current</small><strong>{formatQuantity(current, ingredient.family)}</strong></span>
                <span className="balance-delta"><small>{deltaLabel}</small><ArrowRight aria-hidden="true" /></span>
                <span><small>New balance</small><strong>{formatQuantity(projected, ingredient.family)}</strong></span>
              </div>
            </section>

            <section className="workflow-section" aria-labelledby="record-details-heading">
              <header className="workflow-section-heading"><span><NotePencil aria-hidden="true" /></span><h2 id="record-details-heading">3. Record details</h2></header>
              <div className="record-detail-fields">
                <div className="field-group split-field">
                  <label htmlFor="reason">Reason</label>
                  <select ref={reasonRef} id="reason" value={reason} disabled={pending} onBlur={() => setReasonTouched(true)} onChange={(event) => setReason(event.target.value)} aria-invalid={reasonInvalid} aria-describedby={`reason-help${reasonInvalid ? ' reason-error' : ''}`}>
                    <option value="Manual adjustment">Manual</option><option>Groceries</option><option>Correction</option><option>Waste</option><option>Other</option>
                  </select>
                  <small id="reason-help">Shown in activity history.</small>
                  {reasonInvalid && <span className="field-error" id="reason-error" role="alert">Select a reason for this stock change.</span>}
                </div>

                <div className="field-group grow-field">
                  <label htmlFor="note">Note <span>· optional</span></label>
                  <textarea id="note" value={note} disabled={pending} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" maxLength={501} aria-invalid={noteInvalid} aria-describedby={noteInvalid ? 'note-error' : undefined} />
                  {noteInvalid && <span className="field-error" id="note-error" role="alert">Note must be 500 characters or fewer.</span>}
                </div>
              </div>
            </section>

            <div className="form-actions">
              <button type="button" className="secondary-button" disabled={pending} onClick={() => navigate(returnTo ?? '/pantry')}>Cancel</button>
              <button type="submit" className="primary-button" disabled={pending}><SubmitIcon aria-hidden="true" />{submitLabel}</button>
            </div>
          </section>

          <aside className="stock-summary-panel" aria-label="Stock adjustment summary">
            <section className={`stock-balance-card${projected <= 0n ? ' warning' : ''}`}>
              <header><span>After adjustment</span><strong>{deltaLabel}</strong></header>
              <p>{formatQuantity(projected, ingredient.family)}</p>
              <small>New {ingredient.name} balance</small>
              <footer><span>Current</span><strong>{formatQuantity(current, ingredient.family)}</strong></footer>
            </section>
            <section className="activity-summary-card">
              <h2><ClockCounterClockwise aria-hidden="true" />Activity record</h2>
              <dl><div><dt>Ingredient</dt><dd>{ingredient.name}</dd></div><div><dt>Change</dt><dd>{deltaLabel}</dd></div><div><dt>Reason</dt><dd>{reasonLabel}</dd></div></dl>
            </section>
            <div className="summary-note"><Lightbulb aria-hidden="true" /><span>Balance updates immediately. You can reverse this entry later from Activity.</span></div>
          </aside>
        </div>
      </form>
    </AppShell>
  )
}

export function CatalogScreen() {
  const { ingredients, categories, categoryName } = usePantry()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as { message?: string; scope?: 'global' | 'custom' } | null
  const [notice] = useState(routeState?.message)
  const [scope, setScope] = useState<'global' | 'custom'>(routeState?.scope ?? 'global')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const globalCount = ingredients.filter((item) => item.scope === 'global').length
  const customCount = ingredients.length - globalCount
  useEffect(() => {
    if (routeState) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, routeState])

  const shown = useMemo(
    () => ingredients
      .filter((item) => item.scope === scope)
      .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
      .filter((item) => category === 'all' || item.categoryId === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [category, ingredients, query, scope],
  )

  return (
    <AppShell navigation>
      <BrandHeader />
      <main className="screen-content catalog-content">
        <SuccessNotice message={notice} />
        <header className="catalog-heading">
          <div><h1 data-page-title tabIndex={-1}>Ingredients</h1><p>{globalCount} global · {customCount} yours</p></div>
          <Link className="new-button" to="/ingredients/new"><Plus size={20} /> New</Link>
        </header>

        <label className="search-field catalog-search">
          <MagnifyingGlass size={22} aria-hidden="true" />
          <span className="sr-only">Search ingredient catalog</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ingredient catalog…" />
        </label>

        <div className="segmented-control" aria-label="Ingredient ownership">
          <button type="button" className={scope === 'global' ? 'selected' : ''} onClick={() => setScope('global')} aria-pressed={scope === 'global'}>Global</button>
          <button type="button" className={scope === 'custom' ? 'selected' : ''} onClick={() => setScope('custom')} aria-pressed={scope === 'custom'}>Yours</button>
        </div>

        <div className="category-chips" aria-label="Filter ingredients by category">
          <button type="button" className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')} aria-pressed={category === 'all'}>All</button>
          {categories.slice(0, 3).map((item) => <button type="button" key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)} aria-pressed={category === item.id}>{item.name}</button>)}
        </div>

        <div className="catalog-sort"><strong>Alphabetical</strong><label><span className="sr-only">Category filter</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>

        <section className="catalog-list" aria-live="polite">
          {shown.map((ingredient) => (
            <article key={ingredient.id} className="catalog-row">
              <span><strong>{ingredient.name}</strong><small>{categoryName(ingredient.categoryId)} · {ingredient.family[0].toUpperCase() + ingredient.family.slice(1)}</small></span>
              {ingredient.scope === 'global' ? <span className="scope-mark" role="img" aria-label="Global ingredient" title="Global ingredient"><LockSimple aria-hidden="true" /></span> : <OwnershipMark label="Your ingredient" />}
            </article>
          ))}
          {shown.length === 0 && <div className="empty-state"><strong>{scope === 'custom' ? 'No custom ingredients yet' : 'No ingredients found'}</strong><span>{scope === 'custom' ? 'Create one when the global catalog has no match.' : 'Try another search or category.'}</span></div>}
        </section>
      </main>
    </AppShell>
  )
}

export function CreateIngredientScreen() {
  const { ingredients, categories, recipes, createIngredient, updateRecipeDraft } = usePantry()
  const navigate = useNavigate()
  const { recipeId } = useParams()
  const draft = recipes.find((recipe): recipe is DraftRecipe => recipe.id === recipeId && recipe.status === 'draft')
  const requestedName = new URLSearchParams(useLocation().search).get('name') ?? ''
  const [name, setName] = useState(requestedName)
  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.id === 'pantry')?.id ?? categories[0]?.id ?? '',
  )
  const [family, setFamily] = useState<MeasurementFamily>('mass')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const trimmedName = name.trim()
  const duplicate = ingredients.some((item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase())
  const nameError = trimmedName.length === 0 ? 'Enter an ingredient name.' : trimmedName.length > 120 ? 'Name must be 120 characters or fewer.' : duplicate ? 'An ingredient with this name already exists.' : ''
  const showNameError = Boolean(nameError) && (submitted || name.length > 0)

  const { pending, run } = usePendingAction(async () => {
    const id = await createIngredient(trimmedName, categoryId, family, Boolean(draft))
    if (draft) {
      await updateRecipeDraft(draft.id, { ingredients: [...draft.ingredients, { ingredientId: id, quantity: '', unit: defaultUnit(family) }] })
      navigate(`/recipes/${draft.id}/edit/ingredients`, { state: { message: `${trimmedName} created and selected.` } })
      return
    }
    navigate('/ingredients', { state: { message: `${trimmedName} added to your ingredients.`, scope: 'custom' } })
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (nameError || !categoryId) { nameRef.current?.focus(); return }
    try {
      await run()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Ingredient could not be created. Try again.')
    }
  }

  return (
    <AppShell>
      <BackHeader title="Create ingredient" eyebrow="Add a custom pantry item" fallbackTo={draft ? `/recipes/${draft.id}/edit/ingredients` : '/ingredients'} />
      <form className="form-screen create-form workflow-form" onSubmit={submit} noValidate aria-busy={pending}>
        {formError && <div className="form-error-banner" role="alert"><WarningCircle size={20} aria-hidden="true" /><span><strong>Ingredient was not created</strong><small>{formError}</small></span></div>}
        <div className="info-banner"><Info size={21} /><span>Create custom ingredient only when catalog search has no match.</span></div>
        <div className="workflow-layout">
          <section className="workflow-card create-workflow-card">
            <section className="workflow-section">
              <header className="workflow-section-heading"><span><Package aria-hidden="true" /></span><h2>1. Ingredient details</h2></header>
              <div className="create-detail-fields">
                <div className="field-group">
                  <label htmlFor="name">Name</label>
                  <input ref={nameRef} id="name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} placeholder="Tempeh" aria-describedby="name-help name-error" aria-invalid={showNameError} />
                  <small id="name-help">Compared case-insensitively with global and custom names.</small>
                  {showNameError && <span className="field-error" id="name-error" role="alert">{nameError}</span>}
                </div>
                <div className="field-group split-field">
                  <label htmlFor="category">Category</label>
                  <select id="category" value={categoryId} disabled={pending} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                </div>
              </div>
            </section>
            <section className="workflow-section">
              <header className="workflow-section-heading"><span><ArrowsLeftRight aria-hidden="true" /></span><h2>2. Measurement</h2></header>
              <fieldset className="field-group">
                <legend>Measurement family</legend>
                <div className="segmented-control three operation-control">
                  {(['mass', 'volume', 'count'] as MeasurementFamily[]).map((item) => <button key={item} type="button" disabled={pending} className={family === item ? 'selected' : ''} onClick={() => setFamily(item)} aria-pressed={family === item}>{item[0].toUpperCase() + item.slice(1)}</button>)}
                </div>
              </fieldset>
              <div className="units-card"><span><small>Supported units</small><strong>{familyUnits[family].join(' · ')}</strong></span><p>Measurement family cannot change after ingredient is used in stock, recipes or history.</p></div>
            </section>
            <div className="form-actions">
              <button type="button" className="secondary-button" disabled={pending} onClick={() => navigate(draft ? `/recipes/${draft.id}/edit/ingredients` : '/ingredients')}>Cancel</button>
              <button type="submit" className="primary-button" disabled={pending}><Plus aria-hidden="true" />{pending ? 'Creating…' : 'Create ingredient'}</button>
            </div>
          </section>
          <aside className="workflow-summary-panel">
            <div className="ownership-card"><span className="user-icon"><User size={22} /></span><span><strong>Custom ingredient</strong><small>Saved to your account</small></span></div>
            <div className="summary-note"><Lightbulb aria-hidden="true" /><span>Custom ingredients remain editable until they appear in stock, recipes, or activity history.</span></div>
          </aside>
        </div>
      </form>
    </AppShell>
  )
}
