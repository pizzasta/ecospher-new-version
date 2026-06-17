// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { CRASH_LOOP_THRESHOLD, clearCrashLog, isCrashLooping, recordCrash } from '../crashLoop'

const CRASH_LOG_KEY = 'ecosphere:crashLog'

describe('crashLoop', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('counts crashes within the window and flags a loop at the threshold', () => {
    const t = 1_000_000
    for (let i = 1; i < CRASH_LOOP_THRESHOLD; i++) {
      expect(recordCrash(t + i)).toBe(i)
      expect(isCrashLooping(t + i)).toBe(false)
    }
    // the threshold-th crash trips the loop
    expect(recordCrash(t + CRASH_LOOP_THRESHOLD)).toBe(CRASH_LOOP_THRESHOLD)
    expect(isCrashLooping(t + CRASH_LOOP_THRESHOLD)).toBe(true)
  })

  it('drops crashes that fall outside the recent window', () => {
    recordCrash(0)
    // a crash a full window later should not count the stale one
    expect(recordCrash(120_000)).toBe(1)
    expect(isCrashLooping(120_000)).toBe(false)
  })

  it('clearCrashLog resets the count so a healthy boot starts fresh', () => {
    const t = 2_000_000
    recordCrash(t)
    recordCrash(t + 1)
    recordCrash(t + 2)
    expect(isCrashLooping(t + 2)).toBe(true)
    clearCrashLog()
    expect(isCrashLooping(t + 2)).toBe(false)
    expect(recordCrash(t + 3)).toBe(1)
  })

  it('survives a corrupt crash log without throwing', () => {
    window.localStorage.setItem(CRASH_LOG_KEY, '{not json')
    expect(() => isCrashLooping()).not.toThrow()
    expect(recordCrash(5_000_000)).toBe(1)
  })
})
