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

/**
 * Thrown when the build carried no Supabase credentials. Named so the caller
 * can tell "this deployment is misconfigured" from "that password was wrong".
 */
export class SupabaseConfigError extends Error {}

export function createBrowserSupabaseClient(): SupabaseClient {
  /*
   * Read as STATIC member expressions, never process.env[name]. Next replaces
   * `process.env.NEXT_PUBLIC_FOO` with its value at build time by literal text
   * substitution; a dynamic lookup is not substituted, so it would be undefined
   * in the browser however well the variable is configured.
   *
   * Which also means: these values are frozen into the JavaScript when the
   * build runs. Adding them to a hosting dashboard afterwards changes nothing
   * until a NEW BUILD runs. That is the single most likely reason this throws.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // These were `!` assertions, which promised a value rather than checking for
  // one: with either missing, createBrowserClient threw from inside the library
  // before any request was made, so signing in looked like a dead button.
  if (!url || !key) {
    throw new SupabaseConfigError(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Set both in the hosting environment and REDEPLOY — they are compiled in at build time.'
    )
  }

  return createBrowserClient(url, key)
}
