import { useEffect, useRef } from 'react'

const IDLE_MS = 3 * 60 * 1000 // 3 minutes of no interaction

export function useIdleRefresh(onRefresh) {
  const timer = useRef(null)

  useEffect(() => {
    function resetTimer() {
      clearTimeout(timer.current)
      timer.current = setTimeout(onRefresh, IDLE_MS)
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        onRefresh()
        resetTimer()
      } else {
        clearTimeout(timer.current)
      }
    }

    const events = ['touchstart', 'click', 'keydown', 'mousemove', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibility)

    resetTimer()

    return () => {
      clearTimeout(timer.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [onRefresh])
}
