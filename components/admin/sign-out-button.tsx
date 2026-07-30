'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { strings } from '@/lib/strings'

export function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    // refresh() so proxy.ts sees the cleared cookie and starts redirecting again.
    router.refresh()
    router.push('/admin/login')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="text-sm text-muted hover:text-foreground disabled:opacity-60"
    >
      {strings.auth.signOut}
    </button>
  )
}
