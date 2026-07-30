/**
 * THE headcount formula (PRD §5.1). This file is the single source of truth.
 *
 * Do not reimplement this anywhere — not in a component, not in a route, not in
 * an export. A second copy is how the "no stored counts" guarantee dies quietly.
 *
 * There is no `attending` flag to check here: declining sets every person's
 * is_attending to false and deletes placeholders (PRD §6.1), so a declined
 * invite counts to zero naturally rather than by special case.
 */

import type { Attendee, Headcount } from '@/lib/types'

export function countAttending(attendees: Attendee[]): Headcount {
  let adults = 0
  let kids = 0

  for (const person of attendees) {
    if (!person.is_attending) continue
    if (person.is_child) kids++
    else adults++
  }

  return { adults, kids, total: adults + kids }
}

export function sumHeadcounts(counts: Headcount[]): Headcount {
  return counts.reduce<Headcount>(
    (total, one) => ({
      adults: total.adults + one.adults,
      kids: total.kids + one.kids,
      total: total.total + one.total,
    }),
    { adults: 0, kids: 0, total: 0 }
  )
}

export function isSeated(person: Attendee): boolean {
  return person.table_id !== null
}

/** Only attending people take a seat. Declined people free theirs (PRD §6.17). */
export function seatableAttendees(attendees: Attendee[]): Attendee[] {
  return attendees.filter((person) => person.is_attending)
}
