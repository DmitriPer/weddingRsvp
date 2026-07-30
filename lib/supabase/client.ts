/**
 * Publishable-key client for the browser.
 *
 * LEGAL USE: Client Components, for auth actions only — signing in and out.
 * NEVER: data mutations. RLS denies this key everything (PRD §7.2), so any
 * data call made here returns nothing and the failure is silent and confusing.
 *
 * This key is designed to ship to browsers. That is safe precisely because RLS
 * makes it powerless.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
