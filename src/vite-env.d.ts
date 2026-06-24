/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_SIGNAL_AUDIO_BUCKET?: string
  readonly VITE_SUPABASE_CAPSULE_AUDIO_BUCKET?: string
  readonly VITE_SUPABASE_PROFILE_CORES_BUCKET?: string
  readonly VITE_BUILD_STAMP: string
  readonly VITE_SW_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
