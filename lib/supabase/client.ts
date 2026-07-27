import { createBrowserClient } from '@supabase/ssr'
import { isMockMode } from '@/lib/mock/config'
import { MOCK_SESSION_COOKIE, encodeMockSession } from '@/lib/mock/auth'

export function createClient() {
  if (isMockMode) {
    return {
      auth: {
        signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
          if (!email || !password) {
            return { data: { user: null, session: null }, error: { message: 'Invalid credentials' } }
          }
          // Mock-only session cookie — not httpOnly since it's set client-side. Never used in real mode.
          document.cookie = `${MOCK_SESSION_COOKIE}=${encodeMockSession(email)}; path=/; max-age=604800`
          return { data: { user: { id: 'mock-admin-user', email }, session: {} }, error: null }
        },
        signOut: async () => {
          document.cookie = `${MOCK_SESSION_COOKIE}=; path=/; max-age=0`
          return { error: null }
        },
      },
    } as unknown as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
