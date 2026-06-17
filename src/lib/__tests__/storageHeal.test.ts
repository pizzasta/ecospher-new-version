// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { healLocalStorage, rearmStorageHeal, STORAGE_SCHEMA_VERSION } from '../storageHeal'

const SCHEMA_KEY = 'ecosphere:schemaVersion'
const STATE_KEY = 'ecosphere:EcosystemState'

describe('healLocalStorage', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('is a no-op fast path when the schema version already matches', () => {
    window.localStorage.setItem(SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION))
    window.localStorage.setItem('ecosphere:garbage', '{not valid json')
    healLocalStorage()
    // fast path: did not sweep, left the (unparseable) key untouched
    expect(window.localStorage.getItem('ecosphere:garbage')).toBe('{not valid json')
  })

  it('drops unparseable ecosphere: keys and stamps the version', () => {
    window.localStorage.setItem('ecosphere:garbage', '{not valid json')
    window.localStorage.setItem('ecosphere:fine', '{"ok":true}')
    healLocalStorage()
    expect(window.localStorage.getItem('ecosphere:garbage')).toBeNull()
    expect(window.localStorage.getItem('ecosphere:fine')).toBe('{"ok":true}')
    expect(window.localStorage.getItem(SCHEMA_KEY)).toBe(String(STORAGE_SCHEMA_VERSION))
  })

  it('sanitizes malformed entries inside EcosystemState', () => {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({
      resonanceLevel: 50,
      recentInteractions: [
        { id: 'a', type: 'page_visit', label: 'entered relics', createdAt: 't' }, // good
        { id: 'b', type: 'signal_play' },                                          // missing label
        null,                                                                      // not an object
        'corrupt',                                                                 // primitive
      ],
    }))
    healLocalStorage()
    const healed = JSON.parse(window.localStorage.getItem(STATE_KEY)!)
    expect(healed.recentInteractions).toHaveLength(1)
    expect(healed.recentInteractions[0].id).toBe('a')
    expect(healed.resonanceLevel).toBe(50) // untouched fields preserved
  })

  it('resets a structured key stored as the wrong kind', () => {
    window.localStorage.setItem('ecosphere:chainReactions', JSON.stringify(['not', 'an', 'object']))
    window.localStorage.setItem('ecosphere:seaLines', JSON.stringify({ wrong: 'kind' }))
    healLocalStorage()
    expect(window.localStorage.getItem('ecosphere:chainReactions')).toBeNull()
    expect(window.localStorage.getItem('ecosphere:seaLines')).toBeNull()
  })

  it('keeps chainLayers items that have a string id, drops the rest', () => {
    window.localStorage.setItem('ecosphere:chainLayers', JSON.stringify([
      { id: 'x', extra: 1 },
      { noId: true },
      42,
    ]))
    healLocalStorage()
    const layers = JSON.parse(window.localStorage.getItem('ecosphere:chainLayers')!)
    expect(layers).toHaveLength(1)
    expect(layers[0].id).toBe('x')
  })

  it('preserves bare scalar flags during a sweep, only dropping corrupt JSON', () => {
    // legitimate non-JSON flags written by the app (read with plain getItem)
    window.localStorage.setItem('ecosphere:tourDone', 'yes')
    window.localStorage.setItem('ecosphere:ageConfirmed', 'yes')
    window.localStorage.setItem('ecosphere:tonightDone', '2026-06-17')
    window.localStorage.setItem('ecosphere:selfPasscode', '-1284001234') // String(hash)
    // genuinely corrupt structured data that would poison a render
    window.localStorage.setItem('ecosphere:badObject', '{"truncated":')
    window.localStorage.setItem('ecosphere:badArray', '[1,2,')
    healLocalStorage()
    expect(window.localStorage.getItem('ecosphere:tourDone')).toBe('yes')
    expect(window.localStorage.getItem('ecosphere:ageConfirmed')).toBe('yes')
    expect(window.localStorage.getItem('ecosphere:tonightDone')).toBe('2026-06-17')
    expect(window.localStorage.getItem('ecosphere:selfPasscode')).toBe('-1284001234')
    expect(window.localStorage.getItem('ecosphere:badObject')).toBeNull()
    expect(window.localStorage.getItem('ecosphere:badArray')).toBeNull()
  })

  it('rearmStorageHeal makes the heal run again after the version was stamped', () => {
    // simulate a returning user the one-time heal already ran for...
    window.localStorage.setItem(SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION))
    window.localStorage.setItem('ecosphere:garbage', '{not valid json')
    healLocalStorage() // fast-paths: leaves the poison untouched
    expect(window.localStorage.getItem('ecosphere:garbage')).toBe('{not valid json')
    // ...re-arming lets the next boot's heal re-sanitize and clear it
    rearmStorageHeal()
    healLocalStorage()
    expect(window.localStorage.getItem('ecosphere:garbage')).toBeNull()
    expect(window.localStorage.getItem(SCHEMA_KEY)).toBe(String(STORAGE_SCHEMA_VERSION))
  })

  it('strips a non-string language from settings but keeps the rest', () => {
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ language: 5, vibrate: true }))
    healLocalStorage()
    const settings = JSON.parse(window.localStorage.getItem('ecosphere:settings')!)
    expect('language' in settings).toBe(false)
    expect(settings.vibrate).toBe(true)
  })
})
