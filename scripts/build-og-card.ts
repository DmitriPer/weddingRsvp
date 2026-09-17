/**
 * Publishes the WhatsApp preview card (PRD §6.15).
 *
 *   npm run og-card
 *
 * The card is FINISHED ARTWORK, drawn by hand in a design tool and committed as
 * assets/card/card-artwork.png. This script does not compose it. It checks the
 * things that fail silently in production, writes public/assets/og-card.jpg, and
 * stamps the cache-busting version — no more.
 *
 * It used to build the card from the invitation: florals cut out and composed,
 * lettering rendered through Satori, Hebrew through Pango because Satori has no
 * bidi. Every position was a constant here. Handing that job to a design tool
 * removed all of it, and nothing about the card got worse — the only thing lost
 * is that adjusting it now means new artwork rather than a new number.
 *
 * `sharp` is a devDependency used only by this script. It must never be imported
 * by anything under app/ or lib/ that runs at request time.
 */

import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { formatNumericDate } from '../lib/datetime'
import { OG_CARD_HEIGHT, OG_CARD_MAX_BYTES, OG_CARD_WIDTH, OG_CARD_PATH } from '../lib/og'

/** The finished card, as delivered. Replace this file to change the card. */
const ARTWORK = 'assets/card/card-artwork.png'

/**
 * THE DATE THE ARTWORK SHOWS, as the database would store it.
 *
 * The date on the card is drawn, not rendered, so it cannot follow
 * /admin/settings the way every screen does. This is the tripwire: the build
 * reads wedding_config and stops if the two have parted company, which turns
 * "the preview quietly advertises the wrong day" into a failed build that says
 * what to do. The card sat on a stale 18:30 for six weeks once, and nothing
 * caught it but a person noticing.
 *
 * Change this only alongside new artwork.
 */
const ARTWORK_DATE = '8/10/2026'

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Run through npm run og-card, which loads .env.local.`)
  }
  return value
}

/**
 * Stops the build when the artwork and the database disagree about the date.
 *
 * Read with the Supabase client directly rather than through lib/data: that
 * module is marked `server-only`, which throws the moment it is imported outside
 * a React Server Component. scripts/create-admin.ts talks to Supabase the same
 * way for the same reason.
 */
async function assertArtworkMatchesConfig(): Promise<void> {
  const supabase = createClient(
    readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readEnv('SUPABASE_SECRET_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.from('wedding_config').select('wedding_date_time').single()
  if (error) {
    throw new Error(`Could not read wedding_config: ${error.message}`)
  }

  const configured = formatNumericDate(data.wedding_date_time)
  if (configured !== ARTWORK_DATE) {
    throw new Error(
      `The card's artwork shows ${ARTWORK_DATE}, but wedding_config says ${configured || '(no date set)'}.\n` +
        'The date on the card is drawn, not rendered, so it cannot be re-generated: get new ' +
        `artwork showing the new date, replace ${ARTWORK}, and update ARTWORK_DATE in this file.`
    )
  }

  console.log(`wedding_config agrees with the artwork: ${configured}`)
}

async function main(): Promise<void> {
  await assertArtworkMatchesConfig()

  const { width, height } = await sharp(ARTWORK).metadata()
  if (!width || !height) {
    throw new Error(`Could not read the dimensions of ${ARTWORK}`)
  }

  /*
   * Resized to the card's exact frame with `fill`, which stretches rather than
   * crops. Artwork delivered at a slightly different aspect — 1950×1024 is
   * 1.9043 against the card's 1.9048 — would otherwise lose a sliver of its
   * edge, and on a design whose flowers deliberately run off the sides, the
   * sliver is the part that was drawn to be there. A mismatch big enough to
   * distort visibly is caught below instead.
   */
  const aspect = width / height
  const target = OG_CARD_WIDTH / OG_CARD_HEIGHT
  if (Math.abs(aspect - target) / target > 0.02) {
    throw new Error(
      `${ARTWORK} is ${width}×${height} (aspect ${aspect.toFixed(4)}), too far from the card's ` +
        `${OG_CARD_WIDTH}×${OG_CARD_HEIGHT} (${target.toFixed(4)}). Stretching it to fit would ` +
        'visibly distort the artwork — redraw or re-export it at the card\'s proportions.'
    )
  }

  const destination = path.join('public', OG_CARD_PATH.replace(/^\//, ''))

  await sharp(ARTWORK)
    .resize({ width: OG_CARD_WIDTH, height: OG_CARD_HEIGHT, fit: 'fill' })
    .jpeg({ quality: 88, mozjpeg: true })
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

  console.log(`${ARTWORK} (${width}×${height}) → ${destination}`)
  console.log(`      ${OG_CARD_WIDTH}×${OG_CARD_HEIGHT}, ${kb} KB (budget ${OG_CARD_MAX_BYTES / 1024} KB)`)
  console.log('')

  writeCardVersion()

  console.log('Look at it, then commit it: the card is served as a static file.')
}

/** Where the generated version lands. Imported by lib/og.ts, never hand-edited. */
const VERSION_MODULE = 'lib/og-card-version.ts'

/**
 * Stamps the built card's content hash into lib/og-card-version.ts.
 *
 * WhatsApp caches a preview image by URL. Replace the card and serve it from the
 * same path and the old picture keeps appearing in new chats, silently — the one
 * failure this script cannot otherwise prevent. `?v=<hash>` makes a changed card
 * a different URL.
 *
 * Written HERE, from the bytes just produced, rather than bumped by hand: a
 * version someone has to remember to change is a version that eventually
 * doesn't. Hashing the output also means a rebuild that produces identical
 * pixels leaves the file untouched, so caches are not thrown away for nothing.
 */
function writeCardVersion(): void {
  const hash = createHash('sha256')
  hash.update(readFileSync(path.join('public', OG_CARD_PATH.replace(/^\//, ''))))
  const version = hash.digest('hex').slice(0, 16)

  const current = readFileSync(VERSION_MODULE, 'utf8')
  const next = current.replace(
    /export const OG_CARD_VERSION = '[^']*'/,
    `export const OG_CARD_VERSION = '${version}'`
  )
  if (next === current) {
    console.log(`Card unchanged; ${VERSION_MODULE} left at ${version}.`)
    return
  }

  writeFileSync(VERSION_MODULE, next)
  console.log(`${VERSION_MODULE} → ${version}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
