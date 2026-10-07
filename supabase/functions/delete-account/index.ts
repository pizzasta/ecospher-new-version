// Delete Account Edge Function — removes the authenticated Supabase auth user.
// App-owned rows/storage are deleted first under normal RLS. This function is
// only invoked after that cleanup succeeds so a partial wipe can still be retried.
//
// Deploy: supabase functions deploy delete-account
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY injected by Supabase.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'content-type': 'application/json',
}

function serviceContext(): { url: string; key: string } | null {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return url && key ? { url, key } : null
}

async function authenticatedUserId(req: Request): Promise<string | null> {
  const ctx = serviceContext()
  const authorization = req.headers.get('authorization')
  if (!ctx || !authorization?.startsWith('Bearer ')) return null

  const res = await fetch(`${ctx.url}/auth/v1/user`, {
    headers: {
      apikey: ctx.key,
      authorization,
    },
  })
  if (!res.ok) return null

  const user = await res.json()
  return typeof user?.id === 'string' ? user.id : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: cors })
  }

  const ctx = serviceContext()
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'service unavailable' }), { status: 503, headers: cors })
  }

  const userId = await authenticatedUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
  }

  const res = await fetch(`${ctx.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: ctx.key,
      authorization: `Bearer ${ctx.key}`,
    },
  })

  if (!res.ok) {
    const detail = await res.text()
    return new Response(JSON.stringify({ error: 'account deletion failed', detail }), { status: 502, headers: cors })
  }

  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: cors })
})
