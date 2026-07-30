/**
 * The guest's page (PRD §6.1–§6.4). The site root does double duty: a public
 * landing page, and — with `?token=` — one guest's own invitation.
 *
 * The token IS the credential (PRD §7.1); there is no guest login. So this page
 * branches and nothing more. Every rule it appears to apply lives elsewhere:
 * the deadline in lib/datetime, the headcount in lib/headcount, the copy in
 * lib/strings, and the token lookup's UUID guard inside lib/data.
 */

import { getConfig, getInviteByToken } from '@/lib/data'
import { formatDateTime, isRsvpOpen } from '@/lib/datetime'
import { hasAnswered } from '@/lib/status'
import { ActionBar } from '@/components/guest/action-bar'
import { GuestShell } from '@/components/guest/guest-shell'
import { MarkOpened } from '@/components/guest/mark-opened'
import { RsvpScreen } from '@/components/guest/rsvp-screen'

// Per-token and answer-dependent: caching it would serve one guest's page to
// another, and show stale answers after a submission.
export const dynamic = 'force-dynamic'

// Next 16: searchParams is a Promise and must be awaited.
type PageProps = { searchParams: Promise<{ token?: string }> }

export default async function GuestPage({ searchParams }: PageProps) {
  const [{ token }, config] = await Promise.all([searchParams, getConfig()])

  const when = formatDateTime(config.wedding_date_time)
  const invite = token ? await getInviteByToken(token) : null

  // No token, an unknown one, or a mangled one all land here identically — an
  // unresolvable link must reveal nothing, including that it was unresolvable
  // (PRD §6.4). getInviteByToken() already returns null rather than throwing on
  // a non-UUID, so a broken link is a landing page, not a 500.
  // The public landing page (PRD §6.4): the artwork and nothing over it. The
  // invitation already carries the couple's names, the date and the venue, and
  // a card laid on top lands squarely on that text. There is no guest data here
  // and no way to RSVP — and, crucially, it looks identical whether the token
  // was absent, unknown or malformed, so a wrong guess reveals nothing.
  if (!invite) {
    return (
      <GuestShell
        bar={<ActionBar venue={config.venue_name} hasDate={Boolean(config.wedding_date_time)} />}
      />
    )
  }

  return (
    <>
      {/* Client-side only, and never from the OG image route (PRD §6.15). */}
      <MarkOpened inviteId={invite.id} skip={hasAnswered(invite.status)} />

      {/* Brings its own shell: the greeting and action bar are part of it. */}
      <RsvpScreen
        token={invite.token}
        inviteName={invite.name}
        attendees={invite.attendees}
        attending={invite.attending}
        when={when}
        venue={config.venue_name}
        phone={config.contact_phone}
        hasDate={Boolean(config.wedding_date_time)}
        rsvpOpen={isRsvpOpen(config.rsvp_deadline)}
      />
    </>
  )
}
