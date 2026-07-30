/**
 * Dashboard totals (PRD §6.11). Pure — invites in, numbers out.
 *
 * Headcounts come from lib/headcount.ts. This file does not count people itself.
 */

import { countAttending, sumHeadcounts } from '@/lib/headcount'
import { INVITE_STATUSES, type InviteStatus, type InviteWithPeople, type Stats } from '@/lib/types'

function emptyStatusCounts(): Record<InviteStatus, number> {
  return INVITE_STATUSES.reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<InviteStatus, number>
  )
}

export function computeStats(invites: InviteWithPeople[]): Stats {
  const byStatus = emptyStatusCounts()
  let totalDeclined = 0
  let totalUnanswered = 0

  for (const invite of invites) {
    byStatus[invite.status] += 1
    if (invite.attending === false) totalDeclined += 1
    if (invite.attending === null) totalUnanswered += 1
  }

  const headcount = sumHeadcounts(invites.map((invite) => countAttending(invite.attendees)))

  return {
    byStatus,
    totalInvites: invites.length,
    totalAdults: headcount.adults,
    totalKids: headcount.kids,
    totalAttending: headcount.total,
    totalDeclined,
    totalUnanswered,
  }
}
