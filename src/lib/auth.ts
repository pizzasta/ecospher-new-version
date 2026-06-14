import { getSupabaseClient } from './supabase'

export function getAuthClient() {
  return getSupabaseClient().auth
}

export async function getCurrentSession() {
  const { data, error } = await getAuthClient().getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function getCurrentUser() {
  const { data, error } = await getAuthClient().getUser()

  if (error) {
    throw error
  }

  return data.user
}
