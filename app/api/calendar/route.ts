/**
 * The wedding as a calendar file, for the guest's "הוספה ליומן" button.
 *
 * No auth, like POST /api/rsvp: it returns the date and venue that are printed
 * on the invitation itself and nothing else. There is no guest data here, and
 * no token — every guest gets the identical file.
 */

import { NextResponse } from 'next/server'
import { fromThrown, notFound } from '@/lib/api'
import { buildWeddingIcs } from '@/lib/calendar'
import { getConfig } from '@/lib/data'

export async function GET() {
  try {
    const ics = buildWeddingIcs(await getConfig())

    // No date set yet. Better a clean 404 than an .ics with no DTSTART, which
    // calendar apps reject silently.
    if (!ics) return notFound('No wedding date set')

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wedding.ics"',
      },
    })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
