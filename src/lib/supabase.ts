import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseEnv } from './supabase-env'

let browserClient: SupabaseClient<Database> | null = null

export function getSupabaseClient() {
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

export const supabase = getSupabaseClient()
