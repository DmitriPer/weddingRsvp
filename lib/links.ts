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

/** The guest's personal link. The token is the credential (PRD §7.1). */
export function buildInviteLink(token: string): string {
  return `${siteOrigin()}/?token=${encodeURIComponent(token)}`
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
