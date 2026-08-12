import {
  ArrowRight,
  Basket,
  Check,
  CheckCircle,
  ListChecks,
  PencilSimple,
  Plus,
  Receipt,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import type { BasketItem, GroceryListItem, Ingredient, Unit } from '../../domain/types'
import { familyUnits, formatQuantity, formatQuantityValue, parseQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader, BrandHeader, EmptyState, PageHeading, ToastNotice, UndoNotice } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

function Stepper({ value, label, disabled, onChange }: { value: number; label: string; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="stepper basket-stepper" role="group" aria-label={`Servings for ${label}`}>
    <button type="button" disabled={disabled || value <= 1} aria-label={`Decrease servings for ${label}`} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
    <strong aria-live="polite"><span>{value}</span></strong>
    <button type="button" disabled={disabled || value >= 12} aria-label={`Increase servings for ${label}`} onClick={() => onChange(Math.min(12, value + 1))}>+</button>
  </div>
}

function displayGroceryListTitle(title: string) {
  return title.replace(/^Groceries\s+—\s+/, '')
}

function useRouteToast() {
  const location = useLocation()
  const routeMessage = (location.state as { message?: string } | null)?.message
  return { message: routeMessage }
}

export function BasketScreen() {
  const { basket, groceryLists, syncIssues, addRecipeToBasket, removeRecipeFromBasket, clearBasket, confirmBasket } = useGrocea()
  const navigate = useNavigate()
  const [clearOpen, setClearOpen] = useState(false)
  const [error, setError] = useState('')
  const [undoItem, setUndoItem] = useState<BasketItem | null>(null)
  const [undoPending, setUndoPending] = useState(false)
  const [updatingRecipeId, setUpdatingRecipeId] = useState<string | null>(null)
  useEffect(() => {
    if (!undoItem) return
    const timer = window.setTimeout(() => setUndoItem(null), 8000)
    return () => window.clearTimeout(timer)
  }, [undoItem])
  const removeItem = async (item: BasketItem) => {
    setError('')
    try {
      await removeRecipeFromBasket(item.recipeId)
      setUndoItem(item)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recipe could not be removed from Basket.')
    }
  }
  const undoRemove = async () => {
    if (!undoItem) return
    setUndoPending(true)
    setError('')
    try {
      await addRecipeToBasket(undoItem.recipeId, undoItem.servings)
      setUndoItem(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recipe could not be restored.')
    } finally {
      setUndoPending(false)
    }
  }
  const updateServings = async (recipeId: string, servings: number) => {
    setUpdatingRecipeId(recipeId)
    setError('')
    try {
      await addRecipeToBasket(recipeId, servings)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Servings could not be saved.')
    } finally {
      setUpdatingRecipeId(null)
    }
  }
  const confirmAction = usePendingAction(async () => {
    setError('')
    try {
      const id = await confirmBasket()
      navigate(`/groceries/${id}`, { state: { message: 'Grocery list created.' } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Grocery list could not be created.')
    }
  })
  const active = groceryLists.find(list => list.status === 'active')
  const staleCalculation = syncIssues.find(issue => issue.type === 'grocery-list.create' && issue.error?.code === 'GROCERY_CALCULATION_STALE')
  const invalid = basket.some(item => !item.valid)
  return <AppShell><BackHeader title="Plan groceries" titleAs="span" fallbackTo="/recipes" />
    <main className="detail-screen grocery-screen basket-screen">
      <PageHeading title="Review basket" subtitle="Grocea adds only the items that you need to buy." />
      {error && <div className="warning-banner danger" role="alert"><WarningCircle /><span><strong>Couldn’t create list</strong><small>{error}</small></span></div>}
      {undoItem && <UndoNotice message={`${undoItem.recipeName} removed from Basket.`} pending={undoPending} onUndo={() => void undoRemove()} onDismiss={() => setUndoItem(null)} />}
      {active && <div className="warning-banner"><ListChecks /><span><strong>Active list in progress</strong><small>Complete or delete “{displayGroceryListTitle(active.title)}” before creating another.</small></span><Link className="button secondary compact" to={`/groceries/${active.id}`}>Open list</Link></div>}
      {staleCalculation && <div className="warning-banner danger"><WarningCircle /><span><strong>Grocery plan needs review</strong><small>Recipe or pantry data changed. Review the sync issue before you create this list.</small></span><Link className="button secondary compact" to="/sync-issues">Review issue</Link></div>}
      {!basket.length ? <EmptyState icon={Basket} title="Your basket is empty" message="Choose recipes to build a grocery list." action={<Link className="button primary" to="/recipes">Choose recipes</Link>} /> : <section className="basket-panel" aria-labelledby="basket-selection-title">
        <header className="basket-panel-header"><div><strong id="basket-selection-title">Selected recipes</strong><small>{basket.length} recipe{basket.length === 1 ? '' : 's'}</small></div></header>
        <section className="basket-list" aria-label="Selected recipes">{basket.map(item => <article className={`basket-row${item.valid ? '' : ' invalid'}`} key={item.recipeId}>
          <div className="basket-row-header"><span className="recipe-art"><Receipt size={25} /></span><span className="basket-recipe-copy"><strong>{item.recipeName}</strong>{!item.valid && <small>{item.error}</small>}</span><button className="icon-button basket-remove" type="button" aria-label={`Remove ${item.recipeName} from Basket`} title={`Remove ${item.recipeName} from Basket`} disabled={confirmAction.pending || undoPending} onClick={() => void removeItem(item)}><Trash size={18} /></button></div>
          <div className="basket-row-footer"><div className="basket-serving-control"><span>Servings</span><Stepper value={item.servings} label={item.recipeName} disabled={confirmAction.pending || undoPending || !item.valid || updatingRecipeId === item.recipeId} onChange={servings => void updateServings(item.recipeId, servings)} />{updatingRecipeId === item.recipeId && <small className="muted-copy" role="status">Saving…</small>}</div></div>
        </article>)}</section>
        <div className="basket-panel-add" role="group" aria-label="Basket actions"><Link className="button secondary compact basket-add-recipes" to="/recipes"><Plus size={17} />Add more recipes</Link></div>
        <footer className="basket-management"><div><strong>Basket management</strong><small>Remove all selected recipes.</small></div><button className="text-button danger-text basket-clear" type="button" onClick={() => setClearOpen(true)}><Trash size={17} />Clear basket</button></footer>
      </section>}
    </main>
    {basket.length > 0 && <div className="form-actions sticky grocery-flow-actions"><button className="button primary grocery-primary-action" type="button" disabled={Boolean(active) || Boolean(staleCalculation) || invalid || confirmAction.pending} aria-busy={confirmAction.pending} onClick={() => void confirmAction.run()}><ListChecks />{confirmAction.pending ? 'Calculating…' : 'Create list'}</button></div>}
    <ConfirmDialog open={clearOpen} title="Clear Basket?" description="This removes all selected recipes and serving changes." confirmLabel="Clear Basket" onDismiss={() => setClearOpen(false)} onConfirm={clearBasket} />
  </AppShell>
}

export function GroceriesScreen() {
  const { groceryLists, basket } = useGrocea()
  const { message } = useRouteToast()
  const active = groceryLists.find(list => list.status === 'active')
  const completed = groceryLists.filter(list => list.status === 'completed').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const checkedCount = active?.items.filter(item => item.checked).length ?? 0
  return <AppShell navigation><BrandHeader /><main className="screen-content grocery-hub"><ToastNotice message={message} /><PageHeading title="Groceries" action={<Link className="button secondary compact basket-link" to="/recipes/basket"><Basket />Basket{basket.length > 0 && <span className="count-badge">{basket.length}</span>}</Link>} />
    {active ? <section className="grocery-hub-section"><div className="section-label"><strong>Active list</strong><span>{checkedCount}/{active.items.length} checked</span></div><Link className="active-grocery-card" to={`/groceries/${active.id}`}><span className="menu-icon"><ListChecks /></span><span><strong>{displayGroceryListTitle(active.title)}</strong><small>{checkedCount} of {active.items.length} items checked</small></span><span className="grocery-card-action">Open list <ArrowRight /></span></Link></section> : <section className="grocery-next-step" aria-labelledby="grocery-next-step-title">
      <div className="grocery-next-step-copy">
        <div className="grocery-next-step-header"><span className="grocery-next-step-icon"><ListChecks size={25} /></span><div><span className="eyebrow">NEXT SHOP</span><h2 id="grocery-next-step-title">No grocery list yet</h2></div></div>
        <p>Choose recipes. Grocea uses your pantry stock to calculate what you need to buy.</p>
        <div className="grocery-next-step-actions"><Link className="button primary" to="/recipes">Choose recipes</Link>{basket.length > 0 && <Link className="button secondary compact" to="/recipes/basket">Review Basket <span className="count-badge">{basket.length}</span></Link>}</div>
      </div>
      <div className="grocery-how-it-works"><span className="eyebrow">HOW IT WORKS</span><ol><li><span>1</span><span><strong>Pick recipes</strong><small>Add dishes to Basket.</small></span></li><li><span>2</span><span><strong>Review what’s missing</strong><small>Grocea subtracts pantry stock.</small></span></li><li><span>3</span><span><strong>Shop with a focused list</strong><small>Check items off as you go.</small></span></li></ol></div>
    </section>}
    {completed.length > 0 && <details className="grocery-history-disclosure"><summary><span className="grocery-history-summary-copy"><strong>Past lists</strong><small>{completed.length} saved list{completed.length === 1 ? '' : 's'} · newest first</small></span><span className="grocery-history-summary-action">View history <ArrowRight /></span></summary><div className="grocery-history">{completed.map(list => <Link key={list.id} to={`/groceries/${list.id}`}><span><strong>{displayGroceryListTitle(list.title)}</strong><small>{new Date(list.completedAt ?? list.createdAt).toLocaleDateString()} · {list.items.length} items · {list.recipes.length} recipes</small></span><span className="grocery-card-action">Open list <ArrowRight /></span></Link>)}</div></details>}
  </main></AppShell>
}

function amountLabel(item: GroceryListItem) {
  if (item.quantity === undefined) return 'Amount not set'
  if (item.family) return formatQuantity(item.quantity, item.family)
  const whole = item.quantity / 1000n
  const fraction = (item.quantity % 1000n).toString().padStart(3, '0').replace(/0+$/, '')
  return `${whole}${fraction ? `.${fraction}` : ''}${item.unit ? ` ${item.unit}` : ''}`
}

function ItemEditor({ initial, ingredients, onCancel, onSave }: {
  initial?: GroceryListItem
  ingredients: Ingredient[]
  onCancel: () => void
  onSave: (item: Pick<GroceryListItem, 'label' | 'ingredientId' | 'quantity' | 'unit'>) => Promise<void>
}) {
  const [mode, setMode] = useState<'catalog' | 'custom'>(initial?.ingredientId ? 'catalog' : 'custom')
  const [ingredientId, setIngredientId] = useState(initial?.ingredientId ?? ingredients[0]?.id ?? '')
  const selectedIngredient = ingredients.find(item => item.id === ingredientId)
  const defaultUnit = selectedIngredient?.family === 'mass' ? 'g' : selectedIngredient?.family === 'volume' ? 'ml' : 'item'
  const [label, setLabel] = useState(initial?.label ?? '')
  const initialKnownUnit = initial?.unit && ['mg', 'g', 'kg', 'ml', 'L', 'item'].includes(initial.unit) ? initial.unit as Unit : defaultUnit
  const [unit, setUnit] = useState<string>(initialKnownUnit ?? '')
  const [amount, setAmount] = useState(() => initial?.quantity === undefined
    ? ''
    : initial?.family && initialKnownUnit
      ? formatQuantityValue(initial.quantity, initialKnownUnit)
      : (Number(initial.quantity) / 1000).toString())
  const [error, setError] = useState('')
  const action = usePendingAction(async () => {
    const activeIngredient = mode === 'catalog' ? selectedIngredient : undefined
    const activeUnit = mode === 'catalog' ? (unit || defaultUnit) : unit.trim()
    const quantity = amount.trim()
      ? parseQuantity(amount, mode === 'catalog' ? activeUnit as Unit : 'item') ?? undefined
      : undefined
    if (mode === 'catalog' && !activeIngredient) throw new Error('Choose an Ingredient.')
    if (mode === 'custom' && !label.trim()) throw new Error('Enter an item name.')
    if (amount.trim() && (!quantity || quantity <= 0n || !activeUnit)) throw new Error('Enter a positive amount and unit.')
    const storedUnit = activeIngredient
      ? activeIngredient.family === 'mass'
        ? 'g'
        : activeIngredient.family === 'volume'
          ? 'ml'
          : 'item'
      : activeUnit
    await onSave({
      ingredientId: activeIngredient?.id,
      label: activeIngredient?.name ?? label.trim(),
      quantity,
      unit: quantity ? storedUnit : undefined,
    })
  })
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try { await action.run() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Item could not be saved.') }
  }
  const availableUnits = selectedIngredient ? familyUnits[selectedIngredient.family] : []
  return <form className="grocery-item-editor" onSubmit={submit} aria-busy={action.pending}><div className="segmented-control" aria-label="Item type"><button type="button" className={mode === 'catalog' ? 'selected' : ''} aria-pressed={mode === 'catalog'} onClick={() => { setMode('catalog'); setUnit(defaultUnit ?? '') }}>Catalog</button><button type="button" className={mode === 'custom' ? 'selected' : ''} aria-pressed={mode === 'custom'} onClick={() => { setMode('custom'); setUnit('') }}>Custom</button></div>{mode === 'catalog' ? <label className="field-group"><span>Ingredient</span><select value={ingredientId} onChange={event => { const next = ingredients.find(item => item.id === event.target.value); setIngredientId(event.target.value); setUnit(next?.family === 'mass' ? 'g' : next?.family === 'volume' ? 'ml' : 'item') }}>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <label className="field-group"><span>Item name</span><input value={label} maxLength={120} onChange={event => setLabel(event.target.value)} /></label>}<div className="grocery-amount-fields"><label className="field-group"><span>Amount <small>optional</small></span><input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label><label className="field-group"><span>Unit</span>{mode === 'catalog' ? <select value={unit || defaultUnit} onChange={event => setUnit(event.target.value)}>{availableUnits.map(value => <option key={value} value={value}>{value}</option>)}</select> : <input value={unit} maxLength={40} placeholder="pack, bottle…" onChange={event => setUnit(event.target.value)} />}</label></div>{error && <p className="field-error" role="alert">{error}</p>}<div className="inline-actions"><button className="button secondary" type="button" disabled={action.pending} onClick={onCancel}>Cancel</button><button className="button primary" disabled={action.pending}>{action.pending ? 'Saving…' : initial ? 'Save item' : 'Add item'}</button></div></form>
}

export function GroceryListScreen() {
  const { id } = useParams()
  const {
    groceryLists,
    ingredients,
    balances,
    renameGroceryList,
    addGroceryItem,
    updateGroceryItem,
    removeGroceryItem,
    completeGroceryList,
    reuseGroceryList,
    deleteGroceryList,
  } = useGrocea()
  const navigate = useNavigate()
  const list = groceryLists.find(candidate => candidate.id === id)
  const [title, setTitle] = useState(list?.title ?? '')
  const [titleEditing, setTitleEditing] = useState(false)
  const [editing, setEditing] = useState<GroceryListItem | 'new' | null>(null)
  const [deleteMode, setDeleteMode] = useState<'delete' | 'restore' | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const completionRef = useRef<HTMLDialogElement>(null)
  const completionCancelRef = useRef<HTMLButtonElement>(null)
  const completionTriggerRef = useRef<HTMLElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [selectedPantryIds, setSelectedPantryIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [titleState, setTitleState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [deleteItemTarget, setDeleteItemTarget] = useState<GroceryListItem | null>(null)
  const { message } = useRouteToast()
  const eligible = list?.items.filter(item => item.checked && item.ingredientId && item.quantity !== undefined) ?? []
  const pantryPreviewTotals = new Map<string, bigint>()
  eligible.forEach(item => {
    if (!selectedPantryIds.has(item.id)) return
    const ingredientId = item.ingredientId!
    pantryPreviewTotals.set(ingredientId, (pantryPreviewTotals.get(ingredientId) ?? 0n) + item.quantity!)
  })
  const completeAction = usePendingAction(async () => {
    if (!list) return
    await completeGroceryList(list.id, [...selectedPantryIds])
    setCompletionOpen(false)
    navigate('/groceries', { state: { message: 'Grocery list completed.' } })
  })
  const reuseAction = usePendingAction(async () => {
    if (!list) return
    await reuseGroceryList(list.id)
    navigate('/recipes/basket')
  })
  useEffect(() => {
    const dialog = completionRef.current
    if (!dialog) return
    if (completionOpen) {
      completionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      completionCancelRef.current?.focus()
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
      completionTriggerRef.current?.focus()
    }
  }, [completionOpen])
  useEffect(() => {
    if (titleEditing) titleInputRef.current?.focus()
  }, [titleEditing])
  if (!list) return <AppShell><BackHeader title="Grocery list" fallbackTo="/groceries" /><EmptyState icon={ListChecks} title="Grocery list not found" message="This list may have been deleted." /></AppShell>
  const persistTitle = async () => {
    const nextTitle = title.trim()
    if (titleState === 'saving') return
    if (!nextTitle) {
      setTitleState('error')
      setError('')
      return
    }
    if (nextTitle === displayGroceryListTitle(list.title)) {
      setTitleEditing(false)
      setTitleState('idle')
      return
    }
    setTitleState('saving')
    setError('')
    try {
      await renameGroceryList(list.id, nextTitle)
      setTitleState('saved')
      setTitleEditing(false)
    } catch {
      setTitleState('error')
      setError('')
    }
  }
  const saveTitle = (event: FormEvent) => {
    event.preventDefault()
    void persistTitle()
  }
  const beginTitleEdit = () => {
    setTitle(displayGroceryListTitle(list.title))
    setTitleState('idle')
    setError('')
    setTitleEditing(true)
  }
  const finishTitleEdit = () => {
    if (title.trim() === displayGroceryListTitle(list.title)) setTitleEditing(false)
    else void persistTitle()
  }
  const active = list.status === 'active'
  const visibleItems = active ? list.items : list.items.filter(item => item.checked)
  const groups = [...new Set(visibleItems.map(item => item.categoryName))].sort().map(category => ({
    category,
    items: visibleItems.filter(item => item.categoryName === category).sort((a, b) => Number(a.checked) - Number(b.checked) || a.label.localeCompare(b.label)),
  }))
  const itemsWithSources = visibleItems.filter(item => item.sources.length > 0)
  const openCompletion = () => {
    setSelectedPantryIds(new Set(eligible.map(item => item.id)))
    setCompletionOpen(true)
  }
  const checkedCount = list.items.filter(item => item.checked).length
  const remainingCount = list.items.length - checkedCount
  return <AppShell><BackHeader title={active ? 'Shopping list' : 'Past list'} titleAs="span" fallbackTo="/groceries" eyebrow={active ? 'In progress' : new Date(list.completedAt ?? list.createdAt).toLocaleDateString()} />
    <main className="detail-screen grocery-screen grocery-list-screen"><ToastNotice message={message} />{error && <div className="warning-banner danger" role="alert"><WarningCircle /><span>{error}</span></div>}
      {active ? <section className="active-list-overview">
        {!titleEditing ? <div className="grocery-title-row"><div className="grocery-title-copy"><h1 data-page-title tabIndex={-1}>{displayGroceryListTitle(list.title)}</h1></div><button className="icon-button" type="button" aria-label="Edit list name" onClick={beginTitleEdit}><PencilSimple size={19} /></button></div> : <form className="grocery-title-form editing" onSubmit={saveTitle} aria-busy={titleState === 'saving'}>
          <label className="grocery-title-field"><span>List name</span><input ref={titleInputRef} value={title} maxLength={120} onChange={event => { setTitle(event.target.value); setTitleState('idle'); setError('') }} onBlur={finishTitleEdit} aria-describedby="grocery-title-status" /></label>
        </form>}
        {titleEditing && <small id="grocery-title-status" className="grocery-title-status" role={titleState === 'error' ? 'alert' : 'status'}>{titleState === 'saving' ? 'Saving…' : titleState === 'error' ? 'Could not save. Try again.' : 'Press Enter or move focus to save.'}</small>}
        {!titleEditing && titleState === 'saved' && <small className="grocery-title-status" role="status">Name saved.</small>}
        <div className="shopping-progress">
          <div><span className="shopping-progress-icon"><ListChecks size={21} /></span><span><strong>{checkedCount} of {list.items.length} purchased</strong><small>{remainingCount ? `${remainingCount} remaining` : 'Ready to complete'}</small></span></div>
          <progress max={Math.max(1, list.items.length)} value={checkedCount} aria-label={`${checkedCount} of ${list.items.length} grocery items purchased`} />
        </div>
      </section> : <section className="completed-list-summary"><span className="eyebrow">PAST LIST</span><h1 data-page-title tabIndex={-1}>{displayGroceryListTitle(list.title)}</h1><p>Completed {new Date(list.completedAt ?? list.createdAt).toLocaleDateString()} · {list.recipes.length} recipe{list.recipes.length === 1 ? '' : 's'}</p></section>}
      {active && <div className="shopping-list-toolbar"><div><strong>Items to buy</strong><small>{list.items.length} item{list.items.length === 1 ? '' : 's'}</small></div></div>}
      {editing && <ItemEditor initial={editing === 'new' ? undefined : editing} ingredients={[...ingredients].sort((a, b) => a.name.localeCompare(b.name))} onCancel={() => setEditing(null)} onSave={async input => { if (editing === 'new') await addGroceryItem(list.id, input); else await updateGroceryItem(list.id, { ...editing, ...input }); setEditing(null) }} />}
      {!list.items.length ? <div className="nothing-to-buy" role="status"><span><CheckCircle size={24} /></span><div><strong>Nothing to buy</strong><p>Your pantry has all required ingredients.</p></div></div> : !active && !visibleItems.length ? <div className="nothing-to-buy" role="status"><span><CheckCircle size={24} /></span><div><strong>No purchased items</strong><p>You completed this list without marking items as purchased.</p></div></div> : groups.map(group => <section className="grocery-group" key={group.category}><div className="section-label"><strong>{group.category}</strong><span>{group.items.length} item{group.items.length === 1 ? '' : 's'}</span></div><div className="grocery-items">{group.items.map(item => <article className={`grocery-item${active ? ' active' : ''}${item.checked ? ' checked' : ''}`} key={item.id}>{active ? <label className="grocery-check"><input type="checkbox" checked={item.checked} aria-label={`Mark ${item.label} ${item.checked ? 'not purchased' : 'purchased'}`} onChange={() => void updateGroceryItem(list.id, { ...item, checked: !item.checked })} /></label> : <span className="completion-mark"><Check /></span>}<span className="grocery-item-copy"><strong>{item.label}{item.edited && <small className="edited-badge">Edited</small>}</strong><small className="grocery-amount">Buy {amountLabel(item)}</small></span>{active && <span className="grocery-item-actions"><button className="icon-button" type="button" aria-label={`Edit ${item.label}`} onClick={() => setEditing(item)}><PencilSimple size={19} /></button><button className="icon-button danger-text" type="button" aria-label={`Delete ${item.label}`} onClick={() => setDeleteItemTarget(item)}><Trash size={19} /></button></span>}</article>)}</div></section>)}
      {active && <div className="shopping-list-add-action"><button className="button secondary compact add-grocery-item-button" type="button" aria-label="Add grocery item" onClick={() => setEditing('new')}><Plus />Add item</button></div>}
      <div className="grocery-list-disclosures"><details className="source-recipes"><summary><span>Recipes used for this list</span><span>{list.recipes.length} recipe{list.recipes.length === 1 ? '' : 's'}</span></summary>{list.recipes.map(recipe => <div key={recipe.recipeId}><span>{recipe.recipeName}</span><small>{recipe.servings} serving{recipe.servings === 1 ? '' : 's'}</small></div>)}</details>
      {active && itemsWithSources.length > 0 && <details className="amount-sources"><summary><span>Why these amounts</span><span>{itemsWithSources.length} item{itemsWithSources.length === 1 ? '' : 's'}</span></summary><div className="amount-source-list">{itemsWithSources.map(item => <div key={item.id}><span><strong>{item.label}</strong><small>Buy {amountLabel(item)}</small></span><span className="amount-source-details">{item.sources.map(source => <span key={source.recipeId}>{source.recipeName} · {formatQuantity(source.quantity, item.family ?? 'count')} for {source.servings} serving{source.servings === 1 ? '' : 's'}</span>)}{item.originalPantry !== undefined && <span>Pantry when created · {formatQuantity(item.originalPantry, item.family ?? 'count')}</span>}</span></div>)}</div></details>}
      {!active && <section className="list-management completed-list-actions"><button className="button secondary" type="button" disabled={reuseAction.pending} aria-busy={reuseAction.pending} onClick={() => void reuseAction.run().catch(cause => setError(cause instanceof Error ? cause.message : 'Recipes could not be reused.'))}><Basket />{reuseAction.pending ? 'Reusing…' : 'Reuse recipes'}</button><button className="text-button danger-text" type="button" onClick={() => setDeleteMode('delete')}><Trash />Delete history</button></section>}</div>
      {active && <section className="list-management grocery-active-actions"><div><strong>List management</strong><small>Return the source recipes to Basket, or delete this list.</small></div><div className="destructive-actions"><button className="button secondary compact" type="button" onClick={() => setDeleteMode('restore')}><Basket />Return recipes to Basket</button><button className="text-button danger-text" type="button" onClick={() => setDeleteMode('delete')}><Trash />Delete list</button></div></section>}
    </main>
    {active && <div className="form-actions sticky grocery-flow-actions"><button className="button primary grocery-primary-action" type="button" onClick={openCompletion}><CheckCircle />Complete list</button></div>}
    <dialog ref={completionRef} className="pantry-completion-dialog" aria-labelledby="complete-list-title" onCancel={event => { event.preventDefault(); if (!completeAction.pending) setCompletionOpen(false) }}><section className="pantry-completion">
      <header className="completion-header"><span><CheckCircle size={25} /></span><div><h2 id="complete-list-title">Complete shopping list?</h2><p>You can add checked items to Pantry before Grocea moves this list to Past lists.</p></div></header>
      {list.items.some(item => !item.checked) && <div className="warning-banner"><WarningCircle /><span><strong>{list.items.filter(item => !item.checked).length} item{list.items.filter(item => !item.checked).length === 1 ? '' : 's'} not marked purchased</strong><small>You can complete the list. Grocea will not add unchecked items to Pantry.</small></span></div>}
      <div className="completion-summary"><span><strong>{checkedCount} of {list.items.length} purchased</strong><small>You can add checked catalog items that have saved amounts to Pantry.</small></span><b>{eligible.length} eligible</b></div>
      {eligible.length ? <div className="pantry-preview">{eligible.map(item => {
        const ingredientId = item.ingredientId!
        const pantryBefore = balances[ingredientId] ?? 0n
        const pantryAfter = pantryBefore + (pantryPreviewTotals.get(ingredientId) ?? 0n)
        return <label key={item.id}><input type="checkbox" checked={selectedPantryIds.has(item.id)} onChange={() => setSelectedPantryIds(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} /><span><strong>{item.label}</strong><small>{amountLabel(item)} purchased</small></span><span className="pantry-change"><small>Pantry after completion</small><b>{formatQuantity(pantryBefore, item.family!)} → {formatQuantity(pantryAfter, item.family!)}</b></span></label>
      })}</div> : <p className="muted-copy completion-empty">Grocea cannot update Pantry because no checked catalog item has a saved amount.</p>}
      <div className="inline-actions completion-actions"><button ref={completionCancelRef} className="button secondary" disabled={completeAction.pending} onClick={() => setCompletionOpen(false)}>Cancel</button><button className="button primary grocery-primary-action" disabled={completeAction.pending} onClick={() => void completeAction.run().catch(cause => setError(cause instanceof Error ? cause.message : 'List could not be completed.'))}>{completeAction.pending ? 'Completing…' : selectedPantryIds.size ? 'Update Pantry & complete' : 'Complete without Pantry update'}</button></div>
    </section></dialog>
    <ConfirmDialog open={Boolean(deleteItemTarget)} title="Delete grocery item?" description={`This removes ${deleteItemTarget?.label ?? 'this item'} from the active list. To restore it, add it again.`} confirmLabel="Delete item" pendingLabel="Deleting…" onDismiss={() => setDeleteItemTarget(null)} onConfirm={async () => { if (deleteItemTarget) await removeGroceryItem(list.id, deleteItemTarget.id) }} />
    <ConfirmDialog open={deleteMode !== null} title={deleteMode === 'restore' ? 'Return recipes and delete list?' : 'Delete grocery list?'} description={deleteMode === 'restore' ? 'Grocea returns the source recipes to Basket and keeps the current Basket servings.' : 'This permanently deletes the grocery list and its history.'} confirmLabel={deleteMode === 'restore' ? 'Return and delete' : 'Delete list'} onDismiss={() => setDeleteMode(null)} onConfirm={async () => { await deleteGroceryList(list.id, deleteMode === 'restore'); navigate('/groceries', { state: { message: 'Grocery list deleted.' } }) }} />
  </AppShell>
}
