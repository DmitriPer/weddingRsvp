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

/** Public path of the built card. Served straight from `public/`. */
export const OG_CARD_PATH = '/assets/og-card.jpg'

export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/** WhatsApp drops the preview above this. Enforced by scripts/build-og-card.ts. */
export const OG_CARD_MAX_BYTES = 600 * 1024
