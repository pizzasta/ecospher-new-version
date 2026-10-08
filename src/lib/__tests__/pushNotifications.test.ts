// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Regression guard for the "frequency dropped" reload loop: enabling push must
// reuse the worker the app already registered (the versioned /sw.js?v=<build>),
// never register a second, unversioned /sw.js. Two script URLs at the same '/'
// scope keep swapping the controller, firing controllerchange → reload forever.

vi.mock('../supabase', () => ({
  getOptionalSupabaseClient: () => ({
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}))
vi.mock('../session', () => ({ ensureBackendSession: () => Promise.resolve('user-1') }))
vi.mock('../supabase-env', () => ({ isSupabaseConfigured: true }))

import { enablePushNotifications, disablePushNotifications } from '../pushNotifications'

const register = vi.fn()
const getRegistration = vi.fn()
let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> }
let registration: { pushManager: { subscribe: () => Promise<unknown>; getSubscription: () => Promise<unknown> } }

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AAAA')

  subscription = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  }
  registration = {
    pushManager: {
      subscribe: vi.fn(() => Promise.resolve(subscription)),
      getSubscription: vi.fn(() => Promise.resolve(subscription)),
    },
  }
  // an existing (versioned) registration the app already installed
  getRegistration.mockResolvedValue(registration)
  register.mockResolvedValue(registration)

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register, getRegistration, ready: Promise.resolve(registration) },
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: Object.assign(function () {}, { requestPermission: () => Promise.resolve('granted') }),
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('push registration reuses the versioned service worker', () => {
  it('enable does not register a second, unversioned /sw.js', async () => {
    const result = await enablePushNotifications()
    expect(result).toBe('enabled')
    // it must reuse the existing registration...
    expect(getRegistration).toHaveBeenCalled()
    // ...and never register the bare, unversioned worker that causes the loop.
    expect(register).not.toHaveBeenCalledWith('/sw.js')
    for (const call of register.mock.calls) {
      expect(call[0]).not.toBe('/sw.js')
    }
  })

  it('falls back to a versioned URL only when nothing is registered', async () => {
    getRegistration.mockResolvedValue(undefined)
    await enablePushNotifications()
    expect(register).toHaveBeenCalledTimes(1)
    expect(String(register.mock.calls[0][0])).toMatch(/^\/sw\.js\?v=/)
  })

  it('disable looks up the registration without a stale URL filter', async () => {
    const ok = await disablePushNotifications()
    expect(ok).toBe(true)
    expect(getRegistration).toHaveBeenCalledWith()
  })
})
