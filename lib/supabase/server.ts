import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isMockMode } from '@/lib/mock/config'
import { MOCK_SESSION_COOKIE, decodeMockSession } from '@/lib/mock/auth'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  if (isMockMode) {
    const user = decodeMockSession(cookieStore.get(MOCK_SESSION_COOKIE)?.value)
    return {
      auth: { getUser: async () => ({ data: { user }, error: null }) },
    } as unknown as ReturnType<typeof createServerClient>
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie setting is a no-op here
          }
        },
      },
    }
  )
}
