import { ArrowRight, BookOpen, Check, CheckCircle, CookingPot, MagnifyingGlass, Minus, Plus, WarningCircle } from '@phosphor-icons/react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import type { RecipeIngredient } from '../../domain/types'
import { formatQuantity, scaleQuantity } from '../../shared/lib/quantity'
import { AppShell, BackHeader, BrandHeader, EmptyState, FormActions, PageHeading } from '../../shared/ui/AppShell'

function availability(recipe: { baseServings: number; ingredients: RecipeIngredient[] }, servings: number, balances: Record<string, bigint>) {
  return recipe.ingredients.map(item => ({ ...item, needed: scaleQuantity(item.quantity, servings, recipe.baseServings), balance: balances[item.ingredientId] ?? 0n })).map(item => ({ ...item, short: item.balance < item.needed }))
}

export function RecipeListScreen() {
  const { recipes, balances, ingredient } = useGrocea()
  const [tab, setTab] = useState<'ready' | 'all'>('ready')
  const [query, setQuery] = useState('')
  const shown = useMemo(() => recipes.filter(recipe => recipe.name.toLowerCase().includes(query.trim().toLowerCase())).filter(recipe => tab === 'all' || availability(recipe, recipe.baseServings, balances).every(item => !item.short)).sort((a, b) => {
    const aReady = availability(a, a.baseServings, balances).every(item => !item.short)
    const bReady = availability(b, b.baseServings, balances).every(item => !item.short)
    return Number(bReady) - Number(aReady) || a.name.localeCompare(b.name)
  }), [balances, query, recipes, tab])
  const readyCount = recipes.filter(recipe => availability(recipe, recipe.baseServings, balances).every(item => !item.short)).length
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="Recipes" subtitle={`${readyCount} ready to cook · ${recipes.length} total`} action={<Link className="button primary compact" to="/recipes/new"><Plus size={19} />New</Link>} />
    <div className="segmented-control"><button className={tab === 'ready' ? 'selected' : ''} onClick={() => setTab('ready')}>Ready to cook</button><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>All recipes</button></div>
    <label className="search-field"><MagnifyingGlass size={21} /><span className="sr-only">Search recipes</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search recipes…" /></label>
    <div className="section-label"><strong>Available first</strong><span>{shown.length} recipes</span></div>
    <section className="recipe-grid">{shown.map(recipe => { const missing = availability(recipe, recipe.baseServings, balances).filter(item => item.short); return <Link className="recipe-card" to={`/recipes/${recipe.id}`} key={recipe.id}><span className={`recipe-art${missing.length ? ' warning' : ''}`}><CookingPot size={30} /></span><div><span className="eyebrow">{recipe.scope === 'custom' ? 'YOURS' : missing.length ? `CHECK ${missing.length}` : 'READY'}</span><h2>{recipe.name}</h2><p>{missing.length ? `${ingredient(missing[0].ingredientId)?.name ?? 'Ingredient'} short · You can still cook` : `Serves ${recipe.baseServings} · All ingredients available`}</p></div><ArrowRight size={20} /></Link> })}
      {!shown.length && <EmptyState icon={BookOpen} title="No recipes found" message={tab === 'ready' ? 'No recipes are fully stocked. View all recipes to cook with a shortage.' : 'Try another search.'} />}</section>
  </main></AppShell>
}

export function RecipeEditorScreen() {
  const { ingredients, createRecipe, profile } = useGrocea()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [servings, setServings] = useState(profile.preferredServings)
  const [recipeIngredients, setRecipeIngredients] = useState([{ ingredientId: ingredients[0]?.id ?? '', quantity: '1' }])
  const [steps, setSteps] = useState([''])
  const valid = name.trim().length > 0 && name.trim().length <= 120 && steps.some(step => step.trim())
  const addIngredient = () => setRecipeIngredients(items => [...items, { ingredientId: ingredients.find(candidate => !items.some(item => item.ingredientId === candidate.id))?.id ?? ingredients[0]?.id ?? '', quantity: '1' }])
  function submit(event: FormEvent) { event.preventDefault(); if (!valid) return; const mapped = recipeIngredients.flatMap(item => { const source = ingredients.find(ingredient => ingredient.id === item.ingredientId); const amount = BigInt(Math.max(1, Math.round(Number(item.quantity || 0) * 1000))); return source ? [{ ingredientId: source.id, quantity: source.family === 'count' ? amount : amount * 1000n }] : [] }); const id = createRecipe({ name: name.trim(), description: description.trim(), baseServings: servings, ingredients: mapped, steps: steps.map(step => step.trim()).filter(Boolean) }); navigate(`/recipes/${id}`, { state: { message: 'Recipe saved.' } }) }
  return <AppShell><BackHeader title="New recipe" eyebrow="Recipe editor" action={<span className="tag">Draft</span>} /><form className="form-screen wide-form" onSubmit={submit}>
    <section className="form-section"><h2>Recipe basics</h2><label className="field-group"><span>Name</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Recipe name" maxLength={121} required /></label><label className="field-group"><span>Description <small>optional</small></span><textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="A short description…" /></label><div className="stepper-row"><span><strong>Base serves</strong><small>Ingredient amounts use this serving size</small></span><Stepper value={servings} onChange={setServings} /></div></section>
    <section className="form-section"><div className="section-title"><div><h2>Ingredients</h2><p>Amounts for {servings} servings</p></div><button type="button" className="text-button" onClick={addIngredient}><Plus />Add ingredient</button></div>{recipeIngredients.map((item, index) => <div className="inline-fields" key={index}><select value={item.ingredientId} onChange={event => setRecipeIngredients(items => items.map((current, itemIndex) => itemIndex === index ? { ...current, ingredientId: event.target.value } : current))}>{ingredients.map(ingredient => <option value={ingredient.id} key={ingredient.id}>{ingredient.name}</option>)}</select><input value={item.quantity} inputMode="decimal" aria-label={`Ingredient ${index + 1} quantity`} onChange={event => setRecipeIngredients(items => items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: event.target.value } : current))} /></div>)}</section>
    <section className="form-section"><div className="section-title"><div><h2>Steps</h2><p>Keep each step focused</p></div><button type="button" className="text-button" onClick={() => setSteps(items => [...items, ''])}><Plus />Add step</button></div>{steps.map((step, index) => <label className="step-field" key={index}><b>{index + 1}</b><textarea value={step} onChange={event => setSteps(items => items.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} placeholder="Describe this step…" /></label>)}</section>
    <FormActions cancel={() => navigate(-1)} submit="Save recipe" disabled={!valid} />
  </form></AppShell>
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <div className="stepper"><button type="button" aria-label="Decrease servings" onClick={() => onChange(Math.max(1, value - 1))}><Minus /></button><strong>{value}</strong><button type="button" aria-label="Increase servings" onClick={() => onChange(Math.min(12, value + 1))}><Plus /></button></div> }

export function RecipeDetailScreen() {
  const { id } = useParams(); const { recipes, balances, ingredient } = useGrocea(); const navigate = useNavigate(); const recipe = recipes.find(item => item.id === id)
  if (!recipe) return <AppShell><BackHeader title="Recipe detail" /><EmptyState title="Recipe not found" message="This recipe is not available in the current session." /></AppShell>
  const items = availability(recipe, recipe.baseServings, balances); const missing = items.filter(item => item.short)
  return <AppShell><BackHeader title="Recipe detail" eyebrow={recipe.scope === 'custom' ? 'Your recipe' : 'Global recipe'} /><main className="detail-screen"><section className="hero-card"><span className="eyebrow">{recipe.scope === 'custom' ? 'YOURS' : 'GLOBAL'}</span><h1>{recipe.name}</h1><p>{recipe.description}</p><small>Base serves {recipe.baseServings}</small></section>{missing.length > 0 && <div className="warning-banner"><WarningCircle size={23} /><span><strong>{missing.length} ingredient{missing.length > 1 ? 's are' : ' is'} short</strong><small>You can still cook and record a negative balance.</small></span></div>}
    <section className="detail-section"><div className="section-title"><h2>Ingredients</h2><span>{recipe.baseServings} servings</span></div><div className="data-list">{items.map(item => { const source = ingredient(item.ingredientId); return <div className="data-row" key={item.ingredientId}><span><strong>{source?.name}</strong><small>{formatQuantity(item.balance, source?.family ?? 'mass')} in pantry</small></span><span className={item.short ? 'status warning' : 'status'}>{item.short ? 'Short' : 'Available'} · {formatQuantity(item.needed, source?.family ?? 'mass')}</span></div> })}</div></section>
    <section className="detail-section"><h2>Steps</h2><ol className="steps-list">{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol></section></main><div className="form-actions sticky"><button className="button secondary" type="button" onClick={() => navigate('/recipes/new')}>Customize</button><Link className="button primary" to={`/recipes/${recipe.id}/cook`}>{missing.length ? 'Cook anyway' : 'Cook recipe'}</Link></div></AppShell>
}

export function CookPreviewScreen() {
  const { id } = useParams(); const { recipes, balances, ingredient, cookRecipe, profile } = useGrocea(); const navigate = useNavigate(); const recipe = recipes.find(item => item.id === id); const [servings, setServings] = useState(profile.preferredServings)
  if (!recipe) return null
  const items = availability(recipe, servings, balances); const changes = items.map(item => ({ ingredientId: item.ingredientId, before: item.balance, delta: -item.needed, after: item.balance - item.needed })); const short = changes.filter(change => change.after < 0n)
  function cook() { const eventId = cookRecipe(recipe!.id, servings, changes); navigate(`/recipes/${recipe!.id}/complete/${eventId}`) }
  return <AppShell><BackHeader title="Cook preview" eyebrow="Review pantry changes" /><main className="detail-screen"><section className="hero-card compact"><span className="eyebrow">READY TO COOK</span><h1>{recipe.name}</h1><p>{recipe.description}</p></section><div className="stepper-row card"><span><strong>Servings</strong><small>Amounts update automatically</small></span><Stepper value={servings} onChange={setServings} /></div>{short.length > 0 && <div className="warning-banner"><WarningCircle /><span><strong>Cooking creates {short.length} negative balance{short.length > 1 ? 's' : ''}</strong><small>Those ingredients will move to Needs restock.</small></span></div>}
    <section className="detail-section"><div className="section-title"><h2>Pantry changes</h2><span>CURRENT → PROJECTED</span></div><div className="data-list">{changes.map(change => { const source = ingredient(change.ingredientId)!; return <div className="stock-change" key={change.ingredientId}><span><strong>{source.name}</strong><small>{formatQuantity(change.before, source.family)} current</small></span><span><b>− {formatQuantity(-change.delta, source.family)}</b><small className={change.after < 0n ? 'danger-text' : ''}>{formatQuantity(change.after, source.family)} after</small></span></div> })}</div></section></main><div className="form-actions sticky"><button className="button secondary" onClick={() => navigate(-1)}>Cancel</button><button className="button primary" onClick={cook}><CookingPot />Cook {servings} serving{servings > 1 ? 's' : ''}</button></div></AppShell>
}

export function CookingResultScreen() {
  const { eventId } = useParams(); const { activity, ingredient } = useGrocea(); const event = activity.find(item => item.id === eventId)
  if (!event) return null
  return <AppShell><BackHeader title="Cooking complete" eyebrow="Pantry updated" /><main className="result-screen"><CheckCircle size={66} weight="fill" /><h1>Cooking recorded</h1><p>Your pantry now reflects what you used.</p><div className="info-banner"><Check /><span>Saved as one immutable cooking event with {event.changes.length} stock changes.</span></div><section className="detail-section"><h2>Updated pantry</h2><div className="data-list">{event.changes.map(change => { const source = ingredient(change.ingredientId)!; return <div className="data-row" key={change.ingredientId}><span><strong>{source.name}</strong><small>{formatQuantity(change.before, source.family)} before</small></span><b>{formatQuantity(change.after, source.family)}</b></div> })}</div></section><Link className="activity-link" to={`/activity/${event.id}`}>Activity saved <ArrowRight /></Link></main><div className="form-actions sticky"><Link className="button secondary" to={`/activity/${event.id}`}>View activity</Link><Link className="button primary" to="/recipes">Done</Link></div></AppShell>
}
