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
import { invitationImageForLanguage } from '@/lib/invitation-image'
import { buildAbsoluteUrl } from '@/lib/links'
import { OG_CARD_HEIGHT, OG_CARD_PATHS, OG_CARD_WIDTH, OG_COUPLE_NAMES } from '@/lib/og'
import { venueForDisplay, venueForNavigation } from '@/lib/venue'
import { guestText, localeFor } from '@/lib/strings'
import { hasAnswered } from '@/lib/status'
import { LANGUAGES, type Language } from '@/lib/types'
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
 * IT NEVER READS THE TOKEN, AND THAT IS THE POINT. This runs on the crawler's
 * fetch. Resolving the token here would put a database lookup on the one path
 * that must never touch an invite — every invite sent triggers two non-human
 * fetches, the page and the image, and a status write on either would flip the
 * whole list to `opened` the moment invitations went OUT, destroying the "who
 * hasn't looked yet" filter §6.10 depends on.
 *
 * It reads `?lang=` instead (PRD §6.7b). The card carries the artwork, so a
 * Russian household needs a Russian card — and the admin already knows each
 * invite's language when it builds the link, so carrying it in the URL answers
 * the crawler with NO LOOKUP AT ALL. A tampered value changes which picture is
 * shown and nothing else; the page itself still takes its language from the
 * database.
 *
 * The date and venue come from wedding_config, so they follow the settings tab
 * with no redeploy. The names are the Latin form in lib/og.ts, shared with the
 * card so the picture and the line beneath it cannot disagree. Identical for
 * every guest either way.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [{ lang }, config] = await Promise.all([searchParams, getConfig()])
  const language = parseLangParam(lang)
  const t = guestText(language)

  // The Latin form, so the bold line WhatsApp prints matches the card above it.
  const title = OG_COUPLE_NAMES.trim() || config.couple_names.trim() || t.og.untitled
  const description = t.og.details(
    formatDateTime(config.wedding_date_time, localeFor(language)),
    venueForDisplay(config, language).trim()
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
      locale: language === 'he' ? 'he_IL' : 'ru_RU',
      siteName: t.siteName,
      title,
      description: description || undefined,
      // No token: a card shared onward must not carry someone's invite link.
      url,
      images: [
        {
          // Absolute. A relative path is not fetched by a crawler, which has no
          // page context to resolve it against.
          url: buildAbsoluteUrl(OG_CARD_PATHS[language]),
          width: OG_CARD_WIDTH,
          height: OG_CARD_HEIGHT,
          alt: t.og.imageAlt,
        },
      ],
    },

    twitter: { card: 'summary_large_image' },
  }
}

// Next 16: searchParams is a Promise and must be awaited.
type PageProps = { searchParams: Promise<{ token?: string; lang?: string }> }

/**
 * `?lang=` is untrusted input from a URL anyone can edit, so anything that is
 * not a language we support becomes Hebrew rather than an error. It only ever
 * selects a preview card.
 */
function parseLangParam(value: string | undefined): Language {
  return LANGUAGES.includes(value as Language) ? (value as Language) : 'he'
}

export default async function GuestPage({ searchParams }: PageProps) {
  const [{ token }, config] = await Promise.all([searchParams, getConfig()])
  const invite = token ? await getInviteByToken(token) : null

  // The DATABASE decides the page's language, not the URL. `?lang=` exists only
  // so the crawler can be answered without a lookup (see generateMetadata); a
  // guest who edits it still sees their own household's language.
  const language: Language = invite?.language ?? 'he'
  const when = formatDateTime(config.wedding_date_time, localeFor(language))

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
        lang={language}
        backdropImage={invitationImageForLanguage(config, language)}
        bar={
          <ActionBar
            lang={language}
            venue={venueForNavigation(config)}
            hasDate={Boolean(config.wedding_date_time)}
          />
        }
      />
    )
  }

  return (
    <>
      {/* Client-side only, and never from the OG image route (PRD §6.15). */}
      <MarkOpened inviteId={invite.id} skip={hasAnswered(invite.status)} />

      {/* Brings its own shell: the greeting and action bar are part of it. */}
      <RsvpScreen
        lang={language}
        backdropImage={invitationImageForLanguage(config, language)}
        token={invite.token}
        inviteName={invite.name}
        attendees={invite.attendees}
        attending={invite.attending}
        when={when}
        venue={venueForDisplay(config, language)}
        venueForNav={venueForNavigation(config)}
        phone={config.contact_phone}
        hasDate={Boolean(config.wedding_date_time)}
        rsvpOpen={isRsvpOpen(config.rsvp_deadline)}
      />
    </>
  )
}
