import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { isSupabaseConfigured, supabaseEnv } from './supabase-env'

let browserClient: SupabaseClient<Database> | null = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  }

  return browserClient
}

export function getOptionalSupabaseClient() {
  return isSupabaseConfigured ? getSupabaseClient() : null
}
