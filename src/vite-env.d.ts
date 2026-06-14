/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_SIGNAL_AUDIO_BUCKET?: string
  readonly VITE_SUPABASE_CAPSULE_AUDIO_BUCKET?: string
  readonly VITE_SUPABASE_PROFILE_CORES_BUCKET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// injected by vite's `define` at build time — a human-readable build stamp
declare const __BUILD_STAMP__: string
