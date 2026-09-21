import { OG_CARD_VERSION } from '@/lib/og-card-version'
import type { Language } from '@/lib/types'

/**
 * THE invite URL builder.
 *
 * NEXT_PUBLIC_SITE_URL must be the deployed origin before real invitations go
 * out — left on localhost, every link sent is dead, and you only find out from
 * a guest.
 */

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return 'http://localhost:3030'
  return configured.replace(/\/+$/, '') // tolerate a trailing slash
}

/**
 * The guest's personal link. The token is the credential (PRD §7.1).
 *
 * `&lang=` is appended for Russian, and it exists for ONE reason: the title and
 * description WhatsApp prints beneath the preview follow the household's
 * language, but `generateMetadata` must not look up the invite to find it. Every
 * invite sent triggers two crawler fetches, and putting that lookup on the path
 * is what the no-arguments rule in app/page.tsx exists to prevent.
 *
 * The admin already knows each invite's language when it builds this link, so
 * carrying it in the URL lets the crawler be answered with no lookup at all.
 *
 * It does NOT pick the picture: one card serves every household, since nothing
 * painted on it is in any language. It is only ever a hint for the words. The
 * PAGE takes its language from the database, which is authoritative — so a
 * tampered `lang` changes the preview's wording and nothing else.
 *
 * Hebrew is the default and omits it, keeping the common link short.
 *
 * `&c=` IS THE CARD'S VERSION, and it is the only thing that makes a changed
 * preview reach a link that has already been shared.
 *
 * WhatsApp caches a link's preview — title, description and image address
 * together — against the page URL, and never re-reads that page. So the `?v=`
 * on the image cannot help: WhatsApp never fetches the page to discover the new
 * image URL. The card can be rebuilt, deployed and confirmed correct by every
 * other tool, and the chat still shows the old picture, with no way to clear it.
 *
 * Carrying the card's hash in the invite link makes every link change when the
 * card changes, so there is no cached preview to serve and WhatsApp must fetch
 * afresh. The page ignores `c` entirely — it is read by nothing.
 */
export function buildInviteLink(token: string, language: Language = 'he'): string {
  const base = `${siteOrigin()}/?token=${encodeURIComponent(token)}`
  const withLanguage = language === 'he' ? base : `${base}&lang=${language}`
  return `${withLanguage}&c=${OG_CARD_VERSION.slice(0, 8)}`
}

/** Absolute URL for OpenGraph images — relative paths are not fetched by crawlers. */
export function buildAbsoluteUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${siteOrigin()}${suffix}`
}

/**
 * Opens WhatsApp with the message pre-filled. It does not send — a human taps
 * send inside WhatsApp (PRD §3.1). Phone numbers are used as-is; no formatting
 * or country-code logic is applied on purpose (PRD §6.9).
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Navigation to the venue, searched by name and address.
 *
 * `waze.com/ul` rather than the `waze://` scheme: the https form opens the app
 * when it is installed and falls back to the web map when it isn't, so it never
 * dead-ends on a desktop or a phone without Waze.
 *
 * Returns null when there is no venue to search for, which is how the action bar
 * knows not to render a button that would go nowhere.
 */
export function buildNavigationLink(venue: string): string | null {
  const query = venue.trim()
  if (!query) return null
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}
