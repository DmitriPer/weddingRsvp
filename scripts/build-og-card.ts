/**
 * Builds the WhatsApp preview card (PRD §6.15) from a source image.
 *
 *   npm run og-card                          # rebuild from the current artwork
 *   npm run og-card path/to/new-artwork.jpg  # when the designer's file lands
 *
 * Writes public/assets/og-card.jpg at exactly 1200×630: the artwork, with the
 * couple's names, date and venue painted into the middle. The result is
 * COMMITTED, so serving it is a static file read — no rendering on a request
 * WhatsApp abandons after a few seconds.
 *
 * **The card does not follow the settings tab.** It is a file, not a page. Edit
 * the date or the venue in /admin/settings and this must be re-run, or the
 * preview keeps advertising the old details while every screen shows the new
 * ones. Nothing enforces that, which is exactly why it is written here.
 *
 * `sharp` is a devDependency used only by this script. It must never be
 * imported by anything under app/ or lib/ that runs at request time.
 */

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { formatDateTime } from '../lib/datetime'
import { OG_CARD_HEIGHT, OG_CARD_MAX_BYTES, OG_CARD_PATH, OG_CARD_WIDTH } from '../lib/og'

/** The landscape banner the card is built from. Not the portrait invitation. */
const DEFAULT_SOURCE = 'public/assets/demo-og-source.jpg'

/** The couple's monogram, sitting above the names. Same mark as the invitation. */
const LOGO = 'public/assets/wedding-logo.svg'
const LOGO_HEIGHT = 128
const LOGO_TOP = 132

/**
 * Above this, a source is landscape enough to fill the card by cropping a little
 * off its top and bottom. Below it — a portrait invitation — cropping would eat
 * the artwork, so the whole thing is fitted onto a canvas instead.
 *
 * 1.4 sits between a 16:9 banner (1.78, the shape image tools produce) and a
 * portrait invitation (0.71).
 */
const CROPPABLE_ASPECT = 1.4

/**
 * The guest palette's greens, mirroring `--bloom-*` in app/globals.css. A
 * script cannot read CSS custom properties, so these are the one copy that
 * exists outside that file; change them together.
 */
const INK_STRONG = '#475F3B'
const INK = '#567348'
const RULE = '#7FA46D'

/**
 * Hebrew is rendered through an SVG overlay, NOT through `next/og`.
 *
 * Satori — what `next/og` uses — performs no bidirectional reordering, so
 * "ניקול ודימה" comes out as "המידו לוקינ": correct glyphs, laid out
 * left-to-right. It looks like a font problem and is not one; no font fixes it.
 * librsvg shapes text through Pango, which implements the bidi algorithm, and
 * renders both the Hebrew and the mixed Hebrew/number date line correctly.
 *
 * The consequence is that the font comes from the MACHINE, via fontconfig,
 * rather than from a file this repo controls. Heebo — the site's own face — is
 * used when installed; otherwise Noto Sans Hebrew, which is close enough that
 * the card is not worth a font-embedding pipeline. The output is committed and
 * looked at, so a bad substitution is caught by eye before it ships.
 */
const FONT_STACK = "Heebo, 'Noto Sans Hebrew', 'Droid Sans Hebrew', sans-serif"

interface CardText {
  couple: string
  when: string
  venue: string
}

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. This script reads it from .env.local — run it through npm run og-card.`
    )
  }
  return value
}

/**
 * The details, from wedding_config.
 *
 * Read with the Supabase client directly rather than through lib/data: that
 * module is marked `server-only`, which throws the moment it is imported outside
 * a React Server Component. scripts/create-admin.ts talks to Supabase the same
 * way for the same reason.
 */
async function readCardText(): Promise<CardText> {
  const supabase = createClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase
    .from('wedding_config')
    .select('couple_names, wedding_date_time, venue_name')
    .single()

  if (error) {
    throw new Error(`Could not read wedding_config: ${error.message}`)
  }

  return {
    couple: (data.couple_names ?? '').trim(),
    // Via lib/datetime, so the card reads the same instant as every screen.
    when: formatDateTime(data.wedding_date_time),
    venue: (data.venue_name ?? '').trim(),
  }
}

/** `&` and `<` in a venue name would otherwise produce invalid SVG. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Long names would run into the florals, so the display size gives way first. */
function coupleFontSize(couple: string): number {
  if (couple.length <= 14) return 92
  if (couple.length <= 22) return 72
  return 56
}

function textOverlay({ couple, when, venue }: CardText): Buffer {
  const centre = OG_CARD_WIDTH / 2
  const line = (y: number, size: number, fill: string, weight: number, value: string) =>
    `<text x="${centre}" y="${y}" font-family="${FONT_STACK}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" direction="rtl">${escapeXml(value)}</text>`

  // Each line is omitted rather than rendered blank when its field is unset, so
  // a half-filled wedding_config gives a sparser card, never a stray rule.
  const parts = [
    couple && line(352, coupleFontSize(couple), INK_STRONG, 700, couple),
    couple &&
      (when || venue) &&
      `<line x1="${centre - 75}" y1="400" x2="${centre + 75}" y2="400" stroke="${RULE}" stroke-width="1.5"/>`,
    when && line(462, 44, INK, 400, when),
    venue && line(514, 34, INK, 400, venue),
  ].filter(Boolean)

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_CARD_WIDTH}" height="${OG_CARD_HEIGHT}">${parts.join('')}</svg>`
  )
}

async function composeArtwork(source: string): Promise<Buffer> {
  const { width, height } = await sharp(source).metadata()
  if (!width || !height) {
    throw new Error(`Could not read the dimensions of ${source}`)
  }

  // Landscape enough: fill the frame, losing a sliver top and bottom.
  if (width / height >= CROPPABLE_ASPECT) {
    return sharp(source)
      .resize({ width: OG_CARD_WIDTH, height: OG_CARD_HEIGHT, fit: 'cover', position: 'centre' })
      .toBuffer()
  }

  // Portrait: the whole image, centred, on its own paper colour. The bars either
  // side read as margin rather than a gap — the same reason the guest page's
  // backdrop uses `contain` (components/guest/invitation-backdrop.tsx).
  const fitted = await sharp(source).resize({ height: OG_CARD_HEIGHT, fit: 'inside' }).toBuffer()
  const { data } = await sharp(source)
    .extract({ left: 0, top: 0, width: 12, height: 12 })
    .raw()
    .toBuffer({ resolveWithObject: true })

  return sharp({
    create: {
      width: OG_CARD_WIDTH,
      height: OG_CARD_HEIGHT,
      channels: 3,
      background: { r: data[0], g: data[1], b: data[2] },
    },
  })
    .composite([{ input: fitted }])
    .toBuffer()
}

async function main(): Promise<void> {
  const source = process.argv[2] ?? DEFAULT_SOURCE
  readFileSync(source) // fail here, with the path, rather than inside sharp

  const text = await readCardText()
  const destination = path.join('public', OG_CARD_PATH.replace(/^\//, ''))

  // The monogram is composited as its own layer rather than embedded in the SVG
  // overlay: librsvg would have to resolve a nested file reference, and a
  // silently-missing one is a card that ships with a hole in it.
  const logo = await sharp(LOGO).resize({ height: LOGO_HEIGHT }).png().toBuffer()
  const { width: logoWidth } = await sharp(logo).metadata()

  await sharp(await composeArtwork(source))
    .composite([
      { input: logo, top: LOGO_TOP, left: Math.round((OG_CARD_WIDTH - (logoWidth ?? 0)) / 2) },
      { input: textOverlay(text) },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(destination)

  const bytes = statSync(destination).size
  const kb = (bytes / 1024).toFixed(0)

  // The ceiling is silent in production: WhatsApp simply shows no picture and
  // says nothing. Refuse here, where someone is watching.
  if (bytes > OG_CARD_MAX_BYTES) {
    throw new Error(
      `${destination} is ${kb} KB — over the ${OG_CARD_MAX_BYTES / 1024} KB budget. ` +
        'WhatsApp drops the preview entirely at this size. Lower the JPEG quality.'
    )
  }

  console.log(`${source} → ${destination}`)
  console.log(`${OG_CARD_WIDTH}×${OG_CARD_HEIGHT}, ${kb} KB (budget ${OG_CARD_MAX_BYTES / 1024} KB)`)
  console.log('')
  console.log('Painted onto the card, from wedding_config:')
  console.log(`  ${text.couple || '(no couple names set)'}`)
  console.log(`  ${text.when || '(no date set)'}`)
  console.log(`  ${text.venue || '(no venue set)'}`)
  console.log('')
  console.log('Look at it, then commit it: the card is served as a static file.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
