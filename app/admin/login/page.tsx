'use client'

/**
 * The only way in. No signup, no password reset (PRD §6.18) — the single
 * account is created by `npm run create-admin`.
 *
 * proxy.ts excludes this path from its matcher; otherwise it would redirect
 * the login page to itself and nobody could ever sign in.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { strings } from '@/lib/strings'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // Deliberately vague: never reveal whether the address exists.
      setError(strings.auth.invalidCredentials)
      setSubmitting(false)
      return
    }

    // refresh() so the server re-reads the new session cookie before navigating.
    router.refresh()
    router.push('/admin')
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border p-6"
      >
        <h1 className="mb-6 text-xl font-semibold">{strings.auth.loginTitle}</h1>

        <label className="block text-sm" htmlFor="email">
          {strings.auth.email}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="ltr-nums mt-1 mb-4 w-full rounded-md border border-border px-3 py-2"
        />

        <label className="block text-sm" htmlFor="password">
          {strings.auth.password}
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 mb-4 w-full rounded-md border border-border px-3 py-2"
        />

        {error ? (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? strings.auth.signingIn : strings.auth.signIn}
        </button>
      </form>
    </main>
  )
}
