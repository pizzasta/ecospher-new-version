import { useEffect, useMemo, useRef, useState } from 'react'

type TypewriterTextProps = {
  className?: string
  cursor?: boolean
  fadeOut?: boolean
  instant?: boolean
  linePauseMs?: number
  lines: string[]
  speedMs?: number
}

export default function TypewriterText({
  className = '',
  cursor = true,
  fadeOut = false,
  instant = false,
  linePauseMs = 420,
  lines,
  speedMs = 42,
}: TypewriterTextProps) {
  const safeLines = useMemo(() => lines.filter((line) => line.length > 0), [lines])
  const [visibleLines, setVisibleLines] = useState<string[]>(safeLines.length > 0 ? [''] : [])
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (safeLines.length === 0) {
      setVisibleLines([])
      return undefined
    }

    if (instant) {
      setVisibleLines(safeLines)
      return undefined
    }

    let lineIndex = 0
    let charIndex = 0
    let cancelled = false

    setVisibleLines([''])

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const tick = () => {
      if (cancelled) {
        return
      }

      const currentLine = safeLines[lineIndex]
      charIndex += 1

      setVisibleLines((currentLines) => {
        const nextLines = [...currentLines]
        nextLines[lineIndex] = currentLine.slice(0, charIndex)
        return nextLines
      })

      if (charIndex < currentLine.length) {
        timerRef.current = window.setTimeout(tick, speedMs)
        return
      }

      lineIndex += 1
      charIndex = 0

      if (lineIndex >= safeLines.length) {
        timerRef.current = null
        return
      }

      timerRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setVisibleLines((currentLines) => [...currentLines, ''])
          tick()
        }
      }, linePauseMs)
    }

    timerRef.current = window.setTimeout(tick, speedMs)

    return () => {
      cancelled = true
      clearTimer()
    }
  }, [instant, linePauseMs, safeLines, speedMs])

  return (
    <span className={`typewriter-text ${fadeOut ? 'typewriter-fade-out' : ''} ${className}`}>
      {visibleLines.map((line, index) => (
        <span className="typewriter-line" key={`${index}-${safeLines[index] ?? ''}`}>
          {line}
          {cursor && index === visibleLines.length - 1 ? <i aria-hidden="true" /> : null}
        </span>
      ))}
    </span>
  )
}
