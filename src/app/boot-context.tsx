/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface BootFailure {
  message: string
  retry: () => Promise<void>
  requestReset: () => void
}

type BootPhase = 'pending' | 'ready' | 'choice' | 'failure'

interface BootSplashContextValue {
  phase: BootPhase
  failure: BootFailure | null
  markReady: () => void
  markChoice: () => void
  markFailure: (failure: BootFailure) => void
}

const fallbackValue: BootSplashContextValue = {
  phase: 'ready',
  failure: null,
  markReady: () => undefined,
  markChoice: () => undefined,
  markFailure: () => undefined,
}

const BootSplashContext = createContext<BootSplashContextValue>(fallbackValue)

export function BootSplashProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<BootPhase>('pending')
  const [failure, setFailure] = useState<BootFailure | null>(null)
  const markReady = useCallback(() => {
    setFailure(null)
    setPhase('ready')
  }, [])
  const markChoice = useCallback(() => {
    setFailure(null)
    setPhase('choice')
  }, [])
  const clearFailure = useCallback(() => {
    setFailure(null)
    setPhase('pending')
  }, [])
  const markFailure = useCallback((next: BootFailure) => {
    setFailure({
      ...next,
      retry: async () => {
        clearFailure()
        await next.retry()
      },
    })
    setPhase('failure')
  }, [clearFailure])
  const value = useMemo(() => ({ phase, failure, markReady, markChoice, markFailure }), [failure, markChoice, markFailure, markReady, phase])
  return <BootSplashContext.Provider value={value}>{children}</BootSplashContext.Provider>
}

export function useBootSplash() {
  return useContext(BootSplashContext)
}
