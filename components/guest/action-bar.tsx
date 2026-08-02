/**
 * The bottom action bar: RSVP, navigate to the venue, add to calendar.
 *
 * A button whose data is missing does not render. With `wedding_config` empty —
 * which it is today — only the RSVP button appears. That is correct behaviour:
 * a navigation button with no address to search opens an empty map, and a
 * calendar button with no date downloads a file every calendar app rejects
 * without saying why.
 */

import { guestText } from '@/lib/strings'
import type { Language } from '@/lib/types'
import { buildNavigationLink } from '@/lib/links'

interface ActionBarProps {
  lang: Language
  /** Label changes once they have answered — see rsvp-screen.tsx. */
  rsvpLabel?: string
  /** Absent on the public landing page, which has nothing to RSVP to. */
  onRsvp?: () => void
  venue: string
  /** False when no date is set; the calendar route 404s in that case anyway. */
  hasDate: boolean
}

export function ActionBar({ lang, rsvpLabel, onRsvp, venue, hasDate }: ActionBarProps) {
  const t = guestText(lang)

  const navigation = buildNavigationLink(venue)

  // Nothing to offer: render nothing rather than an empty frosted slab.
  if (!onRsvp && !navigation && !hasDate) return null

  // The bar's bottom gap is mb-[7px], not mb-3 — 5px lower than the default
  // 12px. Clearance above the iPhone home indicator is unaffected: that comes
  // from .safe-bottom on the shell, which is added separately.
  //
  // One row of three equal buttons, with NO card behind them — the buttons sit
  // straight on the artwork. Each therefore carries its own surface: the RSVP
  // button is solid, the other two are frosted, so both stay legible wherever
  // the artwork happens to be busy. A transparent button on watercolour is not
  // readable, which is why the frosting moved from the container to the parts.
  return (
    <nav className="mb-[7px] flex gap-2">
      {onRsvp ? (
        <button
          type="button"
          onClick={onRsvp}
          className="flex-1 rounded-xl bg-bloom-ink px-2 py-3 text-sm font-semibold text-paper shadow-sm active:bg-bloom-strong"
        >
          {rsvpLabel}
        </button>
      ) : null}

      {navigation ? (
        <SecondaryAction href={navigation} external>
          {t.rsvp.nav.navigate}
        </SecondaryAction>
      ) : null}

      {hasDate ? (
        <SecondaryAction href="/api/calendar">{t.rsvp.nav.addToCalendar}</SecondaryAction>
      ) : null}
    </nav>
  )
}

function SecondaryAction({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      // Waze opens in its own app or tab; the .ics downloads in place, and
      // target=_blank on a download leaves an empty tab behind on iOS.
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="frosted flex-1 rounded-xl border border-bloom-ink/30 px-2 py-3 text-center text-sm font-semibold text-bloom-ink shadow-sm active:bg-bloom-ink/10"
    >
      {children}
    </a>
  )
}
