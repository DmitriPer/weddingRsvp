/**
 * The dashboard bar (PRD §6.11). Pure — invites in, numbers out.
 *
 * Counting is lib/headcount.ts's job; this file only groups and sums. A second
 * `.filter(...).length` here would be a second definition of "attending", and
 * the first thing to disagree with the caterer number.
 *
 * Every figure is produced in BOTH units — people and invitations — because
 * they answer different questions: people is what the caterer is quoted on,
 * invitations is how many messages are still owed.
 */

import {
  countAttendingAnswered,
  countAwaiting,
  countUndecided,
  countDeclined,
  countExtras,
  countInvited,
  sumHeadcounts,
} from '@/lib/headcount'
import { INVITE_STATUSES, type InviteStatus, type InviteWithPeople, type Stats } from '@/lib/types'

function emptyStatusCounts(): Record<InviteStatus, number> {
  return INVITE_STATUSES.reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<InviteStatus, number>
  )
}

export function computeStats(invites: InviteWithPeople[]): Stats {
  const byStatus = emptyStatusCounts()

  let totalInvitedPeople = 0
  let totalAwaitingPeople = 0
  let totalAwaitingInvites = 0
  let totalAttendingInvites = 0
  let totalUndecidedInvites = 0
  let totalUndecidedPeople = 0
  let totalDeclinedPeople = 0
  let totalDeclined = 0
  let totalExtras = 0

  for (const invite of invites) {
    byStatus[invite.status] += 1

    totalInvitedPeople += countInvited(invite.attendees)
    totalExtras += countExtras(invite.attendees)

    totalAwaitingPeople += countAwaiting(invite.answer, invite.attendees)
    if (invite.answer === null) totalAwaitingInvites += 1

    totalUndecidedPeople += countUndecided(invite.answer, invite.attendees)
    if (invite.answer === 'undecided') totalUndecidedInvites += 1

    if (invite.answer === 'yes') totalAttendingInvites += 1
    if (invite.answer === 'no') totalDeclined += 1

    totalDeclinedPeople += countDeclined(invite.answer, invite.attendees)
  }

  // Answered invitations only: a tick without an answer is not a seat.
  const headcount = sumHeadcounts(
    invites.map((invite) => countAttendingAnswered(invite.answer, invite.attendees))
  )

  return {
    byStatus,
    totalInvites: invites.length,
    totalInvitedPeople,

    totalAwaitingPeople,
    totalAwaitingInvites,

    totalAttending: headcount.total,
    totalAttendingInvites,

    totalUndecidedInvites,
    totalUndecidedPeople,

    totalDeclinedPeople,
    totalDeclined,

    totalAdults: headcount.adults,
    totalKids: headcount.kids,
    totalExtras,

    totalUnanswered: totalAwaitingInvites,
  }
}
