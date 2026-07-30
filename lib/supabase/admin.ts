import 'server-only'

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * LEGAL USE: API routes doing data work, and server-side scripts.
 * NEVER: any component, any client-rendered code, anything reachable from the
 * browser. The `server-only` import above turns a mistake into a build error
 * rather than a leaked key.
 *
 * All tables are RLS deny-all (PRD §7.2), so this is the only client that can
 * read or write project data at all.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
