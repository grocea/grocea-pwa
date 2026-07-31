import { useCallback, useEffect, useRef, useState } from 'react'

export function usePendingAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const actionRef = useRef(action)
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  useEffect(() => { actionRef.current = action }, [action])

  const run = useCallback(async (...args: Args): Promise<Result | undefined> => {
    if (pendingRef.current) return undefined
    pendingRef.current = true
    setPending(true)
    try {
      return await actionRef.current(...args)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }, [])

  return { pending, run }
}
