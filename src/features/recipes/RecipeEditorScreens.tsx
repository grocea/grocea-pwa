import { Check, Circle, Drop, Egg, Grains, MagnifyingGlass, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import type { DraftRecipe, Ingredient, Unit } from '../../domain/types'
import { defaultUnit, familyUnits, formatQuantityInUnit, parseQuantity } from '../../shared/lib/quantity'
import { AppShell, BackHeader, EmptyState } from '../../shared/ui/AppShell'

const stages = ['basics', 'ingredients', 'measurements', 'steps', 'review'] as const
type Stage = typeof stages[number]
const labels: Record<Stage, string> = { basics: 'Basics', ingredients: 'Ingredients', measurements: 'Measurements', steps: 'Steps', review: 'Review' }

function ingredientIcon(ingredient: Ingredient) {
  if (ingredient.id === 'eggs') return <Egg />
  if (ingredient.family === 'mass') return <Grains />
  if (ingredient.family === 'volume') return <Drop />
  return <Circle />
}

function untouched(draft: DraftRecipe) {
  return !draft.name && !draft.description && !draft.ingredients.length && draft.steps.every(step => !step)
}

function stageValid(draft: DraftRecipe, stage: Stage): boolean {
  if (stage === 'basics') return draft.name.trim().length > 0 && draft.name.trim().length <= 120 && draft.baseServings >= 1
  if (stage === 'ingredients') return draft.ingredients.length > 0 && new Set(draft.ingredients.map(item => item.ingredientId)).size === draft.ingredients.length
  if (stage === 'measurements') return draft.ingredients.every(item => { const quantity = parseQuantity(item.quantity, item.unit); return quantity !== null && quantity > 0n })
  if (stage === 'steps') return draft.steps.some(step => step.trim())
  return stages.slice(0, 4).every(item => stageValid(draft, item))
}

export function NewRecipeScreen() {
  const { createRecipeDraft } = useGrocea()
  const navigate = useNavigate()
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const id = createRecipeDraft()
    navigate(`/recipes/${id}/edit/basics`, { replace: true })
  }, [createRecipeDraft, navigate])
  return <AppShell><main className="editor-loading" role="status">Creating draft…</main></AppShell>
}

export function RecipeEditorScreen() {
  const { id = '', stage: rawStage = '' } = useParams()
  const stage = stages.includes(rawStage as Stage) ? rawStage as Stage : null
  const { recipes, ingredients, categoryName, updateRecipeDraft, deleteRecipeDraft, publishRecipeDraft } = useGrocea()
  const draft = recipes.find((recipe): recipe is DraftRecipe => recipe.id === id && recipe.status === 'draft')
  const navigate = useNavigate()
  const location = useLocation()
  const heading = useRef<HTMLHeadingElement>(null)
  const [attemptedStage, setAttemptedStage] = useState<Stage | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => { heading.current?.focus() }, [stage])
  useEffect(() => {
    const discardUntouchedOnBrowserBack = () => { if (stage === 'basics' && draft && untouched(draft)) deleteRecipeDraft(draft.id) }
    window.addEventListener('popstate', discardUntouchedOnBrowserBack)
    return () => window.removeEventListener('popstate', discardUntouchedOnBrowserBack)
  }, [deleteRecipeDraft, draft, stage])
  if (!stage) return <Navigate to={`/recipes/${id}/edit/basics`} replace />
  if (!draft) return <AppShell><BackHeader title="Recipe editor" /><EmptyState title="Draft not found" message="This draft may have been deleted or confirmed." action={<Link className="button primary" to="/recipes">View recipes</Link>} /></AppShell>

  const index = stages.indexOf(stage)
  const update = (patch: Parameters<typeof updateRecipeDraft>[1]) => updateRecipeDraft(draft.id, patch)
  const leave = () => {
    if (untouched(draft)) deleteRecipeDraft(draft.id)
    navigate('/recipes', { state: { message: untouched(draft) ? undefined : 'Draft saved.' } })
  }
  const next = (event: FormEvent) => {
    event.preventDefault(); setAttemptedStage(stage)
    if (!stageValid(draft, stage)) return
    if (stage === 'review') {
      if (publishRecipeDraft(draft.id)) navigate(`/recipes/${draft.id}`, { state: { message: 'Recipe confirmed.' } })
      return
    }
    navigate(`/recipes/${draft.id}/edit/${stages[index + 1]}`)
  }
  const previous = () => index === 0 ? leave() : navigate(`/recipes/${draft.id}/edit/${stages[index - 1]}`)
  const attempted = attemptedStage === stage

  return <AppShell>
    <BackHeader title="Recipe draft" eyebrow="Autosaved locally" action={<span className="tag">Draft</span>} onBack={previous} />
    <form className="recipe-editor" onSubmit={next} noValidate>
      <nav className="editor-progress" aria-label="Recipe creation progress">{stages.map((item, itemIndex) => <Link key={item} to={`/recipes/${draft.id}/edit/${item}`} aria-current={item === stage ? 'step' : undefined} className={item === stage ? 'active' : itemIndex < index ? 'complete' : ''}><span>{itemIndex < index ? <Check /> : itemIndex + 1}</span><small>{labels[item]}</small></Link>)}</nav>
      <header className="editor-heading"><p>Step {index + 1} of {stages.length}</p><h1 ref={heading} tabIndex={-1}>{labels[stage]}</h1></header>
      {(location.state as { message?: string } | null)?.message && <div className="success-notice" role="status">{(location.state as { message: string }).message}</div>}

      {stage === 'basics' && <section className="editor-card">
        <label className="field-group"><span>Name</span><input autoFocus value={draft.name} maxLength={120} onChange={event => update({ name: event.target.value })} aria-invalid={attempted && !stageValid(draft, 'basics')} placeholder="Recipe name" /></label>
        <label className="field-group"><span>Description <small>optional</small></span><textarea value={draft.description} onChange={event => update({ description: event.target.value })} placeholder="What makes this recipe useful?" /></label>
        <label className="field-group"><span>Base servings</span><input type="number" min="1" max="99" value={draft.baseServings} onChange={event => update({ baseServings: Math.max(1, Number(event.target.value) || 1) })} /></label>
        {attempted && !stageValid(draft, 'basics') && <p className="field-error" role="alert">Add a recipe name between 1 and 120 characters.</p>}
      </section>}

      {stage === 'ingredients' && <IngredientStage draft={draft} ingredients={ingredients} categoryName={categoryName} query={query} setQuery={setQuery} update={update} attempted={attempted} />}
      {stage === 'measurements' && <MeasurementStage draft={draft} ingredients={ingredients} update={update} attempted={attempted} />}
      {stage === 'steps' && <StepsStage draft={draft} update={update} attempted={attempted} />}
      {stage === 'review' && <ReviewStage draft={draft} ingredients={ingredients} />}

      <div className="editor-actions"><button type="button" className="button secondary" onClick={leave}>Save &amp; exit</button><button type="submit" className="button primary">{stage === 'review' ? 'Confirm recipe' : 'Next'}</button></div>
    </form>
  </AppShell>
}

function IngredientStage({ draft, ingredients, categoryName, query, setQuery, update, attempted }: { draft: DraftRecipe; ingredients: Ingredient[]; categoryName: (id: string) => string; query: string; setQuery: (value: string) => void; update: (patch: Partial<DraftRecipe>) => void; attempted: boolean }) {
  const shown = useMemo(() => ingredients.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [ingredients, query])
  const toggle = (ingredient: Ingredient) => {
    const selected = draft.ingredients.some(item => item.ingredientId === ingredient.id)
    update({ ingredients: selected ? draft.ingredients.filter(item => item.ingredientId !== ingredient.id) : [...draft.ingredients, { ingredientId: ingredient.id, quantity: '', unit: defaultUnit(ingredient.family) }] })
  }
  return <section className="editor-card ingredient-picker">
    <div className="picker-tools"><label className="search-field"><MagnifyingGlass /><span className="sr-only">Search ingredients</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ingredients…" /></label><Link className="button secondary" to={`/recipes/${draft.id}/ingredients/new?name=${encodeURIComponent(query.trim())}`}><Plus />Create custom</Link></div>
    <p className="selection-count" aria-live="polite">{draft.ingredients.length} selected</p>
    <div className="ingredient-grid" role="group" aria-label="Choose ingredients">{shown.map(ingredient => { const selected = draft.ingredients.some(item => item.ingredientId === ingredient.id); return <button type="button" key={ingredient.id} className={selected ? 'selected' : ''} role="checkbox" aria-checked={selected} onClick={() => toggle(ingredient)}><span>{ingredientIcon(ingredient)}</span><strong>{ingredient.name}</strong><small>{categoryName(ingredient.categoryId)}</small>{selected && <Check className="selection-check" />}</button> })}</div>
    {!shown.length && <EmptyState title="No ingredients found" message="Try another search or create a Custom Ingredient." />}
    {attempted && !draft.ingredients.length && <p className="field-error" role="alert">Select at least one ingredient.</p>}
  </section>
}

function MeasurementStage({ draft, ingredients, update, attempted }: { draft: DraftRecipe; ingredients: Ingredient[]; update: (patch: Partial<DraftRecipe>) => void; attempted: boolean }) {
  return <section className="editor-card measurement-list"><p>Amounts are for {draft.baseServings} serving{draft.baseServings === 1 ? '' : 's'}. Units stay within each ingredient’s measurement family.</p>{draft.ingredients.map((item, index) => { const ingredient = ingredients.find(source => source.id === item.ingredientId); if (!ingredient) return null; const parsed = parseQuantity(item.quantity, item.unit); const invalid = attempted && (parsed === null || parsed <= 0n); return <div className="measurement-row" key={item.ingredientId}><span>{ingredientIcon(ingredient)}<strong>{ingredient.name}</strong><small>{ingredient.family}</small></span><label><span className="sr-only">{ingredient.name} amount</span><input value={item.quantity} inputMode="decimal" aria-invalid={invalid} onChange={event => update({ ingredients: draft.ingredients.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: event.target.value } : current) })} placeholder="0" /></label><label><span className="sr-only">{ingredient.name} unit</span><select value={item.unit} onChange={event => update({ ingredients: draft.ingredients.map((current, itemIndex) => itemIndex === index ? { ...current, unit: event.target.value as Unit } : current) })}>{familyUnits[ingredient.family].map(unit => <option key={unit}>{unit}</option>)}</select></label>{invalid && <small className="field-error">Enter an amount greater than zero.</small>}</div>})}</section>
}

function StepsStage({ draft, update, attempted }: { draft: DraftRecipe; update: (patch: Partial<DraftRecipe>) => void; attempted: boolean }) {
  const remove = (index: number) => update({ steps: draft.steps.length === 1 ? [''] : draft.steps.filter((_, itemIndex) => itemIndex !== index) })
  return <section className="editor-card steps-editor">{draft.steps.map((step, index) => <div className="step-editor-row" key={index}><span>{index + 1}</span><label><span className="sr-only">Step {index + 1}</span><textarea value={step} onChange={event => update({ steps: draft.steps.map((current, itemIndex) => itemIndex === index ? event.target.value : current) })} placeholder="Describe this step…" /></label><button type="button" className="icon-button" onClick={() => remove(index)} aria-label={`Remove step ${index + 1}`}><Trash /></button></div>)}<button type="button" className="button secondary add-step" onClick={() => update({ steps: [...draft.steps, ''] })}><Plus />Add step</button>{attempted && !draft.steps.some(step => step.trim()) && <p className="field-error" role="alert">Add at least one preparation step.</p>}</section>
}

function ReviewStage({ draft, ingredients }: { draft: DraftRecipe; ingredients: Ingredient[] }) {
  const invalid = !stageValid(draft, 'review')
  return <div className="review-grid">{invalid && <div className="warning-banner"><WarningCircle /><span><strong>Recipe is incomplete</strong><small>Use the edit links below to finish required fields.</small></span></div>}<section className="review-card"><header><h2>Basics</h2><Link to={`/recipes/${draft.id}/edit/basics`}>Edit</Link></header><h3>{draft.name.trim() || 'Untitled recipe'}</h3><p>{draft.description.trim() || 'No description'}</p><small>Serves {draft.baseServings}</small></section><section className="review-card"><header><h2>Ingredients</h2><Link to={`/recipes/${draft.id}/edit/ingredients`}>Edit</Link></header><ul>{draft.ingredients.map(item => { const source = ingredients.find(ingredient => ingredient.id === item.ingredientId); const parsed = parseQuantity(item.quantity, item.unit); return <li key={item.ingredientId}><span>{source?.name ?? 'Missing ingredient'}</span><strong>{parsed !== null && parsed > 0n ? formatQuantityInUnit(parsed, item.unit) : 'Amount needed'}</strong></li> })}</ul></section><section className="review-card"><header><h2>Steps</h2><Link to={`/recipes/${draft.id}/edit/steps`}>Edit</Link></header><ol>{draft.steps.filter(step => step.trim()).map((step, index) => <li key={index}>{step.trim()}</li>)}</ol></section></div>
}
