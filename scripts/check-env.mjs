// Build-time env verification. The backend is optional by design (the app
// runs fully on localStorage/IndexedDB without it), so a completely empty
// config is fine — but a *partial* config is always a mistake and fails
// the build before it ships broken.
//
// Only client-exposed prefixes (VITE_, NEXT_PUBLIC_) ever reach the bundle;
// server-side vars like SUPABASE_SERVICE_ROLE_KEY that integrations inject
// into the build environment are harmless and ignored.

const url =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ''
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ''

// fatal only if a secret would actually be exposed to the client
const forbidden = Object.keys(process.env).filter(
  key => /^(VITE_|NEXT_PUBLIC_).*(SERVICE_ROLE|SECRET)/i.test(key) && process.env[key],
)
if (forbidden.length > 0) {
  console.error(
    `[check-env] FATAL: ${forbidden.join(', ')} uses a client-exposed prefix. ` +
    'Service-role keys and secrets must never be available to the client bundle.',
  )
  process.exit(1)
}

if (Boolean(url) !== Boolean(anonKey)) {
  console.error(
    '[check-env] FATAL: partial Supabase config — set both the URL and the ' +
    'anon/publishable key (VITE_ or NEXT_PUBLIC_ prefixed), or neither ' +
    '(the app then runs local-only).',
  )
  process.exit(1)
}

if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
  console.warn(`[check-env] warning: Supabase URL looks unusual: ${url}`)
}

console.log(url ? '[check-env] Supabase configured — backend enabled.' : '[check-env] No Supabase config — building local-only app.')
