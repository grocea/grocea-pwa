import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function RouteTransitionManager() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)
  const scrollPositions = useRef(new Map<string, number>())
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const page = document.querySelector<HTMLElement>('.app-page')
      const title = document.querySelector<HTMLElement>('[data-page-title]')
      if (page && previousPath.current !== pathname) scrollPositions.current.set(previousPath.current, page.scrollTop)
      const targetScroll = navigationType === 'POP' ? scrollPositions.current.get(pathname) ?? 0 : 0
      page?.scrollTo({ top: targetScroll, behavior: 'auto' })
      previousPath.current = pathname
      if (!title) return
      document.title = `${title.textContent?.trim() || 'Grocea'} · Grocea`
      title.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [navigationType, pathname])
  return null
}
