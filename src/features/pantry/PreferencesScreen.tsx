import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import type { Ingredient, PantryPreferences, Unit } from '../../domain/types'
import { familyUnits, formatExactQuantity, formatQuantityValue, parseExactPackQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader } from '../../shared/ui/AppShell'

export function PreferencesScreen() {
  const { ingredientId } = useParams()
  const { ingredients, trackedIngredientIds, pantryPreferences, balances } = useGrocea()
  const ingredient = ingredients.find(item => item.id === ingredientId)
  return <AppShell><BackHeader title="Restock preferences" fallbackTo="/pantry" /><main className="detail-screen">
    {ingredient && trackedIngredientIds.includes(ingredient.id)
      ? <PreferencesForm key={ingredient.id} ingredient={ingredient} balance={balances[ingredient.id] ?? 0n} initial={pantryPreferences[ingredient.id]} />
      : <div className="empty-state"><strong>Track this ingredient first</strong><Link to="/ingredients">Open ingredient catalog</Link></div>}
  </main></AppShell>
}

function PreferencesForm({ ingredient, balance, initial }: { ingredient: Ingredient; balance: bigint; initial?: PantryPreferences }) {
  const { setPantryPreferences, canMutate, syncStatus } = useGrocea()
  const navigate = useNavigate()
  const baseUnit: Unit = ingredient.family === 'mass' ? 'g' : ingredient.family === 'volume' ? 'ml' : 'item'
  const [enabledDraft, setEnabled] = useState<boolean | null>(null)
  const [thresholdDraft, setThreshold] = useState<string | null>(null)
  const [thresholdUnit, setThresholdUnit] = useState<Unit>(baseUnit)
  const [refillDraft, setRefill] = useState<string | null>(null)
  const [refillUnit, setRefillUnit] = useState<Unit>(baseUnit)
  const enabled = enabledDraft ?? (initial?.lowStockThreshold != null)
  const threshold = thresholdDraft ?? (initial?.lowStockThreshold == null ? '' : formatQuantityValue(initial.lowStockThreshold, thresholdUnit))
  const refill = refillDraft ?? (initial?.refillQuantity == null ? '' : formatQuantityValue(initial.refillQuantity, refillUnit))
  const [error, setError] = useState('')
  const action = usePendingAction(async () => {
    const lowStockThreshold = enabled ? parseExactPackQuantity(threshold.trim(), thresholdUnit) : null
    const refillQuantity = refill.trim() ? parseExactPackQuantity(refill.trim(), refillUnit) : null
    if (enabled && lowStockThreshold === null) throw new Error('Enter a nonnegative threshold that fits the selected unit and supported range.')
    if (refill.trim() && refillQuantity === null) throw new Error('Enter a nonnegative refill amount that fits the selected unit and supported range.')
    await setPantryPreferences(ingredient.id, { lowStockThreshold, refillQuantity })
    navigate('/pantry', { state: { message: `${ingredient.name} restock preferences saved${syncStatus === 'offline' ? ' on this device; will sync when online' : ''}.` } })
  })
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await action.run() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Preferences could not be saved.') }
  }
  return <form className="restock-preferences" onSubmit={submit} aria-busy={action.pending}>
    <header className="page-heading"><h1>{ingredient.name}</h1><p>Current balance: {formatExactQuantity(balance, ingredient.family)}</p></header>
    <label className="preference-toggle"><input type="checkbox" checked={enabled} disabled={action.pending} onChange={event => setEnabled(event.target.checked)} /><span>Warn when stock is low</span></label>
    <p className="muted-copy">{enabled ? 'Needs restock includes this ingredient when its balance is at or below your threshold.' : 'With warnings off, this ingredient needs restock only when its balance is zero or below.'}</p>
    {enabled && <div className="grocery-amount-fields"><label className="field-group"><span>Low-stock threshold</span><input inputMode="decimal" value={threshold} disabled={action.pending} onChange={event => setThreshold(event.target.value)} required /></label><label className="field-group"><span>Threshold unit</span><select value={thresholdUnit} disabled={action.pending} onChange={event => setThresholdUnit(event.target.value as Unit)}>{familyUnits[ingredient.family].map(unit => <option key={unit}>{unit}</option>)}</select></label></div>}
    <div className="grocery-amount-fields"><label className="field-group"><span>Usual refill amount <small>optional</small></span><input inputMode="decimal" value={refill} disabled={action.pending} onChange={event => setRefill(event.target.value)} /></label><label className="field-group"><span>Refill unit</span><select value={refillUnit} disabled={action.pending} onChange={event => setRefillUnit(event.target.value as Unit)}>{familyUnits[ingredient.family].map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
    <p className="muted-copy">The refill amount is a fixed amount to buy, independent of your balance or threshold. You can edit it before adding to a shopping list. Leave blank or use zero to decide each time.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="inline-actions"><Link className="button secondary" to="/pantry">Cancel</Link><button className="button primary" disabled={!canMutate || action.pending}>{action.pending ? 'Saving…' : 'Save preferences'}</button></div>
  </form>
}
