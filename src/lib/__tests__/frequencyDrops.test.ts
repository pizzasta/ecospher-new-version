import { describe, expect, it } from 'vitest'
import { currentDrop, dropTimeLeft, nextDropAt } from '../frequencyDrops'

const EPOCH = Date.UTC(2026, 0, 2)
const DAY = 24 * 60 * 60 * 1000

describe('frequency drop schedule', () => {
  it('is live for exactly 24 hours per cycle', () => {
    expect(currentDrop(EPOCH)).not.toBeNull()
    expect(currentDrop(EPOCH + DAY - 1)).not.toBeNull()
    expect(currentDrop(EPOCH + DAY)).toBeNull()
    expect(currentDrop(EPOCH + 5 * DAY)).toBeNull()
  })

  it('returns the next drop nine days after the last', () => {
    const second = currentDrop(EPOCH + 9 * DAY + 1000)
    expect(second).not.toBeNull()
    expect(second!.id).toBe('drop-1')
  })

  it('is deterministic — every client agrees on the live drop', () => {
    const now = EPOCH + 18 * DAY + 3600_000
    expect(currentDrop(now)).toEqual(currentDrop(now))
  })

  it('rotates titles across cycles and never repeats ids', () => {
    const a = currentDrop(EPOCH)!
    const b = currentDrop(EPOCH + 9 * DAY)!
    expect(a.id).not.toBe(b.id)
    expect(a.title).not.toBe(b.title)
  })

  it('formats time left and points at the next window', () => {
    const drop = currentDrop(EPOCH)!
    expect(dropTimeLeft(drop, EPOCH + 2 * 3600_000)).toBe('22h 0m')
    expect(nextDropAt(EPOCH)).toBe(EPOCH + 9 * DAY)
  })

  it('never exists before the epoch', () => {
    expect(currentDrop(EPOCH - 1000)).toBeNull()
  })
})
