const requiredEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
}

export const isSupabaseConfigured = Boolean(requiredEnv.supabaseUrl && requiredEnv.supabaseAnonKey)

export const supabaseEnv = {
  url: requiredEnv.supabaseUrl ?? '',
  anonKey: requiredEnv.supabaseAnonKey ?? '',
  buckets: {
    signalAudio: import.meta.env.VITE_SUPABASE_SIGNAL_AUDIO_BUCKET ?? 'signal-audio',
    capsuleAudio: import.meta.env.VITE_SUPABASE_CAPSULE_AUDIO_BUCKET ?? 'capsule-audio',
    profileCores: import.meta.env.VITE_SUPABASE_PROFILE_CORES_BUCKET ?? 'profile-cores',
  },
} as const
