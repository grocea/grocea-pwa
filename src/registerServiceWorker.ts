import { useSyncExternalStore } from 'react'

export type ShellStatus = 'checking' | 'ready' | 'waiting' | 'unavailable'
let status: ShellStatus = 'checking'
let registered = false
let activeRegistration: ServiceWorkerRegistration | null = null
export function getShellStatus() { return status }
// Queued changes live in IndexedDB, so a user-requested reload keeps them.
export function applyShellUpdate() {
  const waiting = activeRegistration?.waiting
  if (!waiting) return false
  waiting.postMessage({ type: 'GROCEA_SKIP_WAITING' })
  return true
}
function subscribe(listener: () => void) {
  window.addEventListener('grocea:shell-status', listener)
  return () => window.removeEventListener('grocea:shell-status', listener)
}
export function useShellStatus() { return useSyncExternalStore(subscribe, getShellStatus) }
function publish(next: ShellStatus) {
  if (status === next) return
  status = next
  window.dispatchEvent(new Event('grocea:shell-status'))
}
async function inspect(registration: ServiceWorkerRegistration) {
  if (registration.waiting) { publish('waiting'); return }
  const worker = navigator.serviceWorker.controller
  if (!worker) { publish('checking'); return }
  const channel = new MessageChannel()
  const build = document.querySelector<HTMLMetaElement>('meta[name="grocea-build"]')?.content
  const version = await new Promise<string | undefined>(resolve => {
    const timer = window.setTimeout(() => { channel.port1.close(); resolve(undefined) }, 5000)
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.complete ? event.data?.buildId : undefined) }
    worker.postMessage({ type: 'GROCEA_SHELL_VERSION' }, [channel.port2])
  })
  publish(registration.waiting ? 'waiting' : version && version === build ? 'ready' : 'unavailable')
}
export function registerServiceWorker() {
  if (registered || !import.meta.env.PROD) return
  registered = true
  if (!('serviceWorker' in navigator)) { publish('unavailable'); return }
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      activeRegistration = registration
      const check = () => { void inspect(registration) }
      check()
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A waiting build took over; every open tab must load its matching shell.
        if (status === 'waiting') window.location.reload()
        else check()
      })
      navigator.serviceWorker.addEventListener('message', event => { if (event.data?.type === 'GROCEA_SHELL_READY') check() })
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'redundant') void inspect(registration).then(() => { if (status !== 'ready' && status !== 'waiting') publish('unavailable') })
          else check()
        })
      })
      window.addEventListener('online', () => { check(); void registration.update().then(check).catch(check) })
      window.addEventListener('focus', () => { check(); void registration.update().then(check).catch(check) })
      void registration.update().then(check).catch(() => {})
    } catch { publish('unavailable') }
  }
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => { void register() }, { once: true })
}
