'use client'

/**
 * The frosted sheet that rises over the invitation.
 *
 * Frosted at 88% white, which is not a stylistic number: the sheet covers the
 * bottom florals — the most saturated part of the artwork — and at 88% the
 * form's text still measures 7.46:1 against the pink beneath it. See .frosted
 * in app/globals.css.
 *
 * Keyboard and focus handling is here rather than in each screen, so the form,
 * the confirmation and the closed notice all behave the same.
 */

import { useEffect, useRef } from 'react'
import { guestText } from '@/lib/strings'
import type { Language } from '@/lib/types'

interface RsvpSheetProps {
  lang: Language
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function RsvpSheet({ lang, open, onClose, children }: RsvpSheetProps) {
  const t = guestText(lang)

  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    // Move focus into the sheet, or a screen reader keeps reading the page
    // behind it. Restore it on close so the action bar is where they left it.
    const returnTo = document.activeElement as HTMLElement | null
    panel.current?.focus()

    // The page behind must not scroll while the sheet is up.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      returnTo?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-20 flex items-end">
      <button
        type="button"
        aria-label={t.rsvp.nav.closeSheet}
        onClick={onClose}
        className="absolute inset-0 bg-bloom-strong/20"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="frosted relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl p-5 shadow-2xl outline-none safe-bottom"
      >
        {/* The grab handle: the affordance that says this can be dismissed. */}
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-bloom-ink/30" />
        {children}
      </div>
    </div>
  )
}
