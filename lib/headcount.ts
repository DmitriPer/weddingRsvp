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

/**
 * What a row should say about attendance.
 *
 * Showing only the attending count is misleading before anyone answers: a
 * freshly added invite with three people listed would read "0 guests", because
 * the admin adds people and the *guest* ticks them. So the answer state decides
 * which number is worth showing.
 *
 * Returns structure, not text — Hebrew lives in lib/strings.ts.
 */
export type AttendanceSummary =
  | { kind: 'noPeople' }
  | { kind: 'awaiting'; invited: number }
  | { kind: 'declined'; invited: number }
  | { kind: 'coming'; coming: number; invited: number }

export function summarizeAttendance(
  attending: boolean | null,
  attendees: Attendee[]
): AttendanceSummary {
  const invited = attendees.length
  if (invited === 0) return { kind: 'noPeople' }
  if (attending === null) return { kind: 'awaiting', invited }
  if (attending === false) return { kind: 'declined', invited }
  return { kind: 'coming', coming: countAttending(attendees).total, invited }
}

/**
 * Everyone listed on an invitation, answered or not — the "how many people did
 * we invite" number, as opposed to how many invitations were sent.
 *
 * Trivial on its own, and here anyway: counting people is this file's job, and
 * the alternative is a bare `.length` in a component that nobody recognises as
 * a headcount until it disagrees with one.
 */
export function countInvited(attendees: Attendee[]): number {
  // Placeholders excluded: a guest-added "+1" is somebody coming, not somebody
  // invited. They are counted separately by countExtras().
  return attendees.filter((person) => !person.is_placeholder).length
}

/**
 * People who answered no. Placeholders are excluded: an unnamed "+1" only
 * exists while it is coming, and declining deletes them outright.
 *
 * Nobody has declined until the invitation itself has answered — before that
 * `is_attending` is merely its `false` default, not a decision.
 */
export function countDeclined(attending: boolean | null, attendees: Attendee[]): number {
  if (attending === null) return 0
  return attendees.filter((person) => !person.is_attending && !person.is_placeholder).length
}

/**
 * People whose answer is still unknown — everyone on an invitation that has not
 * replied. Nobody on an ANSWERED invitation is awaiting: they are either coming
 * or they are not.
 *
 * This is the number that says how much the caterer count could still move.
 */
export function countAwaiting(attending: boolean | null, attendees: Attendee[]): number {
  return attending === null ? attendees.length : 0
}

/** Guest-added "+1"s among those coming — people who were never on the list. */
export function countExtras(attendees: Attendee[]): number {
  return attendees.filter((person) => person.is_attending && person.is_placeholder).length
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

/**
 * Everyone actually coming. The `is_attending` filter lives here and nowhere
 * else, for the same reason the arithmetic above does.
 */
export function attendingPeople(attendees: Attendee[]): Attendee[] {
  return attendees.filter((person) => person.is_attending)
}

/** Only attending people take a seat. Declined people free theirs (PRD §6.17). */
export function seatableAttendees(attendees: Attendee[]): Attendee[] {
  return attendingPeople(attendees)
}
