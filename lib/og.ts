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

/** Public path of the built card. Served straight from `public/`. */
export const OG_CARD_PATH = '/assets/og-card.jpg'

export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/** WhatsApp drops the preview above this. Enforced by scripts/build-og-card.ts. */
export const OG_CARD_MAX_BYTES = 600 * 1024
