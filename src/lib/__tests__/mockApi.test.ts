import { describe, expect, it } from 'vitest'
import { apiBreakCapsule, apiGetRooms, apiGetSignals, apiReact } from '../mockApi'

describe('mock API — GET endpoints', () => {
  it('returns signals with 200', async () => {
    const res = await apiGetSignals()
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    if (res.ok) {
      expect(res.body.signals.length).toBeGreaterThan(0)
      expect(res.body.signals[0]).toHaveProperty('id')
      expect(res.body.signals[0]).toHaveProperty('content')
    }
  })

  it('returns rooms with 200', async () => {
    const res = await apiGetRooms()
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    if (res.ok) expect(res.body.rooms.length).toBeGreaterThan(0)
  })
})

describe('mock API — POST /api/react', () => {
  it('rejects a missing signalId with 400', async () => {
    const res = await apiReact({ reactionType: 'felt' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('rejects an unknown reaction type with 400', async () => {
    const res = await apiReact({ signalId: 's1', reactionType: 'like' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown signal', async () => {
    const res = await apiReact({ signalId: 'nope', reactionType: 'felt' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  it('increments the count for repeated reactions', async () => {
    const first = await apiReact({ signalId: 's2', reactionType: 'same' })
    const second = await apiReact({ signalId: 's2', reactionType: 'same' })
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(second.body.count).toBe(first.body.count + 1)
    }
  })
})

describe('mock API — POST /api/capsule/break', () => {
  it('rejects a missing capsuleId with 400', async () => {
    const res = await apiBreakCapsule({})
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown capsule', async () => {
    const res = await apiBreakCapsule({ capsuleId: 'c999' })
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  it('reveals content and tracks repeat breaks', async () => {
    const first = await apiBreakCapsule({ capsuleId: 'c1' })
    const second = await apiBreakCapsule({ capsuleId: 'c1' })
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.body.revealed.line.length).toBeGreaterThan(0)
      expect(first.body.alreadyBroken).toBe(false)
      expect(second.body.alreadyBroken).toBe(true)
    }
  })
})
