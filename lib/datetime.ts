/**
 * THE date formatter. Pinned to Asia/Jerusalem so a guest abroad and the admin
 * at home always read the same wedding time.
 *
 * Never format a date inline anywhere else.
 */

export const WEDDING_TIMEZONE = 'Asia/Jerusalem'
/**
 * The admin's locale, and the default everywhere. Guest-facing formatters take
 * an optional override so a Russian household reads its date in Russian; the
 * TIMEZONE never varies — Asia/Jerusalem is the wedding's timezone, not the
 * reader's.
 */
const LOCALE = 'he-IL'

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "15 בספטמבר 2026" */
export function formatDate(value: string | Date | null | undefined, locale: string = LOCALE): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: WEDDING_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * "19:30" — always 24-hour.
 *
 * `hour12: false` is explicit rather than inherited from the locale. he-IL
 * happens to default to 24-hour, but that is a property of CLDR data, not a
 * guarantee, and "7:30 PM" in a Hebrew RTL line is the kind of thing nobody
 * notices until a guest reads it.
 */
export function formatTime(value: string | Date | null | undefined, locale: string = LOCALE): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: WEDDING_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** "15 בספטמבר 2026, 19:30" */
export function formatDateTime(value: string | Date | null | undefined, locale: string = LOCALE): string {
  const date = toDate(value)
  if (!date) return ''
  return `${formatDate(date, locale)}, ${formatTime(date, locale)}`
}

/** Short form for dense table cells: "15/09/2026, 19:30" */
export function formatShort(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: WEDDING_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * Is the RSVP form still open? (PRD §6.3)
 *
 * A null deadline means always open. Called by the guest page for display AND
 * by POST /api/rsvp for enforcement — a disabled form is bypassed with one curl,
 * so the server is the one that actually decides.
 */
export function isRsvpOpen(deadline: string | Date | null, now: Date = new Date()): boolean {
  const cutoff = toDate(deadline)
  if (!cutoff) return true
  return now.getTime() <= cutoff.getTime()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * The two halves of editing a date in the admin form (PRD §6.5).
 *
 * `<input type="datetime-local">` speaks naive wall-clock strings with no zone,
 * and `new Date("2026-10-08T19:00")` resolves them in THE BROWSER's timezone.
 * Everything else in this file is pinned to Asia/Jerusalem, so a laptop set to
 * another zone would silently save the wrong wedding time — the value would
 * look right in the form and be wrong in every guest's calendar.
 *
 * So both directions go through Asia/Jerusalem explicitly, and the form sends
 * an ISO string carrying a real offset. The API route's `new Date(...)` is then
 * unambiguous and needs no knowledge of any of this.
 */

/** The offset of a zone at a given instant, in minutes east of UTC. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  // Format the instant as if it were UTC in the target zone, then measure how
  // far that wall-clock reading has moved. Handles DST without a table.
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }))
  const asZone = new Date(instant.toLocaleString('en-US', { timeZone }))
  return Math.round((asZone.getTime() - asUtc.getTime()) / 60000)
}

/** ISO instant → "YYYY-MM-DDTHH:mm" as read in Jerusalem, for the input's value. */
export function toDateTimeLocalValue(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WEDDING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  // en-CA gives 24-hour time, but midnight can come back as "24".
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * The two halves of "YYYY-MM-DDTHH:mm", for a form that edits them separately.
 *
 * `<input type="datetime-local">` renders in the BROWSER's locale, so on an
 * English system it offers 12-hour time with AM/PM — and neither the document's
 * `lang` nor any attribute reliably overrides that. The admin form therefore
 * pairs a native date input with its own hour and minute selects, which are
 * 24-hour everywhere by construction. These two helpers are the seam, so the
 * wall-clock string format stays known only to this file.
 */
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T')
  return { date, time }
}

/** Empty unless BOTH halves are present — a date with no time is not an instant. */
export function joinDateTimeLocal(date: string, time: string): string {
  if (!date || !time) return ''
  return `${date}T${time}`
}

/**
 * "YYYY-MM-DDTHH:mm" typed by the admin → ISO instant, reading the input as
 * Jerusalem wall-clock time whatever the browser's own zone is.
 *
 * Returns null for empty input, which is how "no deadline" and "no date set"
 * reach the API as null rather than an invalid date.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value.trim()) return null

  // Read the wall-clock numbers as if they were UTC, then subtract Jerusalem's
  // offset at that moment to land on the real instant.
  const naive = new Date(`${value}:00.000Z`)
  if (Number.isNaN(naive.getTime())) return null

  const candidate = (offsetSource: Date) =>
    new Date(naive.getTime() - zoneOffsetMinutes(offsetSource, WEDDING_TIMEZONE) * 60000)

  // Two candidates, because a DST boundary makes the offset depend on the very
  // answer being computed. Around the autumn change, one of them is a wall-clock
  // reading the calendar SKIPPED — 02:30 does not exist on the night 01:59 IDT
  // becomes 01:00 IST — so the only safe test is to convert back and see which
  // candidate actually reproduces what was typed.
  const first = candidate(naive)
  const second = candidate(first)

  for (const instant of [second, first]) {
    if (toDateTimeLocalValue(instant) === value) return instant.toISOString()
  }

  // Neither round-trips: the time genuinely does not exist in this zone (the
  // spring-forward gap). Take the later reading rather than refusing — the
  // admin gets a real instant an hour off, not a silent null.
  return second.toISOString()
}
