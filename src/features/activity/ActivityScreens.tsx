import { ArrowCounterClockwise, ArrowRight, ClockCounterClockwise, CookingPot, Info, PencilSimple } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import { formatQuantity } from '../../shared/lib/quantity'
import { AppShell, BackHeader, BrandHeader, EmptyState, PageHeading } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { InfoDialog } from '../../shared/ui/InfoDialog'

const eventIcon = { cooking: CookingPot, manual: PencilSimple, reversal: ArrowCounterClockwise }

function activityTimestamp(value: string) {
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const dateLabel = sameDay
    ? 'Today'
    : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
  return `${dateLabel} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function ActivityListScreen() {
  const { activity } = useGrocea()
  const [filter, setFilter] = useState<'all' | 'cooking' | 'manual'>('all')
  const [showHistoryInfo, setShowHistoryInfo] = useState(false)
  const shown = useMemo(() => activity.filter(event => filter === 'all' || event.type === filter || (filter === 'cooking' && event.type === 'reversal')), [activity, filter])
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="Activity history" subtitle="Lists each pantry stock change." action={<button className="icon-button info-trigger" type="button" aria-label="About activity history" onClick={() => setShowHistoryInfo(true)}><Info size={22} /></button>} /><div className="chip-row" aria-label="Filter activity">{(['all', 'cooking', 'manual'] as const).map(item => <button type="button" className={filter === item ? 'selected' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)} key={item}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><section className="activity-list"><div className="section-label"><strong>RECENT</strong><span>{shown.length} events</span></div>{shown.map(event => { const Icon = eventIcon[event.type]; return <Link className={`activity-row ${event.type}`} to={`/activity/${event.id}`} key={event.id}><span className="activity-icon"><Icon size={22} /></span><span><strong>{event.title}</strong><small>{event.detail}</small></span><span className="activity-time">{event.reversedAt ? 'REVERSED' : activityTimestamp(event.occurredAt)}<ArrowRight size={16} /></span></Link> })}{!shown.length && <EmptyState icon={ClockCounterClockwise} title="No activity yet" message="Cooking events and manual stock changes appear here." />}</section></main><InfoDialog open={showHistoryInfo} title="Why records stay unchanged" description="Grocea does not change original events. A correction creates a linked reversal event. This keeps pantry balances traceable." onDismiss={() => setShowHistoryInfo(false)} /></AppShell>
}

export function ActivityDetailScreen() {
  const { id } = useParams()
  const { activity, ingredient, reverseEvent } = useGrocea()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [showHistoryInfo, setShowHistoryInfo] = useState(false)
  const event = activity.find(item => item.id === id)
  if (!event) return <AppShell><BackHeader title="Activity detail" fallbackTo="/activity" /><EmptyState title="Event not found" message="This event is not available in the current session." /></AppShell>
  const canReverse = event.type === 'cooking' && !event.reversedAt
  return <AppShell><BackHeader title="Activity detail" fallbackTo="/activity" eyebrow={`${event.type[0].toUpperCase() + event.type.slice(1)} event`} action={<button className="icon-button info-trigger" type="button" aria-label="About immutable activity records" onClick={() => setShowHistoryInfo(true)}><Info size={22} /></button>} /><main className="detail-screen"><section className="event-hero"><span className="eyebrow">{event.type.toUpperCase()} EVENT</span><span className="tag">{event.reversedAt ? 'REVERSED' : 'ACTIVE'}</span><h1>{event.title.replace(/^Cooked /, '')}</h1><p>{event.detail} · {new Date(event.occurredAt).toLocaleString()}</p></section><section className="detail-section"><div className="section-title"><h2>Pantry changes</h2><span>BEFORE → AFTER</span></div><div className="data-list">{event.changes.map(change => { const source = ingredient(change.ingredientId)!; return <div className="stock-change" key={change.ingredientId}><span><strong>{source.name}</strong><small>{formatQuantity(change.before, source.family)} → {formatQuantity(change.after, source.family)}</small></span><b>{change.delta > 0n ? '+' : '−'}{formatQuantity(change.delta > 0n ? change.delta : -change.delta, source.family)}</b></div> })}</div></section>{canReverse && <div className="danger-card"><ArrowCounterClockwise /><span><strong>Undo this cooking event?</strong><small>This adds the deducted amounts back. It does not change later events.</small></span></div>}</main>{canReverse && <div className="form-actions sticky"><button className="button secondary" onClick={() => navigate('/activity')}>Keep event</button><button className="button danger" onClick={() => setConfirming(true)}><ArrowCounterClockwise />Undo cooking</button></div>}<InfoDialog open={showHistoryInfo} title="Why this event stays unchanged" description="Grocea does not change this record. Undo creates a linked reversal event and does not change later events." onDismiss={() => setShowHistoryInfo(false)} /><ConfirmDialog open={confirming} title="Undo cooking event?" description="This restores the exact ingredient amounts. It does not change the original event or later pantry changes." confirmLabel="Undo cooking" pendingLabel="Restoring…" onDismiss={() => setConfirming(false)} onConfirm={async () => { await reverseEvent(event.id); navigate('/activity', { state: { message: 'Cooking event reversed. Stock restored.' } }) }} /></AppShell>
}
