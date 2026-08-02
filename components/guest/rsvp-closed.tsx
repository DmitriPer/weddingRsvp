/**
 * Past the deadline (PRD §6.3). The stored answer, read-only, plus the number
 * to call instead.
 *
 * This is the UI half only. POST /api/rsvp already rejects late submissions
 * with 410 — a disabled form is bypassed with one curl, and the whole point of
 * the deadline is that numbers cannot move after the caterer is committed to.
 */

import { guestText } from '@/lib/strings'
import { Confirmation } from '@/components/guest/confirmation'
import { WeddingDetails } from '@/components/guest/wedding-details'
import type { Attendee, Language } from '@/lib/types'

interface RsvpClosedProps {
  lang: Language
  /** null = never answered, and now never will through the form. */
  attending: boolean | null
  attendees: Attendee[]
  when: string
  venue: string
  phone: string
}

export function RsvpClosed({ lang, attending, attendees, when, venue, phone }: RsvpClosedProps) {
  const t = guestText(lang)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-bloom-ink/25 px-4 py-3 text-center">
        <p className="font-semibold text-bloom-strong">{t.rsvp.closed.title}</p>
        {phone ? (
          <p className="mt-1 text-sm text-bloom-ink">
            {t.rsvp.closed.callInstead}{' '}
            <a href={`tel:${phone}`} className="ltr-nums inline-block underline">
              {phone}
            </a>
          </p>
        ) : (
          <p className="mt-1 text-sm text-bloom-ink">{t.rsvp.closed.callInsteadNoPhone}</p>
        )}
      </div>

      {attending === null ? (
        <section className="space-y-6 text-center">
          <p className="text-sm text-bloom-ink">{t.rsvp.closed.yourAnswer}</p>
          <p>{t.rsvp.closed.noAnswer}</p>
          <WeddingDetails when={when} venue={venue} />
        </section>
      ) : (
        // No onChangeAnswer: there is nothing to change any more.
        <Confirmation lang={lang} attending={attending} attendees={attendees} when={when} venue={venue} />
      )}
    </div>
  )
}
