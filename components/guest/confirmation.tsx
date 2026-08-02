/**
 * What was saved (PRD §6.2). Without this a guest cannot tell the submission
 * worked, which is the single most common reason they re-open the link.
 *
 * Counts come from countAttending() rather than props, so the numbers can never
 * drift from the list rendered beside them.
 */

import { guestText } from '@/lib/strings'
import { attendingPeople, countAttending } from '@/lib/headcount'
import { WeddingDetails } from '@/components/guest/wedding-details'
import type { Attendee, Language } from '@/lib/types'

interface ConfirmationProps {
  lang: Language
  attending: boolean
  attendees: Attendee[]
  when: string
  venue: string
  /** Omitted past the deadline, where nothing can be changed (PRD §6.3). */
  onChangeAnswer?: () => void
}

export function Confirmation({
  lang,
  attending,
  attendees,
  when,
  venue,
  onChangeAnswer,
}: ConfirmationProps) {
  const t = guestText(lang)

  const coming = attendingPeople(attendees)
  const { adults, kids, total } = countAttending(attendees)
  const breakdown = t.rsvp.confirmation.breakdown(adults, kids)

  return (
    <section className="space-y-6 text-center">
      <h1 className="text-2xl text-bloom-display">
        {attending
          ? t.rsvp.confirmation.titleAttending
          : t.rsvp.confirmation.titleDeclined}
      </h1>

      {attending ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-bloom-strong">
            {coming.map((person) => (
              <li key={person.id}>
                {person.is_placeholder ? t.rsvp.confirmation.extraGuest : person.name}
              </li>
            ))}
          </ul>
          {/* The headcount is set off by an edge and a white fill, not a tint —
              the same box the form's counters use. */}
          <div className="rounded-2xl border border-bloom-ink/25 bg-paper/60 px-4 py-3">
            <p className="text-lg font-semibold text-bloom-strong">
              {t.rsvp.confirmation.total(total)}
            </p>
            {breakdown ? <p className="text-sm text-bloom-strong/80">{breakdown}</p> : null}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-bloom-ink/25 bg-paper/60 px-4 py-3 text-bloom-strong">
          {t.rsvp.confirmation.declined}
        </p>
      )}

      <WeddingDetails when={when} venue={venue} />

      {onChangeAnswer ? (
        <button
          type="button"
          onClick={onChangeAnswer}
          className="rounded-xl border border-bloom-ink/30 px-5 py-2.5 text-sm text-bloom-ink active:bg-bloom-ink/10"
        >
          {t.rsvp.confirmation.changeAnswer}
        </button>
      ) : null}
    </section>
  )
}
