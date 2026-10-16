import { useRef, useState, type FormEvent } from 'react'
import { exportAccount } from '../../api/client'
import { useAuth } from '../../app/auth-context'
import { useGrocea } from '../../app/grocea-context'

export function AccountControls() {
  const { deleteAccount, status } = useAuth()
  const { flushPending } = useGrocea()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const deletionPassword = useRef<HTMLInputElement>(null)
  const [excludePending, setExcludePending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  async function download(serverOnly = false) {
    setPending(true); setError(''); setNotice('')
    try {
      if (!serverOnly && !await flushPending()) { setExcludePending(true); return }
      const data = await exportAccount()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'grocea-account.json'; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExcludePending(false); setNotice('Server data exported. This file is a snapshot; restoring it is not supported.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Export failed.') }
    finally { setPending(false) }
  }
  async function remove(event: FormEvent) {
    event.preventDefault(); setPending(true); setDeleteError('')
    try { await deleteAccount(password) }
    catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : 'Deletion could not be completed.')
      window.requestAnimationFrame(() => {
        deletionPassword.current?.focus({ preventScroll: true })
        deletionPassword.current?.closest('form')?.scrollIntoView({ block: 'end' })
      })
    }
    finally { setPending(false); setPassword('') }
  }
  return <section className="form-section account-security account-data-controls"><h2>Your account data</h2><p className="form-help">Download a versioned JSON snapshot of your saved kitchen, including archived records. Pending local changes are included only after they sync.</p>{error && <p className="field-error" role="alert">{error}</p>}{notice && <p className="success-notice" role="status">{notice}</p>}<button className="button secondary" disabled={pending || status !== 'authenticated'} onClick={() => void download()}>{pending ? 'Working…' : 'Export account data'}</button>{excludePending && <div className="warning-banner"><div><p>Some local changes or import conflicts remain. A server-only export excludes this unsynced work.</p><button className="button secondary" disabled={pending} onClick={() => void download(true)}>Export server data only</button><button className="button secondary" disabled={pending} onClick={() => setExcludePending(false)}>Cancel export</button></div></div>}<p className="form-help">Account deletion permanently removes server data and this device’s account cache and trial journal. Other devices may retain local copies. Sign out or clear Grocea site data on those devices. Downloaded files are not removed.</p>{status !== 'authenticated' && <p className="form-help">Connect and sign in to export or delete your account.</p>}{!confirm ? <button className="button danger" disabled={pending || status !== 'authenticated'} onClick={() => { setConfirm(true); setDeleteError('') }}>Delete account…</button> : <form onSubmit={remove} aria-busy={pending}><h3>Permanently delete your account?</h3><p>Pending offline changes will also be discarded. This cannot be undone.</p><label className="field-group"><span>Current password to delete account</span><input ref={deletionPassword} type="password" autoComplete="current-password" aria-invalid={Boolean(deleteError)} aria-describedby={deleteError ? "account-delete-error" : undefined} maxLength={128} required value={password} disabled={pending} onChange={event => setPassword(event.target.value)} /></label>{deleteError && <p className="field-error" id="account-delete-error" role="alert">{deleteError}</p>}<label className="field-group"><span>Type DELETE to confirm</span><input autoComplete="off" value={confirmation} disabled={pending} onChange={event => setConfirmation(event.target.value)} /></label><div className="form-actions"><button className="button secondary" type="button" disabled={pending} onClick={() => { setConfirm(false); setPassword(''); setConfirmation(''); setDeleteError('') }}>Cancel deletion</button><button className="button danger" disabled={pending || confirmation !== 'DELETE' || !password}>{pending ? 'Deleting…' : 'Permanently delete account'}</button></div></form>}</section>
}
