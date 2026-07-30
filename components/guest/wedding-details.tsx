/**
 * Date, time and venue. Shared by the landing, confirmation and closed screens.
 *
 * Presentational only: it receives already-formatted text. Formatting a date
 * belongs to lib/datetime.ts and happens at the page (docs/conventions.md §3),
 * so this file never touches a Date.
 */

export function WeddingDetails({ when, venue }: { when: string; venue: string }) {
  if (!when && !venue) return null

  return (
    <div className="text-center text-sm text-bloom-ink">
      {when ? <p>{when}</p> : null}
      {venue ? <p>{venue}</p> : null}
    </div>
  )
}
