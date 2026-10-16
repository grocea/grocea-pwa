import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { confirmPasswordReset, requestPasswordReset } from '../../api/client'
import { useAuth } from '../../app/auth-context'

export function RecoveryScreen({ confirm = false }: { confirm?: boolean }) {
  const { lock } = useAuth()
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (confirm) window.history.replaceState(null, '', window.location.pathname)
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [confirm])
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setPending(true)
    try {
      if (confirm) {
        if (password !== repeat) throw new Error('Passwords do not match.')
        await confirmPasswordReset(token, password)
        setToken(''); setPassword(''); setRepeat(''); lock('Password changed. Sign in with your new password.')
        setMessage('Password changed. All previous sessions and reset links are now invalid. Sign in to continue.')
      } else setMessage((await requestPasswordReset(email)).message)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Recovery is unavailable. Try again later.') }
    finally { setPending(false) }
  }
  return <main className="storage-state"><div className="storage-state-card"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>{confirm ? 'Choose a new password' : 'Forgot your password?'}</h1><p>{confirm ? 'Use 15–128 characters. You will sign in again after changing it.' : 'Enter your account email to request a one-use reset link.'}</p>{message && <p className="success-notice" role="status">{message}</p>}{error && <p className="field-error" role="alert">{error}</p>}{!(confirm && message) && <form onSubmit={submit} aria-busy={pending}>{confirm ? <><label className="field-group"><span>New password</span><input type="password" autoComplete="new-password" minLength={15} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending} /></label><label className="field-group"><span>Repeat new password</span><input type="password" autoComplete="new-password" minLength={15} maxLength={128} required value={repeat} onChange={event => setRepeat(event.target.value)} disabled={pending} /></label></> : <label className="field-group"><span>Email</span><input type="email" autoComplete="email" maxLength={320} required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} /></label>}<button className="button primary" disabled={pending || (confirm && !token)}>{pending ? 'Working…' : confirm ? 'Reset password' : 'Request reset link'}</button>{confirm && !token && !message && <p className="field-error">This link is missing its token. Request a new link.</p>}</form>}<p><Link to="/login">Back to sign in</Link> · <Link to="/forgot-password">Request another link</Link></p></div></main>
}
