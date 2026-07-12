// Opt-in web push. Requires:
//   1. VITE_VAPID_PUBLIC_KEY in the client env
//   2. the send-push Edge Function deployed with the private key
//   3. a Supabase database webhook on notifications inserts → send-push
// See docs/NOTIFICATIONS.md. Everything fails soft when unsupported.

import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'
import { isSupabaseConfigured } from './supabase-env'

export type PushSupport = 'ok' | 'unsupported' | 'no-key' | 'no-backend'

export function pushSupport(): PushSupport {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return 'no-key'
  if (!isSupabaseConfigured) return 'no-backend'
  return 'ok'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(normalized)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Returns 'enabled', 'denied', or an error string. User-initiated only. */
export async function enablePushNotifications(): Promise<string> {
  const support = pushSupport()
  if (support === 'unsupported') return 'this browser cannot receive push'
  if (support === 'no-key') return 'push keys not configured on this deployment'
  if (support === 'no-backend') return 'push needs the backend connected'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  try {
    // Reuse the worker the app already registered (the versioned /sw.js?v=<build>
    // from App.tsx). Registering a second, *unversioned* /sw.js here points the
    // same '/' scope at a different script URL, so the two registrations keep
    // replacing each other's controller — every load fires `controllerchange`,
    // which reloads the page, looping the user onto the "frequency dropped"
    // screen. Fall back to the same versioned URL only if nothing is registered.
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(__SW_VERSION__)}`))
    await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY as string),
    })

    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (!client || !userId) return 'backend session unavailable'

    const json = subscription.toJSON()
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    }, { onConflict: 'endpoint' })
    return error ? 'could not store subscription' : 'enabled'
  } catch {
    return 'push setup failed'
  }
}

export async function disablePushNotifications(): Promise<boolean> {
  try {
    // No URL filter: match the single registration at the '/' scope, whatever
    // versioned ?v= URL it was registered with.
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      const client = getOptionalSupabaseClient()
      if (client) {
        await client.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      }
      await subscription.unsubscribe()
    }
    return true
  } catch {
    return false
  }
}
