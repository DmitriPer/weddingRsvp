/**
 * What was saved (PRD §6.2). Without this a guest cannot tell the submission
 * worked, which is the single most common reason they re-open the link.
 *
 * Counts come from countAttending() rather than props, so the numbers can never
 * drift from the list rendered beside them.
 */

import { strings } from '@/lib/strings'
import { attendingPeople, countAttending } from '@/lib/headcount'
import { WeddingDetails } from '@/components/guest/wedding-details'
import type { Attendee } from '@/lib/types'

interface ConfirmationProps {
  attending: boolean
  attendees: Attendee[]
  when: string
  venue: string
  /** Omitted past the deadline, where nothing can be changed (PRD §6.3). */
  onChangeAnswer?: () => void
}

export function Confirmation({
  attending,
  attendees,
  when,
  venue,
  onChangeAnswer,
}: ConfirmationProps) {
  const coming = attendingPeople(attendees)
  const { adults, kids, total } = countAttending(attendees)
  const breakdown = strings.rsvp.confirmation.breakdown(adults, kids)

  return (
    <section className="space-y-6 text-center">
      <h1 className="text-2xl text-bloom-display">
        {attending
          ? strings.rsvp.confirmation.titleAttending
          : strings.rsvp.confirmation.titleDeclined}
      </h1>

      {attending ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-bloom-strong">
            {coming.map((person) => (
              <li key={person.id}>
                {person.is_placeholder ? strings.rsvp.confirmation.extraGuest : person.name}
              </li>
            ))}
          </ul>
          {/* Butter behind the headcount: the palette's only tint that
              clears AA behind body text (6.04:1 with --bloom-strong). */}
          <div className="rounded-2xl bg-bloom-butter/70 px-4 py-3">
            <p className="text-lg font-semibold text-bloom-strong">
              {strings.rsvp.confirmation.total(total)}
            </p>
            {breakdown ? <p className="text-sm text-bloom-strong/80">{breakdown}</p> : null}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-bloom-blush/60 px-4 py-3 text-bloom-strong">
          {strings.rsvp.confirmation.declined}
        </p>
      )}

      <WeddingDetails when={when} venue={venue} />

      {onChangeAnswer ? (
        <button
          type="button"
          onClick={onChangeAnswer}
          className="rounded-xl border border-bloom-ink/30 px-5 py-2.5 text-sm text-bloom-ink active:bg-bloom-ink/10"
        >
          {strings.rsvp.confirmation.changeAnswer}
        </button>
      ) : null}
    </section>
  )
}
