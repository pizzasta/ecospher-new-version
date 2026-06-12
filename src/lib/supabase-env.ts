// Reads VITE_-prefixed vars (the project's own convention) with fallbacks to
// the NEXT_PUBLIC_-prefixed names that the Vercel × Supabase Native
// Integration injects, so the integration works with zero manual env setup.
// vite.config.ts exposes both prefixes to the client bundle; both are
// public-by-design values (URL + anon/publishable key) — security comes
// from RLS, not key secrecy.

const env = import.meta.env

const supabaseUrl: string | undefined =
  env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL

const supabaseAnonKey: string | undefined =
  env.VITE_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabaseEnv = {
  url: supabaseUrl ?? '',
  anonKey: supabaseAnonKey ?? '',
  buckets: {
    signalAudio: env.VITE_SUPABASE_SIGNAL_AUDIO_BUCKET ?? 'signal-audio',
    capsuleAudio: env.VITE_SUPABASE_CAPSULE_AUDIO_BUCKET ?? 'capsule-audio',
    profileCores: env.VITE_SUPABASE_PROFILE_CORES_BUCKET ?? 'profile-cores',
  },
} as const
