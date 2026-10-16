import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../app/auth-context'
import { clearTrial, deleteTrialNote, readTrial, saveTrialNote, startTrial, stopTrial, trialError, trialExport } from '../../app/trial-journal'
import { AppShell, BackHeader, PageHeading } from '../../shared/ui/AppShell'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

const labels = { pantry_setup: 'First pantry stock saved', shopping_completed: 'Shopping completed', cooking_completed: 'Cooking completed' }
export function TrialScreen() {
  const { account } = useAuth()
  const userId = account!.id
  const [, refresh] = useState(0)
  const [consent, setConsent] = useState(false)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | undefined>()
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const update = () => refresh(value => value + 1)
    window.addEventListener('grocea:trial-change', update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener('grocea:trial-change', update); window.removeEventListener('storage', update) }
  }, [])
  const trial = readTrial(userId), error = trialError(userId)
  async function note(event: FormEvent) {
    event.preventDefault()
    if (await saveTrialNote(userId, text, editing)) { setText(''); setEditing(undefined); setMessage('Note saved on this browser.') }
  }
  function download() {
    const data = trialExport(userId)
    if (!data) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'grocea-trial-journal.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Export downloaded. Review your notes before sharing it yourself.')
  }
  return <AppShell navigation><BackHeader title="One-week trial" fallbackTo="/more" eyebrow="OPTIONAL · THIS BROWSER" /><main className="screen-content trial-content">
    <PageHeading title="Your trial journal" subtitle="Try the kitchen workflow. Keep a private record of the friction." />
    <div className="info-banner"><span><strong>No automatic sharing</strong><br />This journal stays with this account in this browser/device. It is not synced across devices. Clearing browser data can remove it.</span></div>
    {error && <div className="warning-banner danger" role="alert"><span><strong>Journal recording paused</strong><br />This browser could not read or save the journal. Kitchen actions still work. Some trial outcomes may be missing. Clear the journal to try a new consent period; if storage remains blocked, recording stays unavailable.</span></div>}
    {message && <p className="success-notice" role="status">{message}</p>}
    <section className="trial-section"><h2>{trial ? trial.active && !error ? 'Recording is on' : 'Recording is stopped or paused' : 'Off by default'}</h2>
      <p>Automatic entries contain only coarse pantry setup, completed shopping and cooking milestones with dates/times, plus returns on later local calendar days. A queued change is pending until the server accepts it. Rejected changes do not count.</p>
      <p>Diary notes are the text you choose to write. <strong>Do not enter names, contact details, ingredient or recipe details, or other personal information.</strong> Notes are not automatically redacted. Review them before exporting.</p>
      {!trial ? <><label className="trial-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I choose to record these milestones and my optional notes locally. I can stop, delete notes, or clear everything at any time.</span></label><button className="button primary" disabled={!consent || error} onClick={async () => { if (await startTrial(userId)) { setConsent(false); setMessage('Trial started on this browser.') } }}>Start my trial</button></> : <><p>Started {new Date(trial.startedAt).toLocaleDateString()} · Consent version {trial.consentVersion}. A planned week does not mean a week has elapsed.</p><div className="trial-actions">{trial.active && <button className="button secondary" onClick={async () => { if (await stopTrial(userId)) setMessage('Recording stopped. Pending trial candidates were removed.') }}>Stop recording</button>}<button className="button secondary" disabled={error} onClick={download}>Export journal</button></div><p className="muted">Stopping retains saved entries and notes for review. Clear them before starting a new trial.</p></>}
      {(trial || error) && <button className="button danger" onClick={() => setClearing(true)}>Clear all trial data</button>}
    </section>
    <section className="trial-section"><h2>A week to explore</h2><ol className="trial-plan"><li>Day 1: add a little pantry stock and check quantities.</li><li>Days 2–3: try a shopping list, check off items and finish shopping.</li><li>Days 4–5: try a recipe and confirm cooking.</li><li>Days 6–7: return, update stock and reflect on what helped or got in the way.</li></ol><p>Skip anything that does not fit your routine. Participation is voluntary; stopping has no effect on your kitchen data.</p></section>
    {trial && <><section className="trial-section"><h2>Accepted milestones</h2>{trial.outcomes.length ? <ul className="trial-entries">{trial.outcomes.map((item, index) => <li key={index}><strong>{labels[item.action]}</strong><span>Server accepted {new Date(item.acknowledgedAt).toLocaleString()}</span></li>)}</ul> : <p>No accepted milestones yet.</p>}<p>{Object.keys(trial.pending).length} pending trial candidate(s) · {trial.returns.length} distinct later-day return(s).</p><p className="muted">Pantry setup records the first accepted stock action in this consent period. Reloading today does not count as a later-day return.</p></section>
    <section className="trial-section"><h2>Friction diary</h2><p>What were you trying to do? What was confusing? Did you finish or find a workaround? Keep kitchen and personal details out.</p>
      {trial.active && !error && <form onSubmit={note}><label className="field-group"><span>{editing ? 'Edit note' : 'New note'} (optional, 2,000 characters max)</span><textarea rows={4} maxLength={2000} value={text} onChange={event => setText(event.target.value)} /></label><div className="trial-actions"><button className="button primary" disabled={!text.trim()}>{editing ? 'Save edited note' : 'Save note'}</button>{editing && <button type="button" className="button secondary" onClick={() => { setText(''); setEditing(undefined) }}>Cancel edit</button>}</div></form>}
      {trial.notes.length ? <ul className="trial-entries">{trial.notes.map(item => <li key={item.id}><span>{new Date(item.at).toLocaleString()}</span><p className="trial-note">{item.text}</p><div className="trial-actions">{trial.active && !error && <button className="button secondary compact" onClick={() => { setEditing(item.id); setText(item.text) }}>Edit note</button>}<button className="button danger compact" onClick={async () => { if (await deleteTrialNote(userId, item.id)) { if (editing === item.id) { setEditing(undefined); setText('') } setMessage('Note deleted.') } }}>Delete note</button></div></li>)}</ul> : <p>No diary notes saved.</p>}
    </section></>}
  </main><ConfirmDialog open={clearing} title="Clear all trial data?" description="This deletes this account’s journal from this browser, including consent, milestones, pending candidates and notes. Your kitchen data is kept." confirmLabel="Clear trial data" onDismiss={() => setClearing(false)} onConfirm={async () => { if (await clearTrial(userId)) { setText(''); setEditing(undefined); setConsent(false); setMessage('Trial data cleared. Recording is off.') } }} /></AppShell>
}
