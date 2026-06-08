import { getSupabaseClient } from './supabase'
import type { Database } from './database.types'

type TableName = keyof Database['public']['Tables']

export function getDatabaseClient() {
  return getSupabaseClient()
}

export function fromTable(table: TableName) {
  return getDatabaseClient().from(table)
}
