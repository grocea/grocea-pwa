/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ApiError,
  changePassword as changePasswordRequest,
  fetchSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  setCsrfToken,
  type AuthAccount,
  type AuthSession,
} from '../api/client'

export type AuthStatus = 'loading' | 'authenticated' | 'offline-authenticated' | 'anonymous' | 'unavailable'

const LAST_ACCOUNT_KEY = 'grocea:last-account'
const LOCAL_UNLOCKED_KEY = 'grocea:local-unlocked'
const PENDING_LOGOUT_KEY = 'grocea:pending-logout'

function readCachedAccount(): AuthAccount | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = JSON.parse(localStorage.getItem(LAST_ACCOUNT_KEY) ?? 'null') as AuthAccount | null
    return value && typeof value.id === 'string' && typeof value.email === 'string' ? value : null
  } catch {
    return null
  }
}

function cacheAccount(account: AuthAccount) {
  localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify(account))
  localStorage.setItem(LOCAL_UNLOCKED_KEY, 'true')
}

function clearLocalUnlock() {
  localStorage.removeItem(LOCAL_UNLOCKED_KEY)
}

interface AuthContextValue {
  status: AuthStatus
  session: AuthSession | null
  account: AuthAccount | null
  error: string | null
  register: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  signOut: () => Promise<void>
  lock: (message?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applySession = useCallback((next: AuthSession) => {
    setSession(next)
    setStatus('authenticated')
    setError(null)
    cacheAccount(next.account)
    window.dispatchEvent(new Event('grocea:auth-validated'))
  }, [])

  const lock = useCallback((message = 'Your session expired. Sign in again to sync your changes.') => {
    setCsrfToken(null)
    setSession(null)
    setStatus('anonymous')
    setError(message)
    clearLocalUnlock()
  }, [])

  const bootstrap = useCallback(async () => {
    if (localStorage.getItem(PENDING_LOGOUT_KEY) === 'true') {
      try {
        await fetchSession()
        await logoutAccount()
      } catch (requestError) {
        if (!(requestError instanceof ApiError) || requestError.status !== 401) {
          setStatus('unavailable')
          return
        }
      } finally {
        localStorage.removeItem(PENDING_LOGOUT_KEY)
      }
      lock()
      return
    }
    try {
      applySession(await fetchSession())
    } catch (requestError) {
      const cached = readCachedAccount()
      if (requestError instanceof ApiError && requestError.status === 0 && cached && localStorage.getItem(LOCAL_UNLOCKED_KEY) === 'true') {
        setSession(null)
        setStatus('offline-authenticated')
        setError(null)
        return
      }
      setCsrfToken(null)
      setSession(null)
      setStatus(requestError instanceof ApiError && requestError.status === 0 ? 'unavailable' : 'anonymous')
      setError(requestError instanceof ApiError && requestError.status === 0 ? 'Connection required to sign in.' : null)
    }
  }, [applySession, lock])

  useEffect(() => {
    const timer = window.setTimeout(() => { void bootstrap() }, 0)
    const onExpired = () => lock()
    const onOnline = () => { void bootstrap() }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grocea-auth') : null
    const onBroadcast = (event: MessageEvent) => {
      if (event.data === 'logout') {
        window.dispatchEvent(new CustomEvent('grocea:purge-account-cache'))
        lock('Signed out in another tab.')
      }
    }
    const onMessage = (event: StorageEvent) => {
      if (event.key === 'grocea:auth-event' && event.newValue?.startsWith('logout')) {
        window.dispatchEvent(new CustomEvent('grocea:purge-account-cache'))
        lock('Signed out in another tab.')
      }
    }
    channel?.addEventListener('message', onBroadcast)
    window.addEventListener('grocea:auth-expired', onExpired)
    window.addEventListener('online', onOnline)
    window.addEventListener('storage', onMessage)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('grocea:auth-expired', onExpired)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('storage', onMessage)
      channel?.removeEventListener('message', onBroadcast)
      channel?.close()
    }
  }, [bootstrap, lock])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const next = await registerAccount(email, password, displayName)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginAccount(email, password)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const next = await changePasswordRequest(currentPassword, newPassword)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const signOut = useCallback(async () => {
    const userId = session?.account.id
    if (!session) {
      localStorage.setItem(PENDING_LOGOUT_KEY, 'true')
      clearLocalUnlock()
      localStorage.removeItem(LAST_ACCOUNT_KEY)
      setSession(null)
      setStatus('anonymous')
      setError(null)
      localStorage.setItem('grocea:auth-event', `logout:${Date.now()}`)
      return
    }
    try {
      await logoutAccount()
      localStorage.removeItem(PENDING_LOGOUT_KEY)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 0) {
        localStorage.setItem(PENDING_LOGOUT_KEY, 'true')
      } else if (!(requestError instanceof ApiError && requestError.status === 401)) {
        throw requestError
      } else {
        localStorage.removeItem(PENDING_LOGOUT_KEY)
      }
    }
    clearLocalUnlock()
    localStorage.removeItem(LAST_ACCOUNT_KEY)
    setSession(null)
    setStatus('anonymous')
    setError(null)
    localStorage.setItem('grocea:auth-event', `logout:${Date.now()}`)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('grocea-auth')
      channel.postMessage('logout')
      channel.close()
    }
    if (!localStorage.getItem(PENDING_LOGOUT_KEY)) {
      window.dispatchEvent(new CustomEvent('grocea:purge-account-cache', { detail: { userId } }))
    }
  }, [session])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    account: session?.account ?? readCachedAccount(),
    error,
    register,
    signIn,
    changePassword,
    signOut,
    lock,
  }), [changePassword, error, lock, register, session, signIn, signOut, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
