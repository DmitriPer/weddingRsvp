import { createClient } from '@supabase/supabase-js'
import { isMockMode } from '@/lib/mock/config'
import { createMockAdminClient } from '@/lib/mock/query-builder'

// Service role client — bypasses RLS. NEVER import in client components.
export function createAdminClient() {
  if (isMockMode) return createMockAdminClient() as unknown as ReturnType<typeof createClient>

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
