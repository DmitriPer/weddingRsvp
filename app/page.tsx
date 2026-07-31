/**
 * The guest's page (PRD §6.1–§6.4). The site root does double duty: a public
 * landing page, and — with `?token=` — one guest's own invitation.
 *
 * The token IS the credential (PRD §7.1); there is no guest login. So this page
 * branches and nothing more. Every rule it appears to apply lives elsewhere:
 * the deadline in lib/datetime, the headcount in lib/headcount, the copy in
 * lib/strings, and the token lookup's UUID guard inside lib/data.
 */

import type { Metadata } from 'next'
import { getConfig, getInviteByToken } from '@/lib/data'
import { formatDateTime, isRsvpOpen } from '@/lib/datetime'
import { buildAbsoluteUrl } from '@/lib/links'
import { OG_CARD_HEIGHT, OG_CARD_PATH, OG_CARD_WIDTH, OG_COUPLE_NAMES } from '@/lib/og'
import { strings } from '@/lib/strings'
import { hasAnswered } from '@/lib/status'
import { ActionBar } from '@/components/guest/action-bar'
import { GuestShell } from '@/components/guest/guest-shell'
import { MarkOpened } from '@/components/guest/mark-opened'
import { RsvpScreen } from '@/components/guest/rsvp-screen'

// Per-token and answer-dependent: caching it would serve one guest's page to
// another, and show stale answers after a submission.
export const dynamic = 'force-dynamic'

/**
 * The WhatsApp link preview (PRD §6.15).
 *
 * `wa.me` prefills text only — click-to-chat supports no media parameter — so
 * these tags are the ONLY way an invitation shows a picture in the chat. The
 * card is the invitation artwork; the words beneath it in the bubble are the
 * admin's own message template, which is why nothing here is written onto the
 * image.
 *
 * IT TAKES NO ARGUMENTS, AND THAT IS THE POINT. This runs on the crawler's
 * fetch. Reading the token here would put a database lookup on the one path
 * that must never touch an invite — every invite sent triggers two non-human
 * fetches, the page and the image, and a status write on either would flip the
 * whole list to `opened` the moment invitations went OUT, destroying the "who
 * hasn't looked yet" filter §6.10 depends on. Taking no token makes that
 * impossible rather than merely avoided.
 *
 * The date and venue come from wedding_config, so they follow the settings tab
 * with no redeploy. The names are the Latin form in lib/og.ts, shared with the
 * card so the picture and the line beneath it cannot disagree. Identical for
 * every guest either way.
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig()

  // The Latin form, so the bold line WhatsApp prints matches the card above it.
  const title = OG_COUPLE_NAMES.trim() || config.couple_names.trim() || strings.og.untitled
  const description = strings.og.details(
    formatDateTime(config.wedding_date_time),
    config.venue_name.trim()
  )
  const url = buildAbsoluteUrl('/')

  return {
    metadataBase: new URL(url),
    title,
    description: description || undefined,

    // The invite URL carries the token, and the token IS the credential
    // (PRD §7.1) — it must not end up in a search index. Crawlers that build
    // preview cards ignore this, so the WhatsApp card is unaffected.
    robots: { index: false, follow: false },

    openGraph: {
      type: 'website',
      locale: 'he_IL',
      siteName: strings.app.title,
      title,
      description: description || undefined,
      // No token: a card shared onward must not carry someone's invite link.
      url,
      images: [
        {
          // Absolute. A relative path is not fetched by a crawler, which has no
          // page context to resolve it against.
          url: buildAbsoluteUrl(OG_CARD_PATH),
          width: OG_CARD_WIDTH,
          height: OG_CARD_HEIGHT,
          alt: strings.og.imageAlt,
        },
      ],
    },

    twitter: { card: 'summary_large_image' },
  }
}

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
