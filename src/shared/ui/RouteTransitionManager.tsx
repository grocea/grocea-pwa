import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function RouteTransitionManager() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)
  const previousTab = useRef<number | null>(null)
  const scrollPositions = useRef(new Map<string, number>())
  useEffect(() => {
    const rememberSelection = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.primary-navigation .nav-item')) return
      const selection = document.querySelector<HTMLElement>('.nav-glass-selection')
      if (selection) previousTab.current = Number(selection.dataset.index)
    }
    document.addEventListener('click', rememberSelection, true)
    return () => document.removeEventListener('click', rememberSelection, true)
  }, [])
  useLayoutEffect(() => {
    const selection = document.querySelector<HTMLElement>('.nav-glass-selection')
    const currentTab = selection ? Number(selection.dataset.index) : null
    const from = previousTab.current
    previousTab.current = currentTab
    if (!selection || from === null || currentTab === null || from === currentTab || !window.matchMedia('(max-width: 979px) and (prefers-reduced-motion: no-preference)').matches) return
    // Route screens remount their AppShell; retain the previous position here.
    const animation = selection.animate([
      { transform: `translateX(calc(${from} * (100% + 2px))) scale(1)`, offset: 0 },
      { transform: `translateX(calc(${(from + currentTab) / 2} * (100% + 2px))) scale(1.06, .94)`, offset: .5 },
      { transform: `translateX(calc(${currentTab} * (100% + 2px))) scale(1)`, offset: 1 },
    ], { duration: 360, easing: 'cubic-bezier(.22, 1, .36, 1)' })
    return () => animation.cancel()
  }, [pathname])
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
