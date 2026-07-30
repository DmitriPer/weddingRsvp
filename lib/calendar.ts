/**
 * THE .ics builder. Pure — config in, iCalendar text out, no I/O.
 *
 * Why a file rather than a Google Calendar URL: a `.ics` is the only thing that
 * adds an event natively on an iPhone. A calendar.google.com link sends every
 * iOS guest to a web page to sign in, and most of this guest list is on a phone.
 *
 * Times are absolute UTC (the trailing Z). The wedding has one instant, and
 * pinning it to UTC means a guest whose phone is set to another timezone still
 * gets the right local time — which is the same reason lib/datetime.ts pins
 * display to Asia/Jerusalem.
 */

import type { WeddingConfig } from '@/lib/types'

/** A wedding is an evening, not a point. Guests see a block, not a pin. */
const DEFAULT_DURATION_HOURS = 5

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are special. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545 UTC form: 20261008T163000Z */
function toIcsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * Returns null when there is no date yet, which is how the route answers 404
 * and how the action bar knows not to offer the button at all. An .ics with no
 * DTSTART is invalid, and a calendar app's failure mode for one is silence.
 */
export function buildWeddingIcs(config: WeddingConfig, now: Date = new Date()): string | null {
  if (!config.wedding_date_time) return null

  const start = new Date(config.wedding_date_time)
  if (Number.isNaN(start.getTime())) return null

  const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000)
  const title = config.couple_names.trim() || 'חתונה'

  // CRLF is required by the spec, not a stylistic choice — some calendar
  // clients reject a file joined with bare newlines.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wedding-rsvp//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable across regenerations, so re-adding updates rather than duplicates.
    `UID:wedding-${toIcsStamp(start)}@wedding-rsvp`,
    `DTSTAMP:${toIcsStamp(now)}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeText(title)}`,
    ...(config.venue_name.trim() ? [`LOCATION:${escapeText(config.venue_name)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
