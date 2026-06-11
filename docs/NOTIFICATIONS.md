# Notification System

## In-app (works immediately)
The bell (top-right) merges two sources:
- **Local notifications** — phantom interactions and system events, stored on
  the device. These work with no backend at all.
- **Backend notifications** — rows in `public.notifications`, created by
  database triggers (migration `202606110007`) whenever someone replays your
  signal (`new_listener`), tunes to you (`new_listener_follow`), or reacts
  (`new_reaction` / `phantom_interaction` when the actor's auth metadata has
  `phantom: true`). Realtime streams new rows straight into the bell with a
  toast.

Triggers were chosen over API-side creation so every writer — the app, Edge
Functions, the phantom job — produces notifications consistently. If you
prefer API-side creation, delete the three `trg_notify_*` triggers and call
`client.from('notifications').insert(...)` next to each action instead.

## Web push (opt-in, three setup steps)

1. **Generate VAPID keys**
   ```
   npx web-push generate-vapid-keys
   ```
   - Public key → Vercel env var `VITE_VAPID_PUBLIC_KEY` (safe to expose)
   - Both keys → Edge Function secrets (next step)

2. **Deploy the sender**
   ```
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:you@yourdomain.com WEBHOOK_SECRET=$(openssl rand -hex 24)
   ```

3. **Wire the webhook**
   Supabase Dashboard → Database → Webhooks → Create:
   - Table: `notifications`, Events: `INSERT`
   - Type: HTTP request → the `send-push` function URL
   - HTTP header: `x-webhook-secret: <your WEBHOOK_SECRET>`

Users then opt in via **Settings → Push Notifications → enable push**
(permission prompt is user-initiated; denial is handled gracefully).
Subscriptions live in `push_subscriptions` (RLS own-only) and expired
endpoints are deleted automatically when a send returns 404/410.

The service worker (`public/sw.js`) only handles push display and click
focus — it does no offline caching.

Note: the CSP in `vercel.json` already allows everything this needs
(worker-src 'self', connect-src supabase).
