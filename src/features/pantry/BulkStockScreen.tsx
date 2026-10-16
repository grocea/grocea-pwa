import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlass, Trash } from '@phosphor-icons/react'
import { useGrocea } from '../../app/grocea-context'
import type { BulkStockRow, Unit } from '../../domain/types'
import { defaultUnit, familyUnits, formatExactQuantity, maximumQuantity, parseExactPackQuantity } from '../../shared/lib/quantity'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader } from '../../shared/ui/AppShell'

type DraftRow = { ingredientId: string; operation: 'add' | 'set'; amount: string; unit: Unit; packs: boolean; packCount: string }

export function BulkStockScreen() {
  const { ingredients, balances, bulkAdjustStock, canMutate } = useGrocea()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [review, setReview] = useState<BulkStockRow[] | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const reviewRef = useRef<HTMLHeadingElement>(null)
  const { pending, run } = usePendingAction(async () => {
    if (!review) return
    try {
      await bulkAdjustStock(review)
      navigate('/pantry', { replace: true, state: { message: `Saved ${review.length} ${review.length === 1 ? 'ingredient' : 'ingredients'} on this device. Changes will sync when connected.` } })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save. Your entries are still here.')
    }
  })
  useEffect(() => { if (review) reviewRef.current?.focus() }, [review])
  const selected = new Set(rows.map(row => row.ingredientId))
  const shown = ingredients.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  function patch(id: string, change: Partial<DraftRow>) {
    setRows(current => current.map(row => row.ingredientId === id ? { ...row, ...change } : row))
    setError('')
  }
  function rowError(row: DraftRow) {
    const item = ingredients.find(item => item.id === row.ingredientId)
    if (!item) return 'Ingredient is unavailable.'
    if (row.packs && !/^\d{1,7}$/.test(row.packCount)) return 'Enter a whole pack count between 1 and 1,000,000.'
    const amount = parseExactPackQuantity(row.amount, row.unit, row.packs ? Number(row.packCount) : 1)
    if (amount === null) return 'Enter an exact amount within range (up to 6 decimal places; no rounding). Check the pack count.'
    if (row.operation === 'add' && amount === 0n) return 'The amount to add must be greater than zero.'
    const before = balances[row.ingredientId] ?? 0n
    const after = row.operation === 'set' ? amount : before + amount
    if (after > maximumQuantity || after < -maximumQuantity || after - before > maximumQuantity || after - before < -maximumQuantity) return 'The resulting balance or change exceeds the supported range.'
    return ''
  }
  function prepare(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const invalid = rows.find(row => rowError(row))
    if (invalid) {
      setError('Check the highlighted row. Nothing has been saved.')
      document.getElementById(`bulk-amount-${invalid.ingredientId}`)?.focus()
      return
    }
    if (!rows.length) { setError('Select at least one ingredient.'); searchRef.current?.focus(); return }
    setError('')
    setReview(rows.map(row => ({ ingredientId: row.ingredientId, operation: row.operation, amount: row.amount,
      unit: row.unit, packCount: row.packs ? Number(row.packCount) : 1, before: balances[row.ingredientId] ?? 0n })))
  }
  function remove(id: string) {
    setRows(current => current.filter(row => row.ingredientId !== id))
    searchRef.current?.focus()
  }
  return <AppShell navigation>
    <BackHeader title="Update several items" onBack={review ? () => { setReview(null); setError('') } : () => navigate('/pantry')} />
    <main className="screen-content bulk-content">
      <p className="bulk-intro">Set totals for pantry setup, or add purchased amounts. Every ingredient saves together in one history entry.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      {!canMutate && <p role="status">Complete your first sync before updating stock.</p>}
      {review ? <section className="bulk-review" aria-labelledby="bulk-review-heading">
        <h2 id="bulk-review-heading" ref={reviewRef} tabIndex={-1}>Review {review.length} {review.length === 1 ? 'ingredient' : 'ingredients'}</h2>
        <p>Check the amount and final balance. Saving also tracks each selected ingredient in Pantry.</p>
        <div className="bulk-review-list">{review.map(row => {
          const item = ingredients.find(item => item.id === row.ingredientId)
          if (!item) return <article key={row.ingredientId} className="bulk-review-row"><h3>Unavailable ingredient</h3><p role="alert" className="field-error">This ingredient is no longer available. Return to editing to remove it. Nothing has been saved.</p></article>
          const amount = parseExactPackQuantity(row.amount, row.unit, row.packCount)!
          const after = row.operation === 'set' ? amount : row.before + amount
          return <article key={row.ingredientId} className="bulk-review-row">
            <h3>{item.name}</h3>
            <p>{row.operation === 'set' ? 'Set total' : 'Add purchased amount'} · {row.packCount > 1 ? `${row.packCount} × ${row.amount} ${row.unit} = ` : ''}{formatExactQuantity(amount, item.family)}</p>
            <dl><div><dt>Before</dt><dd>{formatExactQuantity(row.before, item.family)}</dd></div><div><dt>Change</dt><dd>{after - row.before > 0n ? '+' : ''}{formatExactQuantity(after - row.before, item.family)}</dd></div><div><dt>After</dt><dd>{formatExactQuantity(after, item.family)}</dd></div></dl>
          </article>
        })}</div>
        <div className="bulk-save-actions">
          <button className="button secondary" disabled={pending} onClick={() => { setReview(null); setError('') }}>Back to editing</button>
          <button className="button primary" disabled={pending || !canMutate || review.some(row => !ingredients.some(item => item.id === row.ingredientId))} onClick={() => void run()}>{pending ? 'Saving…' : `Save ${review.length} ${review.length === 1 ? 'ingredient' : 'ingredients'}`}</button>
        </div>
        <p className="helper-text">Saved on this device first, then synced when connected. A server conflict appears in Sync issues; the batch never partially saves.</p>
      </section> : <form onSubmit={prepare} noValidate>
        <div className="bulk-layout">
          <section className="bulk-selector" aria-labelledby="bulk-select-heading">
            <h2 id="bulk-select-heading">1. Select ingredients <span>{rows.length}/100</span></h2>
            <label className="search-field"><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Search ingredients for bulk update</span><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ingredients…" /></label>
            <div className="bulk-catalog">{shown.map(item => <label key={item.id} className={selected.has(item.id) ? 'selected' : ''}>
              <input type="checkbox" checked={selected.has(item.id)} disabled={!selected.has(item.id) && rows.length >= 100} onChange={event => {
                if (event.target.checked) setRows(current => [...current, { ingredientId: item.id, operation: 'set', amount: '', unit: defaultUnit(item.family), packs: false, packCount: '1' }])
                else setRows(current => current.filter(row => row.ingredientId !== item.id))
                setError('')
              }} /><span><strong>{item.name}</strong><small>{formatExactQuantity(balances[item.id] ?? 0n, item.family)} on hand</small></span>
            </label>)}</div>
            {!shown.length && <p className="empty-state">No ingredients match. Try another search.</p>}
          </section>
          <section className="bulk-editor" aria-labelledby="bulk-edit-heading">
            <h2 id="bulk-edit-heading">2. Enter amounts</h2>
            {!rows.length && <p className="empty-state">Select ingredients to enter their amounts.</p>}
            {rows.map(row => {
              const item = ingredients.find(item => item.id === row.ingredientId)
              if (!item) return <fieldset key={row.ingredientId} className="bulk-edit-row"><legend>Unavailable ingredient</legend><p role="alert" className="field-error">This ingredient is no longer available. Remove it to continue; other entries are preserved.</p><button type="button" className="button secondary" onClick={() => remove(row.ingredientId)}>Remove unavailable ingredient</button></fieldset>
              const invalid = submitted ? rowError(row) : ''
              const amount = parseExactPackQuantity(row.amount, row.unit, row.packs ? Number(row.packCount) : 1)
              const before = balances[item.id] ?? 0n
              return <fieldset key={row.ingredientId} className="bulk-edit-row">
                <legend>{item.name}</legend>
                <button type="button" className="bulk-remove" aria-label={`Remove ${item.name} from bulk update`} onClick={() => remove(item.id)}><Trash size={20} /></button>
                <label className="field-group"><span>Operation</span><select aria-label={`Operation for ${item.name}`} value={row.operation} onChange={event => patch(item.id, { operation: event.target.value as DraftRow['operation'] })}><option value="set">Set total on hand</option><option value="add">Add purchased amount</option></select></label>
                <label className="bulk-pack-toggle"><input type="checkbox" checked={row.packs} onChange={event => patch(item.id, { packs: event.target.checked })} />Enter packs for {item.name}</label>
                <div className={`bulk-amount-fields${row.packs ? ' with-packs' : ''}`}>
                  {row.packs && <label className="field-group"><span>Whole packs</span><input inputMode="numeric" aria-label={`Pack count for ${item.name}`} value={row.packCount} onChange={event => patch(item.id, { packCount: event.target.value })} /></label>}
                  <label className="field-group"><span>{row.packs ? 'Amount per pack' : 'Amount'}</span><input id={`bulk-amount-${item.id}`} inputMode="decimal" aria-label={`Amount for ${item.name}`} value={row.amount} aria-invalid={!!invalid} aria-describedby={invalid ? `bulk-error-${item.id}` : undefined} onChange={event => patch(item.id, { amount: event.target.value })} /></label>
                  <label className="field-group"><span>Unit</span><select aria-label={`Unit for ${item.name}`} value={row.unit} onChange={event => patch(item.id, { unit: event.target.value as Unit })}>{familyUnits[item.family].map(unit => <option key={unit}>{unit}</option>)}</select></label>
                </div>
                {invalid && <p id={`bulk-error-${item.id}`} className="field-error">{invalid}</p>}
                <p className="bulk-projection" aria-live="polite">{amount !== null && !rowError(row) ? <>{row.packs && <span>{row.packCount} × {row.amount} {row.unit} = {formatExactQuantity(amount, item.family)} · </span>}{formatExactQuantity(before, item.family)} → <strong>{formatExactQuantity(row.operation === 'set' ? amount : before + amount, item.family)}</strong></> : 'Enter an amount to preview the new balance.'}</p>
              </fieldset>
            })}
          </section>
        </div>
        <div className="bulk-save-actions"><button type="button" className="button secondary" onClick={() => navigate('/pantry')}>Cancel</button><button className="button primary" disabled={!rows.length || !canMutate}>Review {rows.length || ''} {rows.length === 1 ? 'ingredient' : 'ingredients'}</button></div>
      </form>}
    </main>
  </AppShell>
}
