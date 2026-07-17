import {
  ArrowRight,
  Circle,
  Drop,
  Egg,
  Grains,
  Info,
  MagnifyingGlass,
  Plus,
  User,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, BackHeader, BrandHeader } from './components'
import { defaultUnit, familyUnits, formatQuantity, parseQuantity } from './quantity'
import { usePantry } from './store-context'
import type { Ingredient, MeasurementFamily, StockOperation, Unit } from './types'

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

export function PantryScreen() {
  const { ingredients, balances, categories, categoryName } = usePantry()
  const location = useLocation()
  const navigate = useNavigate()
  const routeMessage = (location.state as { message?: string } | null)?.message
  const [notice] = useState(routeMessage)
  const [tab, setTab] = useState<'stock' | 'restock'>('stock')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const inStockCount = ingredients.filter((item) => (balances[item.id] ?? 0n) > 0n).length
  const restockCount = ingredients.length - inStockCount
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

  return (
    <AppShell navigation>
      <BrandHeader />
      <main className="screen-content pantry-content">
        <SuccessNotice message={notice} />
        <header className="page-heading">
          <h1>Pantry</h1>
          <p>{inStockCount} in stock · {restockCount} need restock</p>
        </header>

        {restockCount > 0 && (
          <button className="restock-alert" type="button" onClick={() => setTab('restock')}>
            <WarningCircle size={25} weight="regular" />
            <span><strong>{restockCount} items worth checking</strong><small>Plan restock before your next cook</small></span>
          </button>
        )}

        <div className="segmented-control" aria-label="Pantry stock view">
          <button type="button" className={tab === 'stock' ? 'selected' : ''} onClick={() => setTab('stock')} aria-pressed={tab === 'stock'}>In stock</button>
          <button type="button" className={tab === 'restock' ? 'selected' : ''} onClick={() => setTab('restock')} aria-pressed={tab === 'restock'}>Needs restock</button>
        </div>

        <div className="filter-row">
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

        <section className="stock-list" aria-live="polite" aria-label={tab === 'stock' ? 'In-stock ingredients' : 'Ingredients needing restock'}>
          {shown.map((ingredient) => (
            <Link key={ingredient.id} className={`stock-row${(balances[ingredient.id] ?? 0n) <= 0n ? ' warning' : ''}`} to={`/pantry/stock/new?ingredient=${ingredient.id}`}>
              <span className="ingredient-icon">{ingredientIcon(ingredient)}</span>
              <span className="stock-name"><strong>{ingredient.name}</strong><small>{categoryName(ingredient.categoryId)}</small></span>
              <span className="stock-quantity"><strong>{formatQuantity(balances[ingredient.id] ?? 0n, ingredient.family)}</strong><small>Adjust</small></span>
            </Link>
          ))}
          {shown.length === 0 && <div className="empty-state"><strong>No ingredients found</strong><span>Try another search or category.</span></div>}
        </section>
      </main>
      <Link className="floating-action" to="/pantry/stock/new"><Plus size={24} /> Add stock</Link>
    </AppShell>
  )
}

export function AddStockScreen() {
  const { ingredients, balances, adjustStock } = usePantry()
  const navigate = useNavigate()
  const params = new URLSearchParams(useLocation().search)
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
  const [unit, setUnit] = useState<Unit>(defaultUnit(ingredient?.family ?? 'mass'))
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('Groceries')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!ingredient) return null
  const current = balances[ingredient.id] ?? 0n
  const parsed = parseQuantity(quantity, unit)
  const amountIsValid = parsed !== null && (operation === 'set' || parsed > 0n)
  const projected = !amountIsValid
    ? current
    : operation === 'set'
      ? parsed
      : operation === 'add'
        ? current + parsed
        : current - parsed

  function changeIngredient(id: string) {
    const next = sortedIngredients.find((item) => item.id === id)
    if (!next) return
    setIngredientId(id)
    setUnit(defaultUnit(next.family))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!amountIsValid || parsed === null || note.length > 500) return
    adjustStock(ingredient.id, operation, parsed, note.trim() || reason)
    const verb = operation === 'set' ? 'Set' : operation === 'add' ? 'Added' : 'Removed'
    navigate('/pantry', { state: { message: `${verb} ${formatQuantity(parsed, ingredient.family)} ${operation === 'set' ? 'for' : operation === 'add' ? 'to' : 'from'} ${ingredient.name}.` } })
  }

  return (
    <AppShell>
      <BackHeader title="Add stock" />
      <form className="form-screen" onSubmit={submit} noValidate>
        <div className="field-group ingredient-field">
          <label htmlFor="ingredient">Ingredient</label>
          <select id="ingredient" value={ingredient.id} onChange={(event) => changeIngredient(event.target.value)}>
            {sortedIngredients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <fieldset className="field-group">
          <legend>Operation</legend>
          <div className="segmented-control three">
            {(['add', 'set', 'remove'] as StockOperation[]).map((item) => (
              <button key={item} type="button" className={operation === item ? 'selected' : ''} onClick={() => setOperation(item)} aria-pressed={operation === item}>{item[0].toUpperCase() + item.slice(1)}</button>
            ))}
          </div>
        </fieldset>

        <div className="field-group">
          <label htmlFor="quantity">Quantity</label>
          <div className="quantity-inputs">
            <input id="quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-describedby="quantity-help quantity-error" />
            <select value={unit} onChange={(event) => setUnit(event.target.value as Unit)} aria-label="Unit">
              {familyUnits[ingredient.family].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <small id="quantity-help">{ingredient.family[0].toUpperCase() + ingredient.family.slice(1)} units only for this ingredient.</small>
          {submitted && !amountIsValid && <span className="field-error" id="quantity-error" role="alert">Enter {operation === 'set' ? 'a valid signed balance' : 'a quantity greater than zero'}.</span>}
        </div>

        <div className={`balance-preview${projected <= 0n ? ' warning' : ''}`} aria-live="polite">
          <span><small>Current</small><strong>{formatQuantity(current, ingredient.family)}</strong></span>
          <ArrowRight size={24} />
          <span><small>New balance</small><strong>{formatQuantity(projected, ingredient.family)}</strong></span>
        </div>

        <div className="field-group split-field">
          <label htmlFor="reason">Reason <span>· optional</span></label>
          <select id="reason" value={reason} onChange={(event) => setReason(event.target.value)}>
            <option>Groceries</option><option>Correction</option><option>Waste</option><option>Other</option>
          </select>
        </div>

        <div className="field-group grow-field">
          <label htmlFor="note">Note <span>· optional</span></label>
          <textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a short note…" maxLength={501} aria-describedby="note-error" />
          {note.length > 500 && <span className="field-error" id="note-error" role="alert">Note must be 500 characters or fewer.</span>}
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="primary-button" disabled={!amountIsValid || note.length > 500}>
            {operation === 'set' ? 'Set balance' : `${operation === 'add' ? 'Add' : 'Remove'} ${quantity || 'quantity'} ${unit}`}
          </button>
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
          <div><h1>Ingredients</h1><p>{globalCount} global · {customCount} yours</p></div>
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
          <button type="button" className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>All</button>
          {categories.slice(0, 3).map((item) => <button type="button" key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => setCategory(item.id)}>{item.name}</button>)}
        </div>

        <div className="catalog-sort"><strong>Alphabetical</strong><label><span className="sr-only">Category filter</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>

        <section className="catalog-list" aria-live="polite">
          {shown.map((ingredient) => (
            <article key={ingredient.id} className="catalog-row">
              <span><strong>{ingredient.name}</strong><small>{categoryName(ingredient.categoryId)} · {ingredient.family[0].toUpperCase() + ingredient.family.slice(1)}</small></span>
              <b>{ingredient.scope === 'global' ? 'Global' : 'Yours'}</b>
            </article>
          ))}
          {shown.length === 0 && <div className="empty-state"><strong>{scope === 'custom' ? 'No custom ingredients yet' : 'No ingredients found'}</strong><span>{scope === 'custom' ? 'Create one when the global catalog has no match.' : 'Try another search or category.'}</span></div>}
        </section>
      </main>
    </AppShell>
  )
}

export function CreateIngredientScreen() {
  const { ingredients, categories, createIngredient } = usePantry()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(
    categories.find((category) => category.id === 'pantry')?.id ?? categories[0]?.id ?? '',
  )
  const [family, setFamily] = useState<MeasurementFamily>('mass')
  const [submitted, setSubmitted] = useState(false)
  const trimmedName = name.trim()
  const duplicate = ingredients.some((item) => item.name.trim().toLowerCase() === trimmedName.toLowerCase())
  const nameError = trimmedName.length === 0 ? 'Enter an ingredient name.' : trimmedName.length > 120 ? 'Name must be 120 characters or fewer.' : duplicate ? 'An ingredient with this name already exists.' : ''
  const showNameError = Boolean(nameError) && (submitted || name.length > 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (nameError || !categoryId) return
    createIngredient(trimmedName, categoryId, family)
    navigate('/ingredients', {
      state: {
        message: `${trimmedName} added to your ingredients.`,
        scope: 'custom',
      },
    })
  }

  return (
    <AppShell>
      <BackHeader title="Create ingredient" />
      <form className="form-screen create-form" onSubmit={submit} noValidate>
        <div className="info-banner"><Info size={21} /><span>Create custom ingredient only when catalog search has no match.</span></div>
        <div className="field-group">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tempeh" aria-describedby="name-help name-error" aria-invalid={showNameError} />
          <small id="name-help">Compared case-insensitively with global and custom names.</small>
          {showNameError && <span className="field-error" id="name-error" role="alert">{nameError}</span>}
        </div>
        <div className="field-group split-field">
          <label htmlFor="category">Category</label>
          <select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        </div>
        <fieldset className="field-group">
          <legend>Measurement family</legend>
          <div className="segmented-control three">
            {(['mass', 'volume', 'count'] as MeasurementFamily[]).map((item) => <button key={item} type="button" className={family === item ? 'selected' : ''} onClick={() => setFamily(item)} aria-pressed={family === item}>{item[0].toUpperCase() + item.slice(1)}</button>)}
          </div>
        </fieldset>
        <div className="units-card"><span><small>Supported units</small><strong>{familyUnits[family].join(' · ')}</strong></span><p>Measurement family cannot change after ingredient is used in stock, recipes or history.</p></div>
        <div className="ownership-card"><span className="user-icon"><User size={22} /></span><span><strong>Custom ingredient</strong><small>Owned by local profile · editable later</small></span></div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="primary-button" disabled={Boolean(nameError)}>Create ingredient</button>
        </div>
      </form>
    </AppShell>
  )
}
