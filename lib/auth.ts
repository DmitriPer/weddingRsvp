import 'server-only'

/**
 * Admin session verification — lock #2 of the two on /admin (PRD §7.4).
 *
 * Uses getUser(), NEVER getSession(). A cookie is controlled by whoever sends
 * the request; getSession() is not guaranteed to revalidate the token, while
 * getUser() verifies it against the auth server.
 *
 * Every admin API route calls this itself, even though proxy.ts already gated
 * the page — API routes are separate URLs reachable by curl without ever
 * loading a page.
 */

import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user ?? null
}

/**
 * There is exactly one account, created by scripts/create-admin.ts (PRD §6.18).
 * Any authenticated user is therefore the admin — no role check needed, and no
 * signup route exists that could create a second one.
 */
export async function verifyAdmin(): Promise<User | null> {
  return getCurrentUser()
}
