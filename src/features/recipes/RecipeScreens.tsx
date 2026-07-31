import { ArrowRight, Basket, BookOpen, Check, CheckCircle, CookingPot, MagnifyingGlass, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import { isPublishedRecipe, type PublishedRecipe, type RecipeIngredient } from '../../domain/types'
import { formatQuantity, formatQuantityInUnit, formatQuantityValue, scaleQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader, BrandHeader, EmptyState, OwnershipMark, PageHeading, SuccessNotice } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

function availability(recipe: { baseServings: number; ingredients: RecipeIngredient[] }, servings: number, balances: Record<string, bigint>) {
  return recipe.ingredients
    .map(item => ({ ...item, needed: scaleQuantity(item.quantity, servings, recipe.baseServings), balance: balances[item.ingredientId] ?? 0n }))
    .map(item => ({ ...item, short: item.balance < item.needed }))
}

export function RecipeListScreen() {
  const { recipes, balances, ingredient, basket, createRecipeDraft, deleteRecipeDraft, addRecipeToBasket } = useGrocea()
  const published = recipes.filter(isPublishedRecipe)
  const drafts = recipes.filter(recipe => recipe.status === 'draft')
  const [tab, setTab] = useState<'ready' | 'all' | 'drafts'>('ready')
  const [query, setQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const message = (location.state as { message?: string } | null)?.message
  useEffect(() => { if (message) navigate(location.pathname, { replace: true, state: null }) }, [location.pathname, message, navigate])
  const readyCount = published.filter(recipe => availability(recipe, recipe.baseServings, balances).every(item => !item.short)).length
  const shownPublished = useMemo(() => published
    .filter(recipe => recipe.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(recipe => tab === 'all' || availability(recipe, recipe.baseServings, balances).every(item => !item.short))
    .sort((a, b) => Number(availability(b, b.baseServings, balances).every(item => !item.short)) - Number(availability(a, a.baseServings, balances).every(item => !item.short)) || a.name.localeCompare(b.name)), [balances, published, query, tab])
  const shownDrafts = useMemo(() => drafts
    .filter(recipe => (recipe.name || 'Untitled recipe').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [drafts, query])
  const createAction = usePendingAction(async () => {
    const id = await createRecipeDraft()
    navigate(`/recipes/${id}/edit/basics`)
  })
  const [addingId, setAddingId] = useState<string | null>(null)
  const addToBasket = async (recipe: PublishedRecipe) => {
    setAddingId(recipe.id)
    try { await addRecipeToBasket(recipe.id, recipe.baseServings) } finally { setAddingId(null) }
  }

  const resultCount = tab === 'drafts' ? shownDrafts.length : shownPublished.length
  const resultLabel = tab === 'drafts' ? 'Recently edited' : tab === 'ready' ? 'Ready to cook' : 'All recipes'

  return <AppShell navigation>
    <BrandHeader />
    <main className="screen-content recipe-list-screen">
      <SuccessNotice message={message} />
      <PageHeading
        title="Recipes"
        subtitle={`${readyCount} ready · ${published.length} recipes · ${drafts.length} drafts`}
        action={<div className="heading-actions recipe-heading-actions">
          <Link className="button secondary compact basket-link" to="/recipes/basket" aria-label={`Basket, ${basket.length} recipe${basket.length === 1 ? '' : 's'}`}>
            <span className="basket-link-icon"><Basket size={20} /></span>
            <span>Basket</span>
            {basket.length > 0 && <span className="count-badge">{basket.length}</span>}
          </Link>
          <button className="button primary compact new-recipe-button" type="button" disabled={createAction.pending} aria-busy={createAction.pending} onClick={() => void createAction.run().catch(() => undefined)}>
            <Plus size={20} />{createAction.pending ? 'Creating…' : 'New recipe'}
          </button>
        </div>}
      />

      <div className="recipe-toolbar">
        <label className="search-field recipe-search">
          <MagnifyingGlass size={21} />
          <span className="sr-only">Search recipes</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'drafts' ? 'Search drafts…' : 'Search recipes…'} />
        </label>
        <div className="segmented-control three recipe-tabs" aria-label="Recipe view">
          <button type="button" className={tab === 'ready' ? 'selected' : ''} aria-pressed={tab === 'ready'} onClick={() => setTab('ready')}>Ready</button>
          <button type="button" className={tab === 'all' ? 'selected' : ''} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All</button>
          <button type="button" className={tab === 'drafts' ? 'selected' : ''} aria-pressed={tab === 'drafts'} onClick={() => setTab('drafts')}>Drafts ({drafts.length})</button>
        </div>
      </div>

      <div className="section-label recipe-results-heading" id="recipe-results-title">
        <strong>{resultLabel}</strong>
        <span>{resultCount} {resultCount === 1 ? 'recipe' : 'recipes'}</span>
      </div>

      {tab === 'drafts' ? <section className="recipe-grid" aria-labelledby="recipe-results-title">
        {shownDrafts.map(recipe => {
          const name = recipe.name.trim() || 'Untitled recipe'
          return <article className="recipe-card draft-card" key={recipe.id}>
            <div className="recipe-card-main recipe-draft-main">
              <div className="recipe-card-topline">
                <span className="recipe-art"><BookOpen size={28} /></span>
                <span className="recipe-status draft">Draft</span>
              </div>
              <div className="recipe-card-copy">
                <h2>{name}</h2>
                <p>{recipe.ingredients.length} ingredients · {recipe.steps.filter(step => step.trim()).length} steps</p>
              </div>
            </div>
            <div className="draft-actions">
              <Link className="button secondary recipe-resume" aria-label={`Resume ${name}`} to={`/recipes/${recipe.id}/edit/basics`}>Continue <ArrowRight size={18} /></Link>
              <button className="icon-button danger-text" type="button" aria-label={`Delete ${name}`} onClick={() => setDeleteTarget({ id: recipe.id, name })}><Trash size={19} /></button>
            </div>
          </article>
        })}
        {!shownDrafts.length && <EmptyState icon={BookOpen} title="No drafts found" message={drafts.length ? 'Try another search.' : 'Start a recipe and save it for later.'} action={!drafts.length ? <button className="button primary" type="button" disabled={createAction.pending} onClick={() => void createAction.run().catch(() => undefined)}>{createAction.pending ? 'Creating…' : 'New recipe'}</button> : undefined} />}
      </section> : <section className="recipe-grid" aria-labelledby="recipe-results-title">
        {shownPublished.map(recipe => {
          const missing = availability(recipe, recipe.baseServings, balances).filter(item => item.short)
          const inBasket = basket.some(item => item.recipeId === recipe.id)
          const isAdding = addingId === recipe.id
          return <article className={`recipe-card recipe-card-with-action${missing.length ? ' needs-check' : ' is-ready'}`} key={recipe.id}>
            <Link className="recipe-card-main" to={`/recipes/${recipe.id}`}>
              <div className="recipe-card-topline">
                <span className={`recipe-art${missing.length ? ' warning' : ''}`}>
                  <CookingPot size={30} />
                  {recipe.scope === 'custom' && <OwnershipMark className="recipe-owner-mark" label="Your recipe" />}
                </span>
                <span className={`recipe-status${missing.length ? ' warning' : ''}`}>{missing.length ? `CHECK ${missing.length}` : 'READY'}</span>
              </div>
              <div className="recipe-card-copy">
                <h2>{recipe.name}</h2>
                <p>{missing.length ? `${ingredient(missing[0].ingredientId)?.name ?? 'Ingredient'} short · You can still cook` : `Serves ${recipe.baseServings} · All ingredients available`}</p>
              </div>
              <span className="recipe-card-hint">View recipe <ArrowRight size={16} /></span>
            </Link>
            <button className={`basket-add${inBasket ? ' selected' : ''}`} type="button" disabled={isAdding} aria-busy={isAdding} aria-label={inBasket ? `${recipe.name} is in Basket` : `Add ${recipe.name} to Basket`} onClick={() => void addToBasket(recipe)}>
              {inBasket ? <Check size={18} weight="bold" /> : <Basket size={18} />}
              <span>{isAdding ? 'Adding…' : inBasket ? 'In basket' : 'Add to basket'}</span>
            </button>
          </article>
        })}
        {!shownPublished.length && <EmptyState icon={BookOpen} title="No recipes found" message={tab === 'ready' ? 'No recipes are fully stocked. View all recipes to cook with a shortage.' : 'Try another search.'} />}
      </section>}
    </main>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Delete draft?" description={`${deleteTarget?.name ?? 'This draft'} and its unsaved recipe details will be permanently removed.`} confirmLabel="Delete draft" pendingLabel="Deleting…" onDismiss={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) await deleteRecipeDraft(deleteTarget.id) }} />
  </AppShell>
}

function Stepper({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className="stepper"><button type="button" disabled={disabled} aria-label="Decrease servings" onClick={() => onChange(Math.max(1, value - 1))}>−</button><strong>{value}</strong><button type="button" disabled={disabled} aria-label="Increase servings" onClick={() => onChange(Math.min(12, value + 1))}>+</button></div>
}

export function RecipeDetailScreen() {
  const { id } = useParams()
  const { recipes, balances, ingredient, basket, createRecipeDraft, addRecipeToBasket } = useGrocea()
  const navigate = useNavigate()
  const location = useLocation()
  const recipe = recipes.find(item => item.id === id && isPublishedRecipe(item)) as PublishedRecipe | undefined
  const customizeAction = usePendingAction(async () => {
    if (!recipe) return
    const draftId = await createRecipeDraft(recipe.id)
    navigate(`/recipes/${draftId}/edit/basics`)
  })
  const basketAction = usePendingAction(async () => {
    if (recipe) await addRecipeToBasket(recipe.id, recipe.baseServings)
  })
  if (!recipe) return <AppShell><BackHeader title="Recipe detail" fallbackTo="/recipes" /><EmptyState title="Recipe not found" message="This published recipe is not available." /></AppShell>
  const items = availability(recipe, recipe.baseServings, balances)
  const missing = items.filter(item => item.short)
  const message = (location.state as { message?: string } | null)?.message
  const returnTo = `/recipes/${recipe.id}`
  const inBasket = basket.some(item => item.recipeId === recipe.id)
  return <AppShell><BackHeader title="Recipe detail" fallbackTo="/recipes" eyebrow="Published recipe" action={<button className="button secondary compact" type="button" disabled={basketAction.pending} onClick={() => void basketAction.run().catch(() => undefined)}>{inBasket ? <Check /> : <Basket />}{inBasket ? 'In Basket' : 'Add'}</button>} /><main className="detail-screen"><SuccessNotice message={message} /><section className="hero-card"><span className="hero-meta"><span className="eyebrow">PUBLISHED</span>{recipe.scope === 'custom' && <OwnershipMark label="Your recipe" />}</span><h1>{recipe.name}</h1><p>{recipe.description}</p><small>Base serves {recipe.baseServings}</small></section>{missing.length > 0 && <div className="warning-banner"><WarningCircle size={23} /><span><strong>{missing.length} ingredient{missing.length > 1 ? 's are' : ' is'} short</strong><small>Add the exact deficit now, or cook and record a negative balance.</small></span></div>}
    <section className="detail-section"><div className="section-title"><h2>Ingredients</h2><span>{recipe.baseServings} servings</span></div><div className="data-list">{items.map(item => { const source = ingredient(item.ingredientId); const deficit = item.needed - item.balance; const addHref = `/pantry/stock/new?${new URLSearchParams({ ingredient: item.ingredientId, quantity: formatQuantityValue(deficit, item.unit), unit: item.unit, returnTo }).toString()}`; return <div className="data-row recipe-ingredient-row" key={item.ingredientId}><span><strong>{source?.name}</strong><small>{formatQuantity(item.balance, source?.family ?? 'mass')} in pantry</small></span><span className="ingredient-status"><span className={item.short ? 'status warning' : 'status'}>{item.short ? 'Short' : 'Available'} · {formatQuantityInUnit(item.needed, item.unit)}</span>{item.short && <Link className="stock-recovery-link" to={addHref}>Add {formatQuantityInUnit(deficit, item.unit)}</Link>}</span></div> })}</div></section>
    <section className="detail-section"><h2>Steps</h2><ol className="steps-list">{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section></main><div className="form-actions sticky" aria-busy={customizeAction.pending}><button className="button secondary" type="button" disabled={customizeAction.pending} onClick={() => void customizeAction.run().catch(() => undefined)}>{customizeAction.pending ? 'Creating draft…' : 'Customize recipe'}</button><Link className="button primary" aria-disabled={customizeAction.pending || undefined} to={`/recipes/${recipe.id}/cook`}>{missing.length ? 'Cook anyway' : 'Cook recipe'}</Link></div></AppShell>
}

export function CookPreviewScreen() {
  const { id } = useParams()
  const { recipes, balances, ingredient, cookRecipe, profile } = useGrocea()
  const navigate = useNavigate()
  const recipe = recipes.find(item => item.id === id && isPublishedRecipe(item)) as PublishedRecipe | undefined
  const [servings, setServings] = useState(profile.preferredServings)
  const items = recipe ? availability(recipe, servings, balances) : []
  const changes = items.map(item => ({ ingredientId: item.ingredientId, before: item.balance, delta: -item.needed, after: item.balance - item.needed }))
  const cookAction = usePendingAction(async () => {
    if (!recipe) return
    const eventId = await cookRecipe(recipe.id, servings, changes)
    navigate(`/recipes/${recipe.id}/complete/${eventId}`)
  })
  if (!recipe) return <AppShell><BackHeader title="Cook preview" fallbackTo="/recipes" /><EmptyState title="Recipe unavailable" message="Only confirmed recipes can be cooked." /></AppShell>
  const short = changes.filter(change => change.after < 0n)
  return <AppShell><BackHeader title="Cook preview" fallbackTo={`/recipes/${recipe.id}`} eyebrow="Review pantry changes" /><main className="detail-screen"><section className="hero-card compact"><span className="eyebrow">READY TO COOK</span><h1>{recipe.name}</h1><p>{recipe.description}</p></section><div className="stepper-row card"><span><strong>Servings</strong><small>Amounts update automatically</small></span><Stepper value={servings} onChange={setServings} disabled={cookAction.pending} /></div>{short.length > 0 && <div className="warning-banner"><WarningCircle /><span><strong>Cooking creates {short.length} negative balance{short.length > 1 ? 's' : ''}</strong><small>Those ingredients will move to Needs restock.</small></span></div>}
    <section className="detail-section"><div className="section-title"><h2>Pantry changes</h2><span>CURRENT → PROJECTED</span></div><div className="data-list">{changes.map(change => { const source = ingredient(change.ingredientId)!; return <div className="stock-change" key={change.ingredientId}><span><strong>{source.name}</strong><small>{formatQuantity(change.before, source.family)} current</small></span><span><b>− {formatQuantity(-change.delta, source.family)}</b><small className={change.after < 0n ? 'danger-text' : ''}>{formatQuantity(change.after, source.family)} after</small></span></div> })}</div></section></main><div className="form-actions sticky" aria-busy={cookAction.pending}><button className="button secondary" disabled={cookAction.pending} onClick={() => navigate(`/recipes/${recipe.id}`)}>Cancel</button><button className="button primary" disabled={cookAction.pending} onClick={() => void cookAction.run().catch(() => undefined)}><CookingPot />{cookAction.pending ? 'Recording…' : `Cook ${servings} serving${servings > 1 ? 's' : ''}`}</button></div></AppShell>
}

export function CookingResultScreen() {
  const { eventId } = useParams()
  const { activity, ingredient } = useGrocea()
  const event = activity.find(item => item.id === eventId)
  if (!event) return <AppShell><BackHeader title="Cooking complete" fallbackTo="/recipes" /><EmptyState title="Activity unavailable" message="This session no longer contains the cooking event." /></AppShell>
  return <AppShell><BackHeader title="Cooking complete" fallbackTo="/recipes" eyebrow="Pantry updated" /><main className="result-screen"><CheckCircle size={66} weight="fill" /><h1>Cooking recorded</h1><p>Your pantry now reflects what you used.</p><div className="info-banner"><Check /><span>Saved as one immutable cooking event with {event.changes.length} stock changes.</span></div><section className="detail-section"><h2>Updated pantry</h2><div className="data-list">{event.changes.map(change => { const source = ingredient(change.ingredientId)!; return <div className="data-row" key={change.ingredientId}><span><strong>{source.name}</strong><small>{formatQuantity(change.before, source.family)} before</small></span><b>{formatQuantity(change.after, source.family)}</b></div> })}</div></section><Link className="activity-link" to={`/activity/${event.id}`}>Activity saved <ArrowRight /></Link></main><div className="form-actions sticky"><Link className="button secondary" to={`/activity/${event.id}`}>View activity</Link><Link className="button primary" to="/recipes">Done</Link></div></AppShell>
}
