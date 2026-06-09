import { useEffect, useRef, useState } from 'react'

type TypewriterTextProps = {
  lines: string[]
  speedMs?: number
  linePauseMs?: number
  cursor?: boolean
  fadeOut?: boolean
  instant?: boolean
}

export default function TypewriterText({
  lines,
  speedMs = 40,
  linePauseMs = 800,
  cursor = true,
  fadeOut = false,
  instant = false,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState<string[]>([])
  const [currentLine, setCurrentLine] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (instant) {
      setDisplayed(lines)
      setDone(true)
      return
    }

    setDisplayed([])
    setCurrentLine(0)
    setCharIndex(0)
    setDone(false)
  }, [lines, instant])

  useEffect(() => {
    if (instant || done) return

    const line = lines[currentLine]
    if (!line) return

    if (charIndex < line.length) {
      timerRef.current = setTimeout(() => {
        setDisplayed((prev) => {
          const next = [...prev]
          next[currentLine] = (next[currentLine] ?? '') + line[charIndex]
          return next
        })
        setCharIndex((c) => c + 1)
      }, speedMs)
    } else if (currentLine < lines.length - 1) {
      timerRef.current = setTimeout(() => {
        setCurrentLine((l) => l + 1)
        setCharIndex(0)
      }, linePauseMs)
    } else {
      setDone(true)
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [charIndex, currentLine, done, instant, linePauseMs, lines, speedMs])

  return (
    <span className={`typewriter-text ${fadeOut && done ? 'fade-out' : ''}`}>
      {displayed.map((text, index) => (
        <span className="typewriter-line" key={index}>
          {text}
          {cursor && index === currentLine && !done ? <span className="typewriter-cursor">|</span> : null}
        </span>
      ))}
    </span>
  )
}
