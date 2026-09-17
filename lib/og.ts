import { OG_CARD_VERSION } from '@/lib/og-card-version'
import type { Language } from '@/lib/types'

/**
 * THE WhatsApp preview card's shape (PRD §6.15).
 *
 * Imported by both the page that advertises the card in its meta tags and the
 * script that builds it, so the declared dimensions cannot drift from the file's
 * real ones — a mismatch makes WhatsApp lay out the preview against numbers that
 * aren't true, and nothing in a build would catch it.
 *
 * 1200×630 is the landscape slot WhatsApp reserves for a large preview. The
 * invitation artwork is PORTRAIT, so it cannot fill this on its own: anything
 * left unfilled, WhatsApp crops from the centre, slicing the floral arch off the
 * top and bottom. The card is therefore composed to these exact dimensions
 * rather than handing over the artwork and hoping.
 *
 * The size ceiling is the one that bites. Past roughly 600 KB WhatsApp gives up
 * and shows no image at all — and it gives no error, so the only symptom is a
 * preview that mysteriously has no picture.
 */

/**
 * The couple's names as the PREVIEW shows them — both painted into the card and
 * printed in its bold title line, so the picture and the words agree.
 *
 * Latin, because the invitation is lettered "NICOLE & DIMA" and the preview sits
 * beside it. Deliberately not `wedding_config.couple_names`, which stays Hebrew:
 * that value titles the .ics event a guest downloads (lib/calendar.ts), where
 * Hebrew is right.
 *
 * A constant rather than a settings field because it is a property of the
 * artwork, not of the wedding — it changes when the designer's file changes, and
 * the card must be rebuilt for that anyway. Blank it and both fall back to the
 * config value.
 */
export const OG_COUPLE_NAMES = 'Nicole & Dima'

/**
 * Public path of the built card, per language. Served straight from `public/`.
 *
 * Two files, because the card PAINTS the date and venue onto the artwork and
 * both differ by language — a Russian household reading a Hebrew date and a
 * Hebrew address in the picture is the thing this exists to fix.
 *
 * `npm run og-card` builds both. They share the artwork; only the painted lines
 * differ. When the designer delivers a Russian invitation, point the script at
 * it and the two will differ in the picture as well.
 */
export const OG_CARD_PATHS: Record<Language, string> = {
  he: '/assets/og-card.jpg',
  ru: '/assets/og-card-ru.jpg',
}

/** The Hebrew card, where a single default is needed. */
export const OG_CARD_PATH = OG_CARD_PATHS.he

/**
 * THE card's URL, path plus cache-busting version. Never advertise a bare
 * OG_CARD_PATHS entry.
 *
 * WhatsApp caches a preview image by its URL and re-fetches nothing, so a
 * rebuilt card served from the same path keeps showing the old picture in every
 * new chat — silently, and for as long as its cache holds. `?v=` is the only
 * lever: the path is a static file, so there are no response headers of ours to
 * set. The version is a content hash written by `npm run og-card`, which means
 * it changes exactly when the picture does and never when it doesn't.
 */
export function ogCardUrl(language: Language): string {
  return `${OG_CARD_PATHS[language]}?v=${OG_CARD_VERSION}`
}

export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/** WhatsApp drops the preview above this. Enforced by scripts/build-og-card.ts. */
export const OG_CARD_MAX_BYTES = 600 * 1024
