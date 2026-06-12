import { describe, expect, it } from 'vitest'
import { liveToastFor } from '../liveBus'

describe('live bus', () => {
  it('turns every event type into an ambient human line', () => {
    expect(liveToastFor({ type: 'replay' })).toMatch(/replayed a signal/)
    expect(liveToastFor({ type: 'reaction' })).toMatch(/reaction landed/)
    expect(liveToastFor({ type: 'chain_layer' })).toMatch(/chain grew/)
    expect(liveToastFor({ type: 'storm' })).toMatch(/replay storm/)
  })

  it('never leaks identities — lines carry no ids or names', () => {
    for (const type of ['replay', 'reaction', 'chain_layer', 'storm'] as const) {
      const line = liveToastFor({ type, id: 'secret-id-123', page: 'pod' })
      expect(line).not.toMatch(/secret-id-123|pod/)
    }
  })
})
