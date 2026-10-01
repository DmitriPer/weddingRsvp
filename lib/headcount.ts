/**
 * THE headcount formula (PRD §5.1). This file is the single source of truth.
 *
 * Do not reimplement this anywhere — not in a component, not in a route, not in
 * an export. A second copy is how the "no stored counts" guarantee dies quietly.
 *
 * Declining needs no special case: it sets every person's is_attending to false
 * and deletes placeholders (PRD §6.1), so a declined invite counts to zero
 * naturally.
 *
 * An UNANSWERED invitation does need one — see countAttendingAnswered. A tick
 * can exist without an answer, and then it must not count.
 */

import type { Answer, Attendee, Headcount } from '@/lib/types'

export function countAttending(attendees: Attendee[]): Headcount {
  let adults = 0
  let kids = 0
  let infants = 0

  for (const person of attendees) {
    if (!person.is_attending) continue
    if (!person.is_child) adults++
    else {
      kids++
      // An infant is still a child (kids); `infants` is the 0–3 subset the
      // budget prices at zero (docs/child-age-pricing-PRD.md).
      if (person.is_infant) infants++
    }
  }

  return { adults, kids, infants, total: adults + kids }
}

/**
 * The headcount an INVITATION contributes — zero unless it answered 'yes'.
 *
 * Use this for any total. `countAttending` above counts ticks, and a tick is
 * only meaningful as part of an answer: `is_attending` is written by applyTicks
 * during a submission, so a tick on an unanswered invitation is the residue of
 * a submission that did not finish. One such row existed — a household that
 * opened its link, never saved an answer, and was still counted as coming,
 * putting the dashboard one person above the list of everyone who had actually
 * replied. The caterer's number must come from answers, not from flags that can
 * outlive them.
 */
export function countAttendingAnswered(answer: Answer | null, attendees: Attendee[]): Headcount {
  return answer === 'yes' ? countAttending(attendees) : { adults: 0, kids: 0, infants: 0, total: 0 }
}

/**
 * What a SINGLE PERSON answered (migration 021). `null` = not answered yet.
 *
 * Stored per person since 2026-10-01, because one household can hold all three
 * answers after a phone call: mom coming, dad a maybe. Before that it was
 * derived from the household's answer and the tick, and the migration backfilled
 * it by that same rule, so older households read exactly as they did.
 *
 * A person's answer is not the household's: נטלי answered yes for three people
 * and unticked one, and reading the household's answer for each of them is how
 * a removed name once reached a seating list.
 */
export function answerForPerson(person: Attendee): Answer | null {
  return person.answer ?? null
}

/**
 * The household's answer, calculated from its people after an admin changes one
 * (docs/admin-answer-and-calls-PRD.md §5). Anyone coming makes the household a
 * yes; else anyone unsure makes it undecided; else anyone declining makes it a
 * no. People still unset count neither way. `null` when nobody has answered.
 */
export function householdAnswer(attendees: Attendee[]): Answer | null {
  const answers = new Set(attendees.map(answerForPerson))
  if (answers.has('yes')) return 'yes'
  if (answers.has('undecided')) return 'undecided'
  if (answers.has('no')) return 'no'
  return null
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
  | { kind: 'undecided'; invited: number }
  | { kind: 'declined'; invited: number }
  | { kind: 'coming'; coming: number; invited: number; undecided: number }

export function summarizeAttendance(
  answer: Answer | null,
  attendees: Attendee[]
): AttendanceSummary {
  const invited = attendees.length
  if (invited === 0) return { kind: 'noPeople' }
  if (answer === null) return { kind: 'awaiting', invited }
  if (answer === 'undecided') return { kind: 'undecided', invited }
  if (answer === 'no') return { kind: 'declined', invited }
  return {
    kind: 'coming',
    coming: countAttending(attendees).total,
    invited,
    // A household that is a yes overall can still hold a maybe (migration 021).
    undecided: countUndecided(attendees),
  }
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
 * Every person row on an invitation, guest-added "+1"s included — what a
 * delete actually removes (docs/small-fixes-PRD.md §2). Not a headcount of
 * anyone coming; it exists so the bulk-delete confirmation can't understate a
 * cascade by leaving the +1s out, as countInvited() does by design.
 */
export function countPeopleRows(attendees: Attendee[]): number {
  return attendees.length
}

/**
 * People who answered no, by their own answer. Placeholders are excluded: an
 * unnamed "+1" is somebody coming, and a household's no deletes them.
 */
export function countDeclined(attendees: Attendee[]): number {
  return attendees.filter((person) => answerForPerson(person) === 'no' && !person.is_placeholder)
    .length
}

/**
 * People whose answer is still unknown. Per person: after a phone call one
 * person can be answered while the rest of the household is not.
 *
 * This is the number that says how much the caterer count could still move.
 */
export function countAwaiting(attendees: Attendee[]): number {
  return attendees.filter((person) => answerForPerson(person) === null).length
}

/**
 * People who answered 'undecided'.
 *
 * Counted apart from `countAwaiting` rather than added to it. Both are people
 * whose seat is unsettled, but they are reached differently — one has never
 * answered, the other has and needs a nudge — and a single number that quietly
 * means both is the kind that gets acted on wrongly.
 */
export function countUndecided(attendees: Attendee[]): number {
  return attendees.filter((person) => answerForPerson(person) === 'undecided').length
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
      infants: total.infants + one.infants,
      total: total.total + one.total,
    }),
    { adults: 0, kids: 0, infants: 0, total: 0 }
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
