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
import type { GroceryListItem, Ingredient, Unit } from '../../domain/types'
import { familyUnits, formatQuantity, formatQuantityValue, parseQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader, BrandHeader, EmptyState, PageHeading, SuccessNotice } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

function Stepper({ value, label, disabled, onChange }: { value: number; label: string; disabled: boolean; onChange: (value: number) => void }) {
  return <div className="stepper basket-stepper" role="group" aria-label={`Servings for ${label}`}>
    <button type="button" disabled={disabled || value <= 1} aria-label={`Decrease servings for ${label}`} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
    <strong aria-live="polite"><span>{value}</span><small>servings</small></strong>
    <button type="button" disabled={disabled || value >= 12} aria-label={`Increase servings for ${label}`} onClick={() => onChange(Math.min(12, value + 1))}>+</button>
  </div>
}

export function BasketScreen() {
  const { basket, groceryLists, syncIssues, addRecipeToBasket, removeRecipeFromBasket, clearBasket, confirmBasket } = useGrocea()
  const navigate = useNavigate()
  const [clearOpen, setClearOpen] = useState(false)
  const [error, setError] = useState('')
  const confirmAction = usePendingAction(async () => {
    setError('')
    try {
      const id = await confirmBasket()
      navigate(`/groceries/${id}`, { state: { message: 'Grocery List created from your Basket.' } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Grocery List could not be created.')
    }
  })
  const active = groceryLists.find(list => list.status === 'active')
  const staleCalculation = syncIssues.find(issue => issue.type === 'grocery-list.create' && issue.error?.code === 'GROCERY_CALCULATION_STALE')
  const invalid = basket.some(item => !item.valid)
  const totalServings = basket.reduce((total, item) => total + item.servings, 0)
  return <AppShell><BackHeader title="Basket" fallbackTo="/recipes" eyebrow={`${basket.length} recipe${basket.length === 1 ? '' : 's'}`} />
    <main className="detail-screen grocery-screen basket-screen">
      <PageHeading title="Plan your groceries" subtitle="Choose how many servings you’ll cook. Grocea then subtracts Pantry stock and lists only what you need to buy." />
      {error && <div className="warning-banner danger" role="alert"><WarningCircle /><span><strong>Couldn’t create Grocery List</strong><small>{error}</small></span></div>}
      {active && <div className="warning-banner"><ListChecks /><span><strong>Active Grocery List in progress</strong><small>Complete or delete {active.title} before confirming this Basket.</small></span></div>}
      {staleCalculation && <div className="warning-banner danger"><WarningCircle /><span><strong>Groceries need fresh review</strong><small>Recipe or Pantry data changed during sync. Discard the rejected confirmation in Synchronization, then confirm this restored Basket again.</small></span><Link className="button secondary compact" to="/sync-issues">Review sync issue</Link></div>}
      {basket.length > 0 && <section className="basket-plan-summary" aria-label="Grocery plan summary">
        <span><ListChecks size={24} /></span>
        <div><strong>Grocea plans only what you’re missing</strong><p>{basket.length} recipe{basket.length === 1 ? '' : 's'} · {totalServings} planned serving{totalServings === 1 ? '' : 's'}. Pantry stock is subtracted when the list is created.</p></div>
      </section>}
      {!basket.length ? <EmptyState icon={Basket} title="Basket is empty" message="Add published Recipes, then return here to review servings." action={<Link className="button primary" to="/recipes">Browse recipes</Link>} /> : <section className="basket-list" aria-label="Selected recipes">{basket.map(item => <article className={`basket-row${item.valid ? '' : ' invalid'}`} key={item.recipeId}>
        <span className="recipe-art"><Receipt size={25} /></span>
        <span className="basket-recipe-copy"><strong>{item.recipeName}</strong><small>{item.valid ? `Recipe default · ${item.baseServings} serving${item.baseServings === 1 ? '' : 's'}` : item.error}</small></span>
        <div className="basket-serving-control"><span>Planned servings</span><Stepper value={item.servings} label={item.recipeName} disabled={confirmAction.pending || !item.valid} onChange={servings => void addRecipeToBasket(item.recipeId, servings)} /></div>
        <button className="icon-button danger-text" type="button" aria-label={`Remove ${item.recipeName} from Basket`} disabled={confirmAction.pending} onClick={() => void removeRecipeFromBasket(item.recipeId)}><Trash size={19} /></button>
      </article>)}</section>}
      {basket.length > 0 && <div className="basket-management"><span>Want to start over?</span><button className="text-button danger-text basket-clear" type="button" onClick={() => setClearOpen(true)}><Trash size={17} />Clear Basket</button></div>}
    </main>
    {basket.length > 0 && <div className="form-actions sticky grocery-flow-actions"><Link className="button secondary" to="/recipes">Add more recipes</Link><button className="button primary grocery-primary-action" type="button" disabled={Boolean(active) || Boolean(staleCalculation) || invalid || confirmAction.pending} aria-busy={confirmAction.pending} onClick={() => void confirmAction.run()}><ListChecks />{confirmAction.pending ? 'Calculating…' : 'Create Grocery List'}</button></div>}
    <ConfirmDialog open={clearOpen} title="Clear Basket?" description="Every selected Recipe and serving adjustment will be removed." confirmLabel="Clear Basket" onDismiss={() => setClearOpen(false)} onConfirm={clearBasket} />
  </AppShell>
}

export function GroceriesScreen() {
  const { groceryLists, basket } = useGrocea()
  const location = useLocation()
  const active = groceryLists.find(list => list.status === 'active')
  const completed = groceryLists.filter(list => list.status === 'completed').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const message = (location.state as { message?: string } | null)?.message
  return <AppShell navigation><BrandHeader /><main className="screen-content grocery-hub"><SuccessNotice message={message} /><PageHeading title="Groceries" subtitle={active ? 'One active list · history saved below' : `${completed.length} completed list${completed.length === 1 ? '' : 's'}`} action={<Link className="button secondary compact basket-link" to="/recipes/basket"><Basket />Basket{basket.length > 0 && <span className="count-badge">{basket.length}</span>}</Link>} />
    {active ? <section><div className="section-label"><strong>Active list</strong><span>{active.items.filter(item => item.checked).length}/{active.items.length} checked</span></div><Link className="active-grocery-card" to={`/groceries/${active.id}`}><span className="menu-icon"><ListChecks /></span><span><strong>{active.title}</strong><small>{active.items.length} items · Created {new Date(active.createdAt).toLocaleDateString()}</small></span><ArrowRight /></Link></section> : <EmptyState icon={ListChecks} title="No active Grocery List" message="Add Recipes to Basket and confirm them when you’re ready to shop." action={<Link className="button primary" to="/recipes">Choose recipes</Link>} />}
    <section><div className="section-label"><strong>Completed</strong><span>Newest first</span></div>{completed.length ? <div className="grocery-history">{completed.map(list => <Link key={list.id} to={`/groceries/${list.id}`}><span><strong>{list.title}</strong><small>{new Date(list.completedAt ?? list.createdAt).toLocaleDateString()} · {list.items.length} items · {list.recipes.length} recipes</small></span><ArrowRight /></Link>)}</div> : <p className="muted-copy">Completed Grocery Lists appear here.</p>}</section>
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
  const location = useLocation()
  const list = groceryLists.find(candidate => candidate.id === id)
  const [title, setTitle] = useState(list?.title ?? '')
  const [editing, setEditing] = useState<GroceryListItem | 'new' | null>(null)
  const [deleteMode, setDeleteMode] = useState<'delete' | 'restore' | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const completionRef = useRef<HTMLDialogElement>(null)
  const completionCancelRef = useRef<HTMLButtonElement>(null)
  const completionTriggerRef = useRef<HTMLElement | null>(null)
  const [selectedPantryIds, setSelectedPantryIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const message = (location.state as { message?: string } | null)?.message
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
    navigate('/groceries', { state: { message: 'Grocery List completed.' } })
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
  if (!list) return <AppShell><BackHeader title="Grocery List" fallbackTo="/groceries" /><EmptyState icon={ListChecks} title="Grocery List not found" message="This list may have been deleted." /></AppShell>
  const active = list.status === 'active'
  const groups = [...new Set(list.items.map(item => item.categoryName))].sort().map(category => ({
    category,
    items: list.items.filter(item => item.categoryName === category).sort((a, b) => Number(a.checked) - Number(b.checked) || a.label.localeCompare(b.label)),
  }))
  const openCompletion = () => {
    setSelectedPantryIds(new Set(eligible.map(item => item.id)))
    setCompletionOpen(true)
  }
  const checkedCount = list.items.filter(item => item.checked).length
  const remainingCount = list.items.length - checkedCount
  return <AppShell><BackHeader title={active ? 'Active Grocery List' : 'Completed Grocery List'} fallbackTo="/groceries" eyebrow={active ? `${checkedCount} of ${list.items.length} purchased` : new Date(list.completedAt ?? list.createdAt).toLocaleDateString()} />
    <main className="detail-screen grocery-screen grocery-list-screen"><SuccessNotice message={message} />{error && <div className="warning-banner danger" role="alert"><WarningCircle /><span>{error}</span></div>}
      {active ? <section className="active-list-overview">
        <form className="grocery-title-form" onSubmit={event => { event.preventDefault(); void renameGroceryList(list.id, title) }}>
          <label className="grocery-title-field"><span>List name</span><input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} /></label>
          <button className="button secondary compact" disabled={!title.trim() || title.trim() === list.title}><Check />Save title</button>
        </form>
        <div className="shopping-progress">
          <div><span className="shopping-progress-icon"><ListChecks size={21} /></span><span><strong>{checkedCount} of {list.items.length} items picked up</strong><small>{remainingCount ? `${remainingCount} remaining` : 'Ready to complete'}</small></span><b>{checkedCount}/{list.items.length}</b></div>
          <progress max={Math.max(1, list.items.length)} value={checkedCount} aria-label={`${checkedCount} of ${list.items.length} grocery items purchased`} />
        </div>
      </section> : <section className="hero-card compact"><span className="eyebrow">COMPLETED</span><h1>{list.title}</h1><p>{list.recipes.length} source recipe{list.recipes.length === 1 ? '' : 's'} · {list.items.length} grocery item{list.items.length === 1 ? '' : 's'}</p></section>}
      {active && <button className="button secondary add-grocery-item-button" type="button" onClick={() => setEditing('new')}><Plus />Add grocery item</button>}
      {editing && <ItemEditor initial={editing === 'new' ? undefined : editing} ingredients={[...ingredients].sort((a, b) => a.name.localeCompare(b.name))} onCancel={() => setEditing(null)} onSave={async input => { if (editing === 'new') await addGroceryItem(list.id, input); else await updateGroceryItem(list.id, { ...editing, ...input }); setEditing(null) }} />}
      {!list.items.length ? <EmptyState icon={CheckCircle} title="Nothing to buy" message="Your Pantry already covered every calculated Ingredient." /> : groups.map(group => <section className="grocery-group" key={group.category}><div className="section-label"><strong>{group.category}</strong><span>{group.items.length} item{group.items.length === 1 ? '' : 's'}</span></div><div className="grocery-items">{group.items.map(item => <article className={`grocery-item${item.checked ? ' checked' : ''}`} key={item.id}>{active ? <label className="grocery-check"><input type="checkbox" checked={item.checked} aria-label={`Mark ${item.label} ${item.checked ? 'not purchased' : 'purchased'}`} onChange={() => void updateGroceryItem(list.id, { ...item, checked: !item.checked })} /></label> : <span className="completion-mark"><Check /></span>}<span className="grocery-item-copy"><strong>{item.label}{item.edited && <small className="edited-badge">Edited</small>}</strong><small className="grocery-amount">Buy {amountLabel(item)}</small>{item.sources.length > 0 && <details><summary>Why this amount</summary><div>{item.sources.map(source => <span key={source.recipeId}>{source.recipeName} · {formatQuantity(source.quantity, item.family ?? 'count')} for {source.servings} serving{source.servings === 1 ? '' : 's'}</span>)}{item.originalPantry !== undefined && <span>Pantry when created · {formatQuantity(item.originalPantry, item.family ?? 'count')}</span>}</div></details>}</span>{active && <span className="grocery-item-actions"><button className="icon-button" type="button" aria-label={`Edit ${item.label}`} onClick={() => setEditing(item)}><PencilSimple size={19} /></button><button className="icon-button danger-text" type="button" aria-label={`Delete ${item.label}`} onClick={() => void removeGroceryItem(list.id, item.id)}><Trash size={19} /></button></span>}</article>)}</div></section>)}
      <section className="source-recipes"><div className="section-label"><strong>Recipes used for this list</strong><span>{list.recipes.length} recipe{list.recipes.length === 1 ? '' : 's'}</span></div>{list.recipes.map(recipe => <div key={recipe.recipeId}><span>{recipe.recipeName}</span><small>{recipe.servings} serving{recipe.servings === 1 ? '' : 's'}</small></div>)}</section>
      <section className="list-management"><div><strong>List options</strong><small>{active ? 'Return recipes to Basket or permanently delete this list.' : 'Reuse these recipes or remove this saved history.'}</small></div>{active ? <div className="destructive-actions"><button className="button secondary compact" type="button" onClick={() => setDeleteMode('restore')}><Basket />Return recipes to Basket</button><button className="button danger compact" type="button" onClick={() => setDeleteMode('delete')}><Trash />Delete list</button></div> : <div className="inline-actions"><button className="button secondary" type="button" onClick={() => void reuseGroceryList(list.id).then(() => navigate('/recipes/basket')).catch(cause => setError(cause instanceof Error ? cause.message : 'Recipes could not be reused.'))}><Basket />Reuse recipes</button><button className="button danger" type="button" onClick={() => setDeleteMode('delete')}><Trash />Delete history</button></div>}</section>
    </main>
    {active && <div className="form-actions sticky grocery-flow-actions"><Link className="button secondary" to="/groceries">Back to Groceries</Link><button className="button primary grocery-primary-action" type="button" onClick={openCompletion}><CheckCircle />Complete list</button></div>}
    <dialog ref={completionRef} className="pantry-completion-dialog" aria-labelledby="complete-list-title" onCancel={event => { event.preventDefault(); if (!completeAction.pending) setCompletionOpen(false) }}><section className="pantry-completion">
      <header className="completion-header"><span><CheckCircle size={25} /></span><div><h2 id="complete-list-title">Complete Grocery List?</h2><p>Review which purchased items will update Pantry before this list moves to history.</p></div></header>
      {list.items.some(item => !item.checked) && <div className="warning-banner"><WarningCircle /><span><strong>{list.items.filter(item => !item.checked).length} item{list.items.filter(item => !item.checked).length === 1 ? '' : 's'} not marked purchased</strong><small>You can still complete the list. Unchecked items will not update Pantry.</small></span></div>}
      <div className="completion-summary"><span><strong>{checkedCount} of {list.items.length} purchased</strong><small>Only checked catalog items with saved amounts can update Pantry.</small></span><b>{eligible.length} eligible</b></div>
      {eligible.length ? <div className="pantry-preview">{eligible.map(item => {
        const ingredientId = item.ingredientId!
        const pantryBefore = balances[ingredientId] ?? 0n
        const pantryAfter = pantryBefore + (pantryPreviewTotals.get(ingredientId) ?? 0n)
        return <label key={item.id}><input type="checkbox" checked={selectedPantryIds.has(item.id)} onChange={() => setSelectedPantryIds(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} /><span><strong>{item.label}</strong><small>{amountLabel(item)} purchased</small></span><span className="pantry-change"><small>Pantry after completion</small><b>{formatQuantity(pantryBefore, item.family!)} → {formatQuantity(pantryAfter, item.family!)}</b></span></label>
      })}</div> : <p className="muted-copy completion-empty">No checked catalog items with saved amounts will update Pantry.</p>}
      <div className="inline-actions completion-actions"><button ref={completionCancelRef} className="button secondary" disabled={completeAction.pending} onClick={() => setCompletionOpen(false)}>Cancel</button><button className="button primary grocery-primary-action" disabled={completeAction.pending} onClick={() => void completeAction.run().catch(cause => setError(cause instanceof Error ? cause.message : 'List could not be completed.'))}>{completeAction.pending ? 'Completing…' : selectedPantryIds.size ? 'Update Pantry & complete' : 'Complete without Pantry update'}</button></div>
    </section></dialog>
    <ConfirmDialog open={deleteMode !== null} title={deleteMode === 'restore' ? 'Restore Recipes and delete list?' : 'Delete Grocery List?'} description={deleteMode === 'restore' ? 'Source Recipes will merge into Basket. Existing Basket servings stay unchanged.' : 'This Grocery List and its frozen history will be permanently removed.'} confirmLabel={deleteMode === 'restore' ? 'Restore and delete' : 'Delete list'} onDismiss={() => setDeleteMode(null)} onConfirm={async () => { await deleteGroceryList(list.id, deleteMode === 'restore'); navigate('/groceries', { state: { message: 'Grocery List deleted.' } }) }} />
  </AppShell>
}
