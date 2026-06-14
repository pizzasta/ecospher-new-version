// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { AUDIO_BUDGET, LISTEN_ONLY_MESSAGE, canUpload, isQuotaError, pauseUploadsForToday, readLedger, recordUploadUsage, uploadsPaused } from '../audioBudget'

describe('audio budget', () => {
  beforeEach(() => window.localStorage.clear())

  it('allows uploads under budget and warns near the edge', () => {
    expect(canUpload(50_000).ok).toBe(true)
    for (let i = 0; i < Math.floor(AUDIO_BUDGET.dailyCount * 0.85); i++) recordUploadUsage(10_000)
    const check = canUpload(10_000)
    expect(check.ok).toBe(true)
    expect(check.warning).toMatch(/running low/)
  })

  it('blocks when the daily count is spent, with the friendly message', () => {
    for (let i = 0; i < AUDIO_BUDGET.dailyCount; i++) recordUploadUsage(1_000)
    const check = canUpload(1_000)
    expect(check.ok).toBe(false)
    expect(check.reason).toContain(LISTEN_ONLY_MESSAGE)
  })

  it('blocks oversized days by bytes', () => {
    recordUploadUsage(AUDIO_BUDGET.dailyBytes - 1_000)
    expect(canUpload(500_000).ok).toBe(false)
  })

  it('quota errors pause uploads until midnight', () => {
    expect(uploadsPaused()).toBe(false)
    pauseUploadsForToday()
    expect(uploadsPaused()).toBe(true)
    expect(canUpload(10).reason).toBe(LISTEN_ONLY_MESSAGE)
  })

  it('ledger resets across days', () => {
    recordUploadUsage(5_000)
    expect(readLedger().count).toBe(1)
    const tomorrow = new Date(Date.now() + 25 * 3600 * 1000)
    expect(readLedger(tomorrow).count).toBe(0)
  })

  it('recognizes storage/quota errors', () => {
    expect(isQuotaError('Payload too large')).toBe(true)
    expect(isQuotaError('storage quota exceeded')).toBe(true)
    expect(isQuotaError('network timeout')).toBe(false)
  })
})
