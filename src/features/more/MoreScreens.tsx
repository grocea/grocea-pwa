import { ArrowClockwise, ArrowRight, Basket, CheckCircle, Clock, Database, FolderSimple, Info, LockSimple, MagnifyingGlass, Plus, ShieldCheck, Trash, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader, BrandHeader, EmptyState, OwnershipMark, PageHeading } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

export function MoreScreen() {
  const { profile, categories, ingredients, groceryLists, syncStatus, pendingMutationCount } = useGrocea()
  const activeList = groceryLists.find(list => list.status === 'active')
  const SyncIcon = syncStatus === 'failed' ? WarningCircle : syncStatus === 'offline' ? WifiSlash : syncStatus === 'syncing' ? ArrowClockwise : pendingMutationCount ? Clock : CheckCircle
  const syncLabel = syncStatus === 'failed' ? 'Sync issue' : syncStatus === 'offline' ? 'Offline' : syncStatus === 'syncing' ? 'Syncing' : pendingMutationCount ? `${pendingMutationCount} pending` : 'Up to date'
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="More" subtitle="Preferences and catalog tools" /><Link className="profile-summary profile-summary-link" to="/profile"><span>{profile.displayName[0].toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>Local profile · Metric</small></div><ArrowRight /></Link><section className="menu-list"><Link to="/groceries"><span className="menu-icon"><Basket /></span><span><strong>Groceries</strong><small>{activeList ? `${activeList.items.filter(item => item.checked).length}/${activeList.items.length} checked · active list` : `${groceryLists.length} saved lists`}</small></span><ArrowRight /></Link><Link to="/sync-issues"><span className="menu-icon"><SyncIcon weight={syncStatus === 'idle' && !pendingMutationCount ? 'fill' : 'regular'} /></span><span><strong>Synchronization</strong><small>{syncLabel}</small></span><ArrowRight /></Link><Link to="/ingredients"><span className="menu-icon"><Basket /></span><span><strong>Ingredient catalog</strong><small>{ingredients.length} ingredients</small></span><ArrowRight /></Link><Link to="/categories"><span className="menu-icon"><FolderSimple /></span><span><strong>Categories</strong><small>{categories.length} global and custom categories</small></span><ArrowRight /></Link>{import.meta.env.DEV && <Link to="/system-states"><span className="menu-icon"><Database /></span><span><strong>System states</strong><small>Reusable UI state reference</small></span><ArrowRight /></Link>}</section><div className="info-banner"><ShieldCheck /><span><strong>Available offline</strong><br />Changes save on this device, then sync with the Grocea service.</span></div></main></AppShell>
}

export function CategoriesScreen() {
  const { categories, ingredients, createCategory } = useGrocea()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const value = name.trim()
  const duplicate = categories.some(category => category.name.toLowerCase() === value.toLowerCase())
  const error = !value ? 'Enter a category name.' : duplicate ? 'A category with this name already exists.' : ''
  const shown = useMemo(() => categories.filter(category => category.name.toLowerCase().includes(query.trim().toLowerCase())), [categories, query])
  const createAction = usePendingAction(async () => {
    await createCategory(value)
    setName('')
    setSubmitted(false)
    setAdding(false)
  })
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (error) { nameRef.current?.focus(); return }
    await createAction.run().catch(() => undefined)
  }
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="Categories" subtitle={`${categories.filter(item => item.scope === 'global').length} global · ${categories.filter(item => item.scope === 'custom').length} yours`} action={<button type="button" className="button primary compact" onClick={() => { setAdding(true); setSubmitted(false) }}><Plus />New</button>} />{adding && <form className="inline-create" onSubmit={submit} noValidate aria-busy={createAction.pending}><label><span className="sr-only">Category name</span><input ref={nameRef} autoFocus value={name} disabled={createAction.pending} aria-invalid={submitted && Boolean(error)} aria-describedby="category-name-error" onChange={event => setName(event.target.value)} placeholder="Category name" /></label><button className="button primary" disabled={createAction.pending}>{createAction.pending ? 'Adding…' : 'Add'}</button><button className="button secondary" disabled={createAction.pending} type="button" onClick={() => { setAdding(false); setName(''); setSubmitted(false) }}>Cancel</button>{submitted && error && <span className="field-error inline-create-error" id="category-name-error" role="alert">{error}</span>}</form>}<label className="search-field"><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search categories" /><span className="sr-only">Search categories</span></label>{(['global', 'custom'] as const).map(scope => <section className="category-section" key={scope}><div className="section-label"><strong>{scope === 'global' ? 'GLOBAL' : 'YOURS'}</strong><span>{scope === 'global' ? 'READ-ONLY' : 'CUSTOM'}</span></div><div className="data-list">{shown.filter(item => item.scope === scope).map(category => <div className="category-row" key={category.id}><span className="menu-icon"><FolderSimple /></span><span><strong>{category.name}</strong><small>{ingredients.filter(item => item.categoryId === category.id).length} ingredients</small></span>{scope === 'global' ? <span className="scope-mark" role="img" aria-label="Global category" title="Global category"><LockSimple aria-hidden="true" /></span> : <OwnershipMark label="Your category" />}</div>)}</div></section>)}<div className="info-banner"><Info /><span>Deleting a category would require reassigning its ingredients first.</span></div></main></AppShell>
}

export function ProfileScreen() {
  const { profile, updateProfile } = useGrocea()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.displayName)
  const [servings, setServings] = useState(profile.preferredServings)
  const [saved, setSaved] = useState(false)
  const saveAction = usePendingAction(async () => {
    await updateProfile(name.trim(), servings)
    setSaved(true)
  })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await saveAction.run().catch(() => undefined)
  }
  return <AppShell><BackHeader title="Profile" fallbackTo="/more" eyebrow="Local preferences" /><form className="form-screen wide-form" onSubmit={submit} aria-busy={saveAction.pending}><section className="profile-summary large"><span>{name.trim()[0]?.toUpperCase() || '?'}</span><div><strong>{name.trim() || 'Your profile'}</strong><small>Local profile · Metric measurements</small></div></section>{saved && <div className="success-notice" role="status">Profile preferences saved.</div>}<section className="form-section"><h2>Profile</h2><label className="field-group"><span>Display name</span><input value={name} disabled={saveAction.pending} onChange={event => { setName(event.target.value); setSaved(false) }} maxLength={120} /></label><label className="field-group"><span>Measurement system</span><select value="metric" disabled><option>Metric</option></select></label></section><section className="form-section"><h2>Cooking defaults</h2><div className="stepper-row"><span><strong>Preferred servings</strong><small>Pre-fills recipe and cook flows</small></span><div className="stepper"><button type="button" disabled={saveAction.pending} aria-label="Decrease preferred servings" onClick={() => { setServings(Math.max(1, servings - 1)); setSaved(false) }}>−</button><strong>{servings}</strong><button type="button" disabled={saveAction.pending} aria-label="Increase preferred servings" onClick={() => { setServings(Math.min(12, servings + 1)); setSaved(false) }}>+</button></div></div></section><section className="data-card"><Database /><span><strong>Offline cache enabled</strong><small>Changes synchronize with the Grocea service</small></span></section><div className="info-banner"><ShieldCheck /><span>Your profile remains local-only and unauthenticated in Phase 0.</span></div><div className="form-actions"><button className="button secondary" disabled={saveAction.pending} type="button" onClick={() => navigate('/more')}>Cancel</button><button className="button primary" disabled={!name.trim() || saveAction.pending}><CheckCircle />{saveAction.pending ? 'Saving…' : 'Save changes'}</button></div></form></AppShell>
}

export function SyncIssuesScreen() {
  const { syncStatus, pendingMutationCount, syncIssues, importConflicts, retrySync, discardSyncIssue } = useGrocea()
  const [discardTarget, setDiscardTarget] = useState<string | null>(null)
  const retryAction = usePendingAction(retrySync)
  const retryButton = <button className="button secondary" disabled={retryAction.pending} aria-busy={retryAction.pending} onClick={() => void retryAction.run().catch(() => undefined)}><ArrowClockwise />{retryAction.pending ? 'Retrying…' : 'Retry now'}</button>
  return <AppShell><BackHeader title="Synchronization" fallbackTo="/more" eyebrow={syncStatus.toUpperCase()} /><main className="screen-content sync-content"><PageHeading title="Sync status" subtitle={`${pendingMutationCount} queued change${pendingMutationCount === 1 ? '' : 's'}`} action={retryButton} />{syncStatus === 'offline' && <div className="info-banner"><WifiSlash /><span><strong>Grocea service unavailable</strong><br />Keep working. Changes remain safely queued on this device.</span></div>}{syncStatus === 'idle' && !importConflicts.length && <div className="success-notice"><CheckCircle />Local cache and the Grocea service are up to date.</div>}{syncIssues.map(issue => <article className="sync-issue" key={issue.id}><div><strong>{issue.error?.code ?? issue.type}</strong><p>{issue.error?.message ?? 'Change could not synchronize.'}</p><small>{issue.type} · {new Date(issue.createdAt).toLocaleString()}</small></div><div className="sync-issue-actions"><button className="button secondary compact" disabled={retryAction.pending} onClick={() => void retryAction.run().catch(() => undefined)}><ArrowClockwise />{retryAction.pending ? 'Retrying…' : 'Retry'}</button><button className="button danger compact" onClick={() => setDiscardTarget(issue.id)}><Trash />Discard local change</button></div></article>)}{importConflicts.map(conflict => <article className="sync-issue" key={`${conflict.kind}:${conflict.localId}`}><div><strong>Import conflict · {conflict.kind}</strong><p>{conflict.message}</p><small>Legacy ID: {conflict.localId}</small></div></article>)}{!syncIssues.length && !importConflicts.length && syncStatus !== 'idle' && <EmptyState icon={ArrowClockwise} title="No rejected changes" message="Queued changes will retry when the Grocea service is available." />}</main><ConfirmDialog open={Boolean(discardTarget)} title="Discard local change?" description="This queued change and every dependent queued change will be permanently removed. This cannot be undone." confirmLabel="Discard changes" pendingLabel="Discarding…" onDismiss={() => setDiscardTarget(null)} onConfirm={async () => { if (discardTarget) await discardSyncIssue(discardTarget) }} /></AppShell>
}

export function SystemStatesScreen() {
  return <AppShell><BackHeader title="Shared system states" fallbackTo="/more" eyebrow="Reusable UI reference" /><main className="screen-content"><PageHeading title="System states" subtitle="Consistent recovery and confirmation patterns." /><div className="states-grid"><StateCard title="Loading" label="Skeleton"><div className="skeleton"><i /><i /><i /><i /></div><small>Preserve layout. Block actions.</small></StateCard><StateCard title="Empty" label="First use"><EmptyState icon={Basket} title="Pantry is empty" message="Add your first ingredient to start tracking stock." /><small>One clear recovery action.</small></StateCard><StateCard title="Error" label="Recoverable"><div className="warning-banner danger"><WarningCircle /><span><strong>Couldn’t load pantry</strong><small>Check your connection and try again.</small></span></div><button className="button secondary">Try again</button><small>Explain cause. Keep retry nearby.</small></StateCard><StateCard title="Offline" label="Editable"><div className="info-banner"><WifiSlash /><span><strong>You’re offline</strong><br />Changes save on this device.</span></div><button className="button secondary">Add stock locally</button><small>Sharing waits for connectivity.</small></StateCard><StateCard title="Success" label="Confirmation"><div className="success-notice"><CheckCircle />Stock updated. Added 1 kg to Basmati rice.</div><small>Confirm result, not only completion.</small></StateCard></div></main></AppShell>
}

function StateCard({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return <article className="state-card"><header><strong>{title}</strong><span>{label}</span></header><div>{children}</div></article>
}
