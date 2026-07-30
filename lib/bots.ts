/**
 * Crawler detection — a BACKSTOP, never the primary defence (PRD §6.15).
 *
 * The real mechanism for marking an invite "opened" is a client-side call that
 * only runs in a browser: crawlers fetch HTML but do not execute JavaScript.
 * User-Agent sniffing is a heuristic, trivially spoofed, and incomplete.
 *
 * Why it matters at all: sending one invite triggers two non-human fetches —
 * the page's meta tags and the generated OG image. If those marked invites as
 * "opened", every invite would flip the moment it was sent, destroying the
 * "who hasn't looked yet" filter the whole follow-up workflow depends on.
 */

const CRAWLER_PATTERNS: readonly RegExp[] = [
  /WhatsApp/i,
  /facebookexternalhit/i,
  /Facebot/i,
  /Twitterbot/i,
  /TelegramBot/i,
  /Slackbot/i,
  /LinkedInBot/i,
  /Discordbot/i,
  /SkypeUriPreview/i,
  /Googlebot/i,
  /bingbot/i,
  /redditbot/i,
  /Applebot/i,
  /vkShare/i,
  /^curl\//i,
  /^Wget\//i,
  /python-requests/i,
  /HeadlessChrome/i,
]

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true // no UA at all is not a real browser
  return CRAWLER_PATTERNS.some((pattern) => pattern.test(userAgent))
}
