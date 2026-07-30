/**
 * THE date formatter. Pinned to Asia/Jerusalem so a guest abroad and the admin
 * at home always read the same wedding time.
 *
 * Never format a date inline anywhere else.
 */

export const WEDDING_TIMEZONE = 'Asia/Jerusalem'
const LOCALE = 'he-IL'

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "15 בספטמבר 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: WEDDING_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** "19:30" */
export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: WEDDING_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** "15 בספטמבר 2026, 19:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  return `${formatDate(date)}, ${formatTime(date)}`
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
