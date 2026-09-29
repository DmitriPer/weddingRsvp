'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { strings } from '@/lib/strings'
import { Spinner } from '@/components/ui/spinner'

export function SignOutButton(): React.JSX.Element {
  // Local state rather than useAction: success is a full page load, so the
  // busy state should simply last until the document is replaced.
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut(): Promise<void> {
    setSigningOut(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      // Still signed in: say so and give the button back.
      toast.error(strings.app.error)
      setSigningOut(false)
      return
    }

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
      aria-busy={signingOut}
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-60"
    >
      {signingOut ? <Spinner /> : null}
      {strings.auth.signOut}
    </button>
  )
}
