/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ApiError,
  changePassword as changePasswordRequest,
  fetchSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  setCsrfToken,
  invalidateAccountRequests, setRequestAccount, deleteAccount as deleteAccountRequest,
  type AuthAccount,
  type AuthSession,
} from '../api/client'

import { accountControl, controlAccount, deletedAccountIds, setActiveAccount } from './account-lifecycle'
import { purgeAccountStorage } from './persistence'
import { demoAccount, demoMode } from './demo'

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
  deleteAccount: (password: string) => Promise<void>
  cleanup: { userId: string; error: string | null } | null
  retryCleanup: () => Promise<void>
  lock: (message?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return demoMode ? <DemoAuthProvider>{children}</DemoAuthProvider> : <ServerAuthProvider>{children}</ServerAuthProvider>
}

function DemoAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => { setActiveAccount(demoAccount.id); return () => setActiveAccount(null) }, [])
  const [signedIn, setSignedIn] = useState(true)
  // Demo identity stays in memory and never touches real session/cache keys.
  const value: AuthContextValue = {
    status: signedIn ? 'authenticated' : 'anonymous',
    session: null,
    account: signedIn ? demoAccount : null,
    error: null,
    register: async () => { setSignedIn(true) },
    signIn: async () => { setSignedIn(true) },
    changePassword: async () => {},
    signOut: async () => { setSignedIn(false) },
    deleteAccount: async () => { throw new Error("Account deletion is unavailable in demo mode.") },
    cleanup: null, retryCleanup: async () => {},
    lock: () => { setSignedIn(false) },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ServerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cleanup, setCleanup] = useState<{ userId: string; error: string | null } | null>(null)
  const generation = useRef(0)
  const accountIdRef = useRef<string | null>(readCachedAccount()?.id ?? null)

  const applySession = useCallback((next: AuthSession) => {
    accountIdRef.current = next.account.id
    setActiveAccount(next.account.id)
    setRequestAccount(next.account.id)
    setCsrfToken(next.csrf_token)
    setSession(next)
    setStatus('authenticated')
    setError(null)
    cacheAccount(next.account)
    window.dispatchEvent(new Event('grocea:auth-validated'))
  }, [])

  const lock = useCallback((message = 'Your session expired. Sign in again to sync your changes.') => {
    generation.current += 1
    invalidateAccountRequests()
    setActiveAccount(null)
    if (!readCachedAccount() || readCachedAccount()?.id === accountIdRef.current) clearLocalUnlock()
    accountIdRef.current = null
    setSession(null)
    setStatus('anonymous')
    setError(message)
  }, [])

  const finishCleanup = useCallback(async (userId: string) => {
    setCleanup({ userId, error: null })
    try { await purgeAccountStorage(userId); setCleanup(null); return true }
    catch (failure) { setCleanup({ userId, error: failure instanceof Error ? failure.message : 'Local cleanup is incomplete.' }); return false }
  }, [])
  const retryCleanup = useCallback(async () => { if (cleanup) await finishCleanup(cleanup.userId) }, [cleanup, finishCleanup])

  const bootstrap = useCallback(async () => {
    const current = ++generation.current
    for (const userId of deletedAccountIds()) if (!await finishCleanup(userId)) return
    if (current !== generation.current) return
    if (localStorage.getItem(PENDING_LOGOUT_KEY) === 'true') {
      try {
        const pendingSession = await fetchSession()
        if (current !== generation.current) return
        setCsrfToken(pendingSession.csrf_token)
        await logoutAccount()
      } catch (requestError) {
        if (!(requestError instanceof ApiError) || requestError.status !== 401) {
          setStatus('unavailable')
          return
        }
      } finally {
        if (current === generation.current) localStorage.removeItem(PENDING_LOGOUT_KEY)
      }
      if (current !== generation.current) return
      lock()
      return
    }
    try {
      const next = await fetchSession()
      if (current !== generation.current) return
      if (accountControl(next.account.id) === 'deleted') {
        lock('Account removed. Finishing local cleanup.')
        await finishCleanup(next.account.id)
        return
      }
      if (accountControl(next.account.id) === 'paused') controlAccount(next.account.id, null)
      applySession(next)
    } catch (requestError) {
      if (current !== generation.current) return
      const cached = readCachedAccount()
      if (requestError instanceof ApiError && requestError.status === 0 && cached && !accountControl(cached.id) && localStorage.getItem(LOCAL_UNLOCKED_KEY) === 'true') {
        setSession(null)
        accountIdRef.current = cached.id
        setActiveAccount(cached.id)
        setRequestAccount(cached.id)
        setStatus('offline-authenticated')
        setError(null)
        return
      }
      setCsrfToken(null)
      setSession(null)
      setStatus(requestError instanceof ApiError && requestError.status === 0 ? 'unavailable' : 'anonymous')
      setError(requestError instanceof ApiError && requestError.status === 0 ? 'Connection required to sign in.' : null)
    }
  }, [applySession, finishCleanup, lock])

  useEffect(() => {
    const timer = window.setTimeout(() => { void bootstrap() }, 0)
    const onExpired = () => lock()
    const onOnline = () => { void bootstrap() }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grocea-auth') : null
    const onBroadcast = (event: MessageEvent) => {
      if (event.data?.type === 'logout' && event.data.userId === accountIdRef.current) {
        window.dispatchEvent(new CustomEvent('grocea:purge-account-cache'))
        lock('Signed out in another tab.')
      }
    }
    const onMessage = (event: StorageEvent) => {
      if (event.key === 'grocea:auth-event' && event.newValue?.startsWith(`logout:${accountIdRef.current}:`)) {
        window.dispatchEvent(new CustomEvent('grocea:purge-account-cache'))
        lock('Signed out in another tab.')
      }
    }
    channel?.addEventListener('message', onBroadcast)
    window.addEventListener('grocea:auth-expired', onExpired)
    window.addEventListener('online', onOnline)
    const onControl = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; state: string | null }>).detail
      if (detail.state !== 'deleted') return
      const cached = readCachedAccount()
      if (accountIdRef.current === detail.userId) {
        if (cached?.id === detail.userId) {
          localStorage.removeItem(LAST_ACCOUNT_KEY)
          localStorage.removeItem(PENDING_LOGOUT_KEY)
        }
        lock('Account removed. Sign in with another account to continue.')
      }
      void finishCleanup(detail.userId)
    }
    window.addEventListener('grocea:account-control', onControl)
    window.addEventListener('storage', onMessage)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('grocea:auth-expired', onExpired)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('grocea:account-control', onControl)
      window.removeEventListener('storage', onMessage)
      channel?.removeEventListener('message', onBroadcast)
      channel?.close()
    }
  }, [bootstrap, finishCleanup, lock])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const current = ++generation.current
    const next = await registerAccount(email, password, displayName)
    if (current !== generation.current) return
    if (accountControl(next.account.id) === 'deleted') throw new Error('Finish account cleanup before signing in.')
    controlAccount(next.account.id, null)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    const current = ++generation.current
    const next = await loginAccount(email, password)
    if (current !== generation.current) return
    if (accountControl(next.account.id) === 'deleted') throw new Error('Finish account cleanup before signing in.')
    controlAccount(next.account.id, null)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = ++generation.current
    const next = await changePasswordRequest(currentPassword, newPassword)
    if (current !== generation.current) return
    if (accountControl(next.account.id) === 'deleted') throw new Error('Finish account cleanup before signing in.')
    controlAccount(next.account.id, null)
    localStorage.removeItem(PENDING_LOGOUT_KEY)
    applySession(next)
  }, [applySession])

  const signOut = useCallback(async () => {
    const userId = session?.account.id ?? readCachedAccount()?.id
    if (!session) {
      generation.current += 1
      invalidateAccountRequests()
      setActiveAccount(null)
      localStorage.setItem(PENDING_LOGOUT_KEY, 'true')
      clearLocalUnlock()
      localStorage.removeItem(LAST_ACCOUNT_KEY)
      setSession(null)
      setStatus('anonymous')
      setError(null)
      localStorage.setItem('grocea:auth-event', `logout:${userId}:${Date.now()}`)
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
    generation.current += 1
    invalidateAccountRequests()
    setActiveAccount(null)
    clearLocalUnlock()
    localStorage.removeItem(LAST_ACCOUNT_KEY)
    setSession(null)
    setStatus('anonymous')
    setError(null)
    localStorage.setItem('grocea:auth-event', `logout:${userId}:${Date.now()}`)
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('grocea-auth')
      channel.postMessage({ type: 'logout', userId })
      channel.close()
    }
    if (!localStorage.getItem(PENDING_LOGOUT_KEY)) {
      window.dispatchEvent(new CustomEvent('grocea:purge-account-cache', { detail: { userId } }))
    }
  }, [session])

  const deleteAccount = useCallback(async (password: string) => {
    const userId = session?.account.id
    if (!userId) throw new Error('Connect and sign in before deleting your account.')
    controlAccount(userId, 'paused')
    try { await deleteAccountRequest(password) }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 0) {
        lock('Deletion could not be confirmed. Connect and sign in to verify your account before editing.')
      } else controlAccount(userId, null)
      throw failure
    }
    controlAccount(userId, 'deleted')
    await finishCleanup(userId)
  }, [finishCleanup, lock, session])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    account: session?.account ?? readCachedAccount(),
    error,
    register,
    signIn,
    changePassword,
    signOut,
    deleteAccount, cleanup, retryCleanup,
    lock,
  }), [changePassword, cleanup, deleteAccount, error, lock, register, retryCleanup, session, signIn, signOut, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
