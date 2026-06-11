import { describe, expect, it } from 'vitest'
import { formatBadge, formatRelativeTime } from '../notifications'

describe('notification formatting', () => {
  const now = Date.UTC(2026, 5, 11, 12, 0, 0)

  it('formats relative times', () => {
    expect(formatRelativeTime(now - 20 * 1000, now)).toBe('just now')
    expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe('5m ago')
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3h ago')
    expect(formatRelativeTime(now - 24 * 60 * 60 * 1000, now)).toBe('yesterday')
    expect(formatRelativeTime(now - 4 * 24 * 60 * 60 * 1000, now)).toBe('4d ago')
  })

  it('never goes negative on clock skew', () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe('just now')
  })

  it('caps the badge at 99+', () => {
    expect(formatBadge(3)).toBe('3')
    expect(formatBadge(99)).toBe('99')
    expect(formatBadge(120)).toBe('99+')
  })
})
