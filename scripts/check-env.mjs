// Build-time env verification. The backend is optional by design (the app
// runs fully on localStorage/IndexedDB without it), so a completely empty
// config is fine — but a *partial* config is always a mistake and fails
// the build before it ships broken.

const url = process.env.VITE_SUPABASE_URL ?? ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

const forbidden = Object.keys(process.env).filter(
  key => /SERVICE_ROLE|SUPABASE_SECRET/i.test(key) && process.env[key],
)
if (forbidden.length > 0) {
  console.error(
    `[check-env] FATAL: ${forbidden.join(', ')} present at build time. ` +
    'Service-role keys must never be available to a client build.',
  )
  process.exit(1)
}

if (Boolean(url) !== Boolean(anonKey)) {
  console.error(
    '[check-env] FATAL: partial Supabase config — set both VITE_SUPABASE_URL ' +
    'and VITE_SUPABASE_ANON_KEY, or neither (the app then runs local-only).',
  )
  process.exit(1)
}

if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
  console.warn(`[check-env] warning: VITE_SUPABASE_URL looks unusual: ${url}`)
}

console.log(url ? '[check-env] Supabase configured — backend enabled.' : '[check-env] No Supabase config — building local-only app.')
