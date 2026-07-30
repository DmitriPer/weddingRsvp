/**
 * Lock #1 on /admin (PRD §7.4).
 *
 * Next 16: this file is `proxy.ts` and must export `proxy`, not `middleware`.
 *
 * This gates PAGES. It is not the only lock: every admin API route calls
 * verifyAdmin() itself, because API routes are separate URLs reachable by curl
 * without ever loading a page — and middleware-bypass CVEs are real and
 * recurring. Two independent locks turn a critical bug into a cosmetic one.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // getUser(), never getSession(): a cookie is controlled by whoever sends the
  // request, and only getUser() revalidates the token against the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Everything under /admin except the login page itself, which must stay
  // reachable without a session or nobody could ever sign in.
  matcher: ['/admin((?!/login).*)'],
}
