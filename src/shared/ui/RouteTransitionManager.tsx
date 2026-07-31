import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteTransitionManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const title = document.querySelector<HTMLElement>('[data-page-title]')
      if (!title) return
      document.title = `${title.textContent?.trim() || 'Grocea'} · Grocea`
      title.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pathname])
  return null
}
