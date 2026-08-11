import { ArrowClockwise, ArrowRight, Basket, CheckCircle, Clock, Database, FolderSimple, Info, LockSimple, MagnifyingGlass, Plus, ShieldCheck, Trash, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGrocea } from '../../app/grocea-context'
import { useAuth } from '../../app/auth-context'
import type { SyncError, SyncStatus } from '../../domain/types'
import { usePendingAction } from '../../shared/lib/usePendingAction'
import { AppShell, BackHeader, BrandHeader, EmptyState, OwnershipMark, PageHeading } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

export function MoreScreen() {
  const { profile, categories, ingredients, groceryLists, syncStatus, pendingMutationCount } = useGrocea()
  const { account } = useAuth()
  const activeList = groceryLists.find(list => list.status === 'active')
  const SyncIcon = syncStatus === 'initial-sync' || syncStatus === 'syncing' ? ArrowClockwise : syncStatus === 'failed' ? WarningCircle : syncStatus === 'offline' ? WifiSlash : pendingMutationCount ? Clock : CheckCircle
  const syncLabel = syncStatus === 'initial-sync' ? 'First sync pending' : syncStatus === 'failed' ? 'Sync issue' : syncStatus === 'offline' ? 'Offline' : syncStatus === 'syncing' ? 'Syncing' : pendingMutationCount ? `${pendingMutationCount} pending` : 'Up to date'
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="More" subtitle="Preferences and catalog tools" /><Link className="profile-summary profile-summary-link" to="/profile"><span>{profile.displayName[0].toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>{account?.email ?? 'Account'} · Metric</small></div><ArrowRight /></Link><section className="menu-list"><Link to="/groceries"><span className="menu-icon"><Basket /></span><span><strong>Groceries</strong><small>{activeList ? `${activeList.items.filter(item => item.checked).length}/${activeList.items.length} checked · active list` : `${groceryLists.length} saved lists`}</small></span><ArrowRight /></Link><Link to="/sync-issues"><span className="menu-icon"><SyncIcon weight={syncStatus === 'idle' && !pendingMutationCount ? 'fill' : 'regular'} /></span><span><strong>Synchronization</strong><small>{syncLabel}</small></span><ArrowRight /></Link><Link to="/ingredients"><span className="menu-icon"><Basket /></span><span><strong>Ingredient catalog</strong><small>{ingredients.length} ingredients</small></span><ArrowRight /></Link><Link to="/categories"><span className="menu-icon"><FolderSimple /></span><span><strong>Categories</strong><small>{categories.length} global and custom categories</small></span><ArrowRight /></Link>{import.meta.env.DEV && <Link to="/system-states"><span className="menu-icon"><Database /></span><span><strong>System states</strong><small>Reusable UI state reference</small></span><ArrowRight /></Link>}</section><div className="info-banner"><ShieldCheck /><span><strong>Available offline</strong><br />Changes save in this account on this device, then sync with the Grocea service.</span></div></main></AppShell>
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
  return <AppShell navigation><BrandHeader /><main className="screen-content"><PageHeading title="Categories" subtitle={`${categories.filter(item => item.scope === 'global').length} global · ${categories.filter(item => item.scope === 'custom').length} yours`} action={<button type="button" className="button primary compact" onClick={() => { setAdding(true); setSubmitted(false) }}><Plus />New</button>} />{adding && <form className="inline-create" onSubmit={submit} noValidate aria-busy={createAction.pending}><label><span className="sr-only">Category name</span><input ref={nameRef} autoFocus value={name} disabled={createAction.pending} aria-invalid={submitted && Boolean(error)} aria-describedby="category-name-error" onChange={event => setName(event.target.value)} placeholder="Category name" /></label><button className="button primary" disabled={createAction.pending}>{createAction.pending ? 'Adding…' : 'Add'}</button><button className="button secondary" disabled={createAction.pending} type="button" onClick={() => { setAdding(false); setName(''); setSubmitted(false) }}>Cancel</button>{submitted && error && <span className="field-error inline-create-error" id="category-name-error" role="alert">{error}</span>}</form>}<label className="search-field"><MagnifyingGlass /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search categories" /><span className="sr-only">Search categories</span></label>{(['global', 'custom'] as const).map(scope => { const scoped = shown.filter(item => item.scope === scope); return <section className="category-section" key={scope}><div className="section-label"><strong>{scope === 'global' ? 'GLOBAL' : 'YOURS'}</strong><span>{scope === 'global' ? 'READ-ONLY' : 'CUSTOM'}</span></div>{scoped.length ? <div className="data-list">{scoped.map(category => <div className="category-row" key={category.id}><span className="menu-icon"><FolderSimple /></span><span><strong>{category.name}</strong><small>{ingredients.filter(item => item.categoryId === category.id).length} ingredients</small></span>{scope === 'global' ? <span className="scope-mark" role="img" aria-label="Global category" title="Global category"><LockSimple aria-hidden="true" /></span> : <OwnershipMark label="Your category" />}</div>)}</div> : query.trim() ? <EmptyState icon={FolderSimple} title={`No ${scope === 'global' ? 'global' : 'custom'} categories found`} message="Try another search or clear the filter." action={<button className="button secondary" type="button" onClick={() => setQuery('')}>Clear search</button>} /> : null}</section> })}<div className="info-banner"><Info /><span>Deleting a category would require reassigning its ingredients first.</span></div></main></AppShell>
}

function describeSyncIssue(issue: { type: string; error?: { code: string; message: string } }) {
  if (issue.error?.code === 'LOCAL_ID_UNMAPPED') return { title: 'Local change needs remapping', message: 'This older local change references data that is not linked to your account. Discard it, then recreate the change after the first sync.' }
  if (issue.error?.code === 'GROCERY_CALCULATION_STALE') return { title: 'Grocery plan needs review', message: 'Recipe or Pantry data changed while this plan was syncing. Review the restored Basket, then create the list again.' }
  if (issue.error?.code === 'DEPENDENCY_FAILED') return { title: 'A related change did not sync', message: 'This change is waiting on another update. Retry sync after reviewing the earlier issue.' }
  if (issue.error?.code === 'NETWORK_UNAVAILABLE') return { title: 'Waiting for connection', message: 'Your change is safe on this device and will retry when the service is reachable.' }
  if (issue.type === 'grocery-list.create') return { title: 'Grocery list could not sync', message: 'Review your Basket and try creating the Grocery List again.' }
  if (issue.type.startsWith('stock.')) return { title: 'Pantry change needs attention', message: 'Your local Pantry is unchanged on the server. Retry sync to send this adjustment again.' }
  if (issue.type.startsWith('recipe.')) return { title: 'Recipe change needs attention', message: 'Your recipe is still available locally. Retry sync to send this change again.' }
  return { title: 'Change needs attention', message: 'This change is safe on this device. Retry sync or discard it if you no longer want to send it.' }
}

function initialSyncCause(syncError: SyncError | null) {
  if (syncError?.code === 'NETWORK_UNAVAILABLE' || syncError?.status === 0) return 'The Grocea service is unavailable right now. Starter data is available for viewing, but editing is locked until the first sync completes.'
  if (syncError && syncError.status >= 500) return 'The Grocea service is having trouble right now. Starter data is available for viewing while we retry; editing is locked until the first sync completes.'
  return 'Your account has not completed its first sync yet. Starter data is available for viewing and will be replaced by your account data after a successful sync.'
}

function syncErrorDetails(syncError: SyncError | null) {
  if (!syncError) return null
  return <details className="sync-error-details"><summary>Show technical details</summary><small>Code: {syncError.code}<br />HTTP status: {syncError.status}<br />Message: {syncError.message}</small></details>
}

function syncStatusNotice(syncStatus: SyncStatus, pendingMutationCount: number, hasFailures: boolean, hasConflicts: boolean, syncError: SyncError | null, onRetry: () => void, retrying: boolean) {
  if (hasConflicts) return <div className="warning-banner"><WarningCircle /><span><strong>Imported data needs review</strong><small>Resolve the conflicts below before treating synchronization as complete.</small></span></div>
  if (hasFailures) return <div className="warning-banner danger"><WarningCircle /><span><strong>{pendingMutationCount} change{pendingMutationCount === 1 ? '' : 's'} need attention</strong><small>Local changes remain available. Retry them or discard them deliberately.</small></span></div>
  if (syncStatus === 'failed') return <div className="warning-banner danger"><WarningCircle /><span><strong>Synchronization needs attention</strong><small>Retry now, then contact support if this message keeps returning.</small></span></div>
  if (syncStatus === 'initial-sync') return <div className="warning-banner initial-sync-card"><ArrowClockwise /><span><strong>First sync pending</strong><small>{initialSyncCause(syncError)}</small><button className="button secondary compact" type="button" disabled={retrying} aria-busy={retrying} onClick={onRetry}><ArrowClockwise />{retrying ? 'Retrying…' : 'Retry first sync'}</button>{syncErrorDetails(syncError)}</span></div>
  if (syncStatus === 'offline') return <div className="info-banner"><WifiSlash /><span><strong>Offline</strong><br />{pendingMutationCount ? `${pendingMutationCount} change${pendingMutationCount === 1 ? '' : 's'} saved on this device and queued for later.` : 'Changes will stay on this device until the service is reachable.'}</span></div>
  if (syncStatus === 'syncing') return <div className="info-banner"><ArrowClockwise /><span><strong>Syncing changes</strong><br />Keep working. Local updates remain available while synchronization runs.</span></div>
  if (syncStatus === 'pending') return <div className="info-banner"><Clock /><span><strong>Changes saved on this device</strong><br />{pendingMutationCount} change{pendingMutationCount === 1 ? '' : 's'} queued for synchronization.</span></div>
  return <div className="success-notice"><CheckCircle />Local cache and the Grocea service are up to date.</div>
}

export function ProfileScreen() {
  const { profile, updateProfile, pendingMutationCount, flushPending, discardAllPending } = useGrocea()
  const { account, changePassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.displayName)
  const [servings, setServings] = useState(profile.preferredServings)
  const [saved, setSaved] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const saveAction = usePendingAction(async () => {
    await updateProfile(name.trim(), servings)
    setSaved(true)
  })
  const passwordAction = usePendingAction(async () => {
    setPasswordMessage(null)
    setPasswordError(null)
    if (newPassword.length < 15 || newPassword.length > 128) throw new Error('Use between 15 and 128 characters.')
    if (newPassword !== repeatPassword) throw new Error('New passwords do not match.')
    await changePassword(currentPassword, newPassword)
    setCurrentPassword('')
    setNewPassword('')
    setRepeatPassword('')
    setPasswordMessage('Password changed. Other sessions were signed out.')
  })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await saveAction.run().catch(() => undefined)
  }
  async function updatePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    try { await passwordAction.run() } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Password could not be changed.') }
  }
  async function logout() {
    if (pendingMutationCount > 0) {
      const flushed = await flushPending()
      if (!flushed && !window.confirm('Pending offline changes will be discarded. Sign out anyway?')) return
      if (!flushed) await discardAllPending()
    }
    await signOut().catch(() => undefined)
  }
  return <AppShell navigation><BackHeader title="Profile" fallbackTo="/more" eyebrow="Account and preferences" /><main className="form-screen wide-form"><section className="profile-summary large"><span>{name.trim()[0]?.toUpperCase() || '?'}</span><div><strong>{name.trim() || 'Your profile'}</strong><small>{account?.email ?? 'Account'} · Metric measurements</small></div></section>{saved && <div className="success-notice" role="status">Profile preferences saved.</div>}<form onSubmit={submit} aria-busy={saveAction.pending}><section className="form-section"><h2>Profile</h2><label className="field-group"><span>Display name</span><input value={name} disabled={saveAction.pending} onChange={event => { setName(event.target.value); setSaved(false) }} maxLength={120} /></label><label className="field-group"><span>Measurement system</span><select value="metric" disabled><option>Metric</option></select></label></section><section className="form-section"><h2>Cooking defaults</h2><div className="stepper-row"><span><strong>Preferred servings</strong><small>Pre-fills recipe and cook flows</small></span><div className="stepper"><button type="button" disabled={saveAction.pending} aria-label="Decrease preferred servings" onClick={() => { setServings(Math.max(1, servings - 1)); setSaved(false) }}>−</button><strong>{servings}</strong><button type="button" disabled={saveAction.pending} aria-label="Increase preferred servings" onClick={() => { setServings(Math.min(12, servings + 1)); setSaved(false) }}>+</button></div></div></section><section className="data-card"><Database /><span><strong>Private offline cache enabled</strong><small>Only this account’s changes synchronize with Grocea.</small></span></section><div className="form-actions"><button className="button secondary" disabled={saveAction.pending} type="button" onClick={() => navigate('/more')}>Cancel</button><button className="button primary" disabled={!name.trim() || saveAction.pending}><CheckCircle />{saveAction.pending ? 'Saving…' : 'Save changes'}</button></div></form><form className="form-section account-security" onSubmit={updatePassword} aria-busy={passwordAction.pending}><h2>Account security</h2><p className="form-help">Change your password. All other sessions will be revoked.</p>{passwordMessage && <div className="success-notice" role="status">{passwordMessage}</div>}{passwordError && <div className="warning-banner danger" role="alert"><WarningCircle /><span>{passwordError}</span></div>}<label className="field-group"><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} minLength={15} required /></label><label className="field-group"><span>New password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={15} maxLength={128} required /></label><label className="field-group"><span>Repeat new password</span><input type="password" autoComplete="new-password" value={repeatPassword} onChange={event => setRepeatPassword(event.target.value)} minLength={15} maxLength={128} required /></label><button className="button secondary" disabled={passwordAction.pending}>{passwordAction.pending ? 'Changing…' : 'Change password'}</button></form><div className="info-banner"><ShieldCheck /><span>Your session is protected by an HttpOnly cookie and a per-session CSRF token.</span></div><button className="button danger" type="button" onClick={() => void logout()}>Sign out</button></main></AppShell>
}

export function SyncIssuesScreen() {
  const { syncStatus, syncError, pendingMutationCount, syncIssues, importConflicts, retrySync, discardSyncIssue } = useGrocea()
  const [discardTarget, setDiscardTarget] = useState<string | null>(null)
  const retryAction = usePendingAction(retrySync)
  const retryButton = pendingMutationCount || syncStatus !== 'idle' ? <button className="button secondary" disabled={retryAction.pending} aria-busy={retryAction.pending} onClick={() => void retryAction.run().catch(() => undefined)}><ArrowClockwise />{retryAction.pending ? 'Retrying…' : 'Retry now'}</button> : undefined
  const hasFailures = syncIssues.length > 0
  const runRetry = () => { void retryAction.run().catch(() => undefined) }
  return <AppShell navigation><BackHeader title="Synchronization" fallbackTo="/more" eyebrow={syncStatus.toUpperCase()} /><main className="screen-content sync-content"><PageHeading title="Sync status" subtitle={`${pendingMutationCount} queued change${pendingMutationCount === 1 ? '' : 's'}`} action={syncStatus === 'initial-sync' ? undefined : retryButton} />{syncStatusNotice(syncStatus, pendingMutationCount, hasFailures, importConflicts.length > 0, syncError, runRetry, retryAction.pending)}{syncIssues.map(issue => { const description = describeSyncIssue(issue); return <article className="sync-issue" key={issue.id}><div><strong>{description.title}</strong><p>{description.message}</p><small>{new Date(issue.createdAt).toLocaleString()}</small></div><div className="sync-issue-actions"><button className="button secondary compact" disabled={retryAction.pending} onClick={runRetry}><ArrowClockwise />{retryAction.pending ? 'Retrying…' : 'Retry'}</button><button className="button danger compact" onClick={() => setDiscardTarget(issue.id)}><Trash />Discard local change</button></div></article> })}{importConflicts.map(conflict => <article className="sync-issue" key={`${conflict.kind}:${conflict.localId}`}><div><strong>Imported data conflict</strong><p>{conflict.message}</p><details><summary>Show import details</summary><small>{conflict.kind} · Legacy item {conflict.localId}</small></details></div></article>)}</main><ConfirmDialog open={Boolean(discardTarget)} title="Discard local change?" description="This queued change and every dependent queued change will be permanently removed. This cannot be undone." confirmLabel="Discard changes" pendingLabel="Discarding…" onDismiss={() => setDiscardTarget(null)} onConfirm={async () => { if (discardTarget) await discardSyncIssue(discardTarget) }} /></AppShell>
}

export function SystemStatesScreen() {
  return <AppShell><BackHeader title="Shared system states" fallbackTo="/more" eyebrow="Reusable UI reference" /><main className="screen-content"><PageHeading title="System states" subtitle="Consistent recovery and confirmation patterns." /><div className="states-grid"><StateCard title="Loading" label="Skeleton"><div className="skeleton"><i /><i /><i /><i /></div><small>Preserve layout. Block actions.</small></StateCard><StateCard title="Empty" label="First use"><EmptyState icon={Basket} title="Pantry is empty" message="Add your first ingredient to start tracking stock." /><small>One clear recovery action.</small></StateCard><StateCard title="Error" label="Recoverable"><div className="warning-banner danger"><WarningCircle /><span><strong>Couldn’t load pantry</strong><small>Check your connection and try again.</small></span></div><button className="button secondary">Try again</button><small>Explain cause. Keep retry nearby.</small></StateCard><StateCard title="Offline" label="Editable"><div className="info-banner"><WifiSlash /><span><strong>You’re offline</strong><br />Changes save on this device.</span></div><button className="button secondary">Add stock locally</button><small>Sharing waits for connectivity.</small></StateCard><StateCard title="Success" label="Confirmation"><div className="success-notice"><CheckCircle />Stock updated. Added 1 kg to Basmati rice.</div><small>Confirm result, not only completion.</small></StateCard></div></main></AppShell>
}

function StateCard({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return <article className="state-card"><header><strong>{title}</strong><span>{label}</span></header><div>{children}</div></article>
}
