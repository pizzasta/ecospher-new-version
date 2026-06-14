// Send web push for new notifications — wired to a Supabase Database
// Webhook on `notifications` inserts. See docs/NOTIFICATIONS.md.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//          VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=...
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

// @ts-expect-error Deno npm specifier, resolved at deploy time
import webpush from 'npm:web-push@3'
// @ts-expect-error Deno npm specifier, resolved at deploy time
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const BODY_BY_TYPE: Record<string, string> = {
  new_reaction: 'someone resonated with your signal',
  new_listener: 'someone listened to your signal',
  new_listener_follow: 'a carrier is now tuned to you',
  new_capsule: 'a capsule arrived for you',
  phantom_interaction: 'carrier_null touched your frequency',
}

Deno.serve(async (req: Request) => {
  // database webhooks send a shared secret header we configure ourselves
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  let record: { user_id?: string; type?: string } | null = null
  try {
    const body = await req.json()
    record = body?.record ?? null
  } catch {
    return new Response('invalid body', { status: 400 })
  }
  if (!record?.user_id || !record.type) return new Response('no record', { status: 400 })

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.user_id)

  if (!subscriptions || subscriptions.length === 0) return new Response('no subscriptions')

  const payload = JSON.stringify({
    title: 'Ecosphere',
    body: BODY_BY_TYPE[record.type] ?? 'something moved on the band',
    tag: record.type,
  })

  await Promise.all(subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    } catch (error: unknown) {
      // expired/revoked subscriptions clean themselves up
      const status = (error as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }))

  return new Response('ok')
})
