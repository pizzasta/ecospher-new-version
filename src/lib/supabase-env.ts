const requiredEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
}

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your .env.local file.`)
  }

  return value
}

export const supabaseEnv = {
  url: requireEnv(requiredEnv.supabaseUrl, 'VITE_SUPABASE_URL'),
  anonKey: requireEnv(requiredEnv.supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY'),
  buckets: {
    signalAudio: import.meta.env.VITE_SUPABASE_SIGNAL_AUDIO_BUCKET ?? 'signal-audio',
    capsuleAudio: import.meta.env.VITE_SUPABASE_CAPSULE_AUDIO_BUCKET ?? 'capsule-audio',
    profileCores: import.meta.env.VITE_SUPABASE_PROFILE_CORES_BUCKET ?? 'profile-cores',
  },
} as const
