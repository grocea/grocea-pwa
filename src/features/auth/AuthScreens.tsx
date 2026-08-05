import { ArrowRight, CheckCircle, LockKey, SignIn, UserPlus } from '@phosphor-icons/react'
import { useRef, useState, type FormEvent } from 'react'
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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const displayNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const target = returnTarget(new URLSearchParams(location.search).get('returnTo'))
  const passwordFormatError = password.length > 0 && (password.length < 15 || password.length > 128)
    ? 'Use between 15 and 128 characters.'
    : ''
  const updateField = (field: string, value: string, setter: (value: string) => void) => {
    setter(value)
    if (fieldErrors[field]) setFieldErrors(current => ({ ...current, [field]: '' }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const nextErrors: Record<string, string> = {}
    if (isRegister && !displayName.trim()) nextErrors.displayName = 'Enter your display name.'
    if (!email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'
    else if (passwordFormatError) nextErrors.password = passwordFormatError
    if (isRegister && !confirmation) nextErrors.confirmation = 'Repeat your password.'
    else if (isRegister && confirmation !== password) nextErrors.confirmation = 'Passwords do not match.'
    setFieldErrors(nextErrors)
    const firstInvalid = nextErrors.displayName ? displayNameRef.current
      : nextErrors.email ? emailRef.current
        : nextErrors.password ? passwordRef.current
          : nextErrors.confirmation ? confirmationRef.current
            : null
    if (firstInvalid) {
      firstInvalid.focus()
      return
    }
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
      {isRegister && <label className="field-group"><span>Display name</span><input ref={displayNameRef} value={displayName} onChange={event => updateField('displayName', event.target.value, setDisplayName)} autoComplete="name" maxLength={120} required aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'display-name-error' : undefined} />{fieldErrors.displayName && <span className="field-error" id="display-name-error" role="alert">{fieldErrors.displayName}</span>}</label>}
      <label className="field-group"><span>Email address</span><input ref={emailRef} type="email" value={email} onChange={event => updateField('email', event.target.value, setEmail)} autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'email-error' : undefined} />{fieldErrors.email && <span className="field-error" id="email-error" role="alert">{fieldErrors.email}</span>}</label>
      <label className="field-group"><span>Password</span><input ref={passwordRef} type="password" value={password} onChange={event => updateField('password', event.target.value, setPassword)} autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={15} maxLength={128} required aria-invalid={Boolean(fieldErrors.password || passwordFormatError)} aria-describedby="password-help password-error" /><small id="password-help">15–128 characters. Spaces are allowed.</small>{(fieldErrors.password || passwordFormatError) && <span className="field-error" id="password-error" role="alert">{fieldErrors.password || passwordFormatError}</span>}</label>
      {isRegister && <label className="field-group"><span>Repeat password</span><input ref={confirmationRef} type="password" value={confirmation} onChange={event => updateField('confirmation', event.target.value, setConfirmation)} autoComplete="new-password" minLength={15} maxLength={128} required aria-invalid={Boolean(fieldErrors.confirmation)} aria-describedby={fieldErrors.confirmation ? 'confirmation-error' : undefined} />{fieldErrors.confirmation && <span className="field-error" id="confirmation-error" role="alert">{fieldErrors.confirmation}</span>}</label>}
      <button className="button primary auth-submit" disabled={pending}>{pending ? 'Working…' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight /></button>
    </form>
    <div className="auth-footnote"><CheckCircle /><span>Session credentials stay in a secure, HttpOnly cookie. Your offline data is separated by account.</span></div>
    <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Grocea?'} <Link to={`/${isRegister ? 'login' : 'register'}${location.search}`}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
  </div></main>
}
