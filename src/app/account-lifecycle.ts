/** Account-scoped invalidation is persistent so suspended tabs cannot reopen deleted data. */
export const TRIAL_STORAGE_PREFIX = 'grocea:trial:'
const CONTROL_PREFIX = 'grocea:account-control:'
let activeAccount: string | null = null
const closers = new Map<string, Set<() => void>>()
export function setActiveAccount(userId: string | null) {
  if (activeAccount && activeAccount !== userId) closeAccountConnections(activeAccount)
  activeAccount = userId
}
export function accountControl(userId: string) { return localStorage.getItem(`${CONTROL_PREFIX}${userId}`) }
export class AccountUnavailableError extends Error {}
export function deletedAccountIds() { return Object.keys(localStorage).filter(key => key.startsWith(CONTROL_PREFIX) && localStorage.getItem(key) === 'deleted').map(key => key.slice(CONTROL_PREFIX.length)) }
export function assertAccountAvailable(userId?: string) {
  if (userId && (activeAccount !== userId || accountControl(userId))) throw new AccountUnavailableError('Account operations are paused. Sign in again or finish account cleanup.')
}
export function registerAccountConnection(userId: string, close: () => void) {
  const callbacks = closers.get(userId) ?? new Set<() => void>()
  callbacks.add(close)
  closers.set(userId, callbacks)
  return () => { callbacks.delete(close) }
}
export function closeAccountConnections(userId: string) { closers.get(userId)?.forEach(close => close()) }
export function controlAccount(userId: string, state: 'paused' | 'deleted' | null) {
  const key = `${CONTROL_PREFIX}${userId}`
  if (state) localStorage.setItem(key, state)
  else localStorage.removeItem(key)
  window.dispatchEvent(new CustomEvent('grocea:account-control', { detail: { userId, state } }))
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grocea-account-control') : null
  channel?.postMessage({ userId, state })
  channel?.close()
}
export function clearTrialStorage(userId: string) {
  const prefix = `${TRIAL_STORAGE_PREFIX}${userId}`
  for (const key of Object.keys(localStorage)) if (key === prefix || key.startsWith(`${prefix}:`)) localStorage.removeItem(key)
}
function receive(userId: string, state: string | null) {
  if (state === 'deleted') closeAccountConnections(userId)
  window.dispatchEvent(new CustomEvent('grocea:account-control', { detail: { userId, state } }))
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key?.startsWith(CONTROL_PREFIX)) receive(event.key.slice(CONTROL_PREFIX.length), event.newValue)
  })
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('grocea-account-control') : null
  channel?.addEventListener('message', event => {
    if (typeof event.data?.userId === 'string') receive(event.data.userId, event.data.state)
  })
}
