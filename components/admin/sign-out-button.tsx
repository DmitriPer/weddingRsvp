'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { strings } from '@/lib/strings'

export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()

    /*
     * A full page load, for the same reason signing IN uses one — and one more
     * besides. router.push() leaves Next's client router cache intact, so
     * already-fetched admin pages can still be rendered from memory after the
     * session is gone. assign() throws that away with the document.
     */
    window.location.assign('/admin/login')
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
