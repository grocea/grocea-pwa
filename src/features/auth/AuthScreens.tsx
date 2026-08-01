import { ArrowRight, CheckCircle, LockKey, SignIn, UserPlus } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../app/auth-context'

type AuthMode = 'login' | 'register'

function returnTarget(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/pantry'
  if (value === '/login' || value === '/register' || value === '/welcome') return '/pantry'
  return value
}

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register'
  const { signIn, register, error: sessionError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const target = returnTarget(new URLSearchParams(location.search).get('returnTo'))
  const passwordError = password.length > 0 && (password.length < 15 || password.length > 128)
    ? 'Use between 15 and 128 characters.'
    : ''
  const confirmationError = isRegister && confirmation.length > 0 && confirmation !== password
    ? 'Passwords do not match.'
    : ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setError(null)
    if (!email.trim() || !password || Boolean(passwordError) || (isRegister && (!displayName.trim() || !confirmation || confirmation !== password))) return
    setPending(true)
    try {
      if (isRegister) await register(email, password, displayName)
      else await signIn(email, password)
      navigate(target, { replace: true })
    } catch (requestError) {
      const apiError = requestError instanceof ApiError ? requestError : null
      setError(apiError?.message ?? 'The account request could not be completed. Try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="auth-page"><div className="auth-card">
    <Link className="auth-brand" to="/welcome"><img src="/brand/grocea-icon.png" alt="" />grocea</Link>
    <div className="auth-heading"><span className="auth-icon" aria-hidden="true">{isRegister ? <UserPlus size={24} /> : <SignIn size={24} />}</span><span className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span><h1>{isRegister ? 'Make your kitchen yours.' : 'Pick up where you left off.'}</h1><p>{isRegister ? 'Create a personal account, then keep your kitchen available offline.' : 'Sign in to your account to open its private pantry and sync queue.'}</p></div>
    {(error || sessionError) && <div className="warning-banner danger" role="alert"><LockKey /><span>{error ?? sessionError}</span></div>}
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
      {isRegister && <label className="field-group"><span>Display name</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" maxLength={120} required aria-invalid={submitted && !displayName.trim()} /></label>}
      <label className="field-group"><span>Email address</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required aria-invalid={submitted && !email.trim()} /></label>
      <label className="field-group"><span>Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={15} maxLength={128} required aria-invalid={submitted && Boolean(passwordError)} aria-describedby="password-help" /><small id="password-help">15–128 characters. Spaces are allowed.</small>{submitted && passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label>
      {isRegister && <label className="field-group"><span>Repeat password</span><input type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={15} maxLength={128} required aria-invalid={submitted && Boolean(confirmationError)} />{submitted && confirmationError && <span className="field-error" role="alert">{confirmationError}</span>}</label>}
      <button className="button primary auth-submit" disabled={pending}>{pending ? 'Working…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight /></button>
    </form>
    <div className="auth-footnote"><CheckCircle /><span>Session credentials stay in a secure, HttpOnly cookie. Your offline data is separated by account.</span></div>
    <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Grocea?'} <Link to={`/${isRegister ? 'login' : 'register'}${location.search}`}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
  </div></main>
}
