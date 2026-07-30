/**
 * Dashboard totals (PRD §6.11). Pure — invites in, numbers out.
 *
 * Headcounts come from lib/headcount.ts. This file does not count people itself.
 */

import { countAttending, countDeclined, countInvited, sumHeadcounts } from '@/lib/headcount'
import { INVITE_STATUSES, type InviteStatus, type InviteWithPeople, type Stats } from '@/lib/types'

function emptyStatusCounts(): Record<InviteStatus, number> {
  return INVITE_STATUSES.reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<InviteStatus, number>
  )
}

export function computeStats(invites: InviteWithPeople[]): Stats {
  const byStatus = emptyStatusCounts()
  let declinedInvites = 0
  let totalUnanswered = 0
  let totalInvitedPeople = 0
  let totalDeclinedPeople = 0

  for (const invite of invites) {
    byStatus[invite.status] += 1
    if (invite.attending === false) declinedInvites += 1
    if (invite.attending === null) totalUnanswered += 1

    // People, not rows. A household of two counts as two — which is the whole
    // point of a headcount, and what the caterer is quoted on.
    totalInvitedPeople += countInvited(invite.attendees)
    totalDeclinedPeople += countDeclined(invite.attending, invite.attendees)
  }

  const headcount = sumHeadcounts(invites.map((invite) => countAttending(invite.attendees)))

  return {
    byStatus,
    totalInvites: invites.length,
    totalInvitedPeople,
    totalAdults: headcount.adults,
    totalKids: headcount.kids,
    totalAttending: headcount.total,
    totalDeclined: declinedInvites,
    totalDeclinedPeople,
    totalUnanswered,
  }
}
