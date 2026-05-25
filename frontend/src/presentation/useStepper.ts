import { useCallback, useEffect, useState } from 'react'

export function useStepper(total: number, autoAdvance: boolean) {
  const [index, setIndex] = useState(0)

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  return {
    index,
    setIndex,
    goNext,
    goPrev,
    isFirst: index === 0,
    isLast: index >= total - 1,
    autoAdvance,
  }
}
