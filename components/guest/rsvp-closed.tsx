/**
 * Past the deadline (PRD §6.3). The stored answer, read-only, plus the number
 * to call instead.
 *
 * This is the UI half only. POST /api/rsvp already rejects late submissions
 * with 410 — a disabled form is bypassed with one curl, and the whole point of
 * the deadline is that numbers cannot move after the caterer is committed to.
 */

import { strings } from '@/lib/strings'
import { Confirmation } from '@/components/guest/confirmation'
import { WeddingDetails } from '@/components/guest/wedding-details'
import type { Attendee } from '@/lib/types'

interface RsvpClosedProps {
  /** null = never answered, and now never will through the form. */
  attending: boolean | null
  attendees: Attendee[]
  when: string
  venue: string
  phone: string
}

export function RsvpClosed({ attending, attendees, when, venue, phone }: RsvpClosedProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-bloom-ink/25 px-4 py-3 text-center">
        <p className="font-semibold text-bloom-strong">{strings.rsvp.closed.title}</p>
        {phone ? (
          <p className="mt-1 text-sm text-bloom-ink">
            {strings.rsvp.closed.callInstead}{' '}
            <a href={`tel:${phone}`} className="ltr-nums inline-block underline">
              {phone}
            </a>
          </p>
        ) : (
          <p className="mt-1 text-sm text-bloom-ink">{strings.rsvp.closed.callInsteadNoPhone}</p>
        )}
      </div>

      {attending === null ? (
        <section className="space-y-6 text-center">
          <p className="text-sm text-bloom-ink">{strings.rsvp.closed.yourAnswer}</p>
          <p>{strings.rsvp.closed.noAnswer}</p>
          <WeddingDetails when={when} venue={venue} />
        </section>
      ) : (
        // No onChangeAnswer: there is nothing to change any more.
        <Confirmation attending={attending} attendees={attendees} when={when} venue={venue} />
      )}
    </div>
  )
}
