/**
 * The seating list as it comes off the printer, and as a PDF (PRD §6.17).
 *
 * THE BROWSER MAKES THE PDF. "Print → Save as PDF" rather than a PDF library,
 * and the reason is Hebrew: a server-side generator needs a bidi implementation
 * and an embedded font, which is exactly the problem that forced the preview
 * card through Pango. A browser already does both, correctly, for free.
 *
 * A Server Component with no interaction — it is hidden on screen and only
 * exists on paper, which is why it is a separate component rather than a print
 * stylesheet bolted onto the board: the board is built for choosing, and a
 * printed page is built for reading at a table with a pen.
 */

import { occupancy, seatablePeople } from '@/lib/seating'
import { strings } from '@/lib/strings'
import type { InviteWithPeople, SeatingTable } from '@/lib/types'

export function SeatingPrintout({
  invites,
  tables,
}: {
  invites: InviteWithPeople[]
  tables: SeatingTable[]
}) {
  const t = strings.seating
  const board = occupancy(tables, seatablePeople(invites))

  if (board.length === 0) return null

  return (
    <section className="hidden print:block">
      <h1 className="mb-4 text-xl font-semibold">{t.printTitle}</h1>

      <div className="space-y-4">
        {board.map((spot) => (
          // break-inside-avoid: a table split across two sheets is the one
          // thing that makes a printed seating list useless.
          <article key={spot.table.id} className="break-inside-avoid border-b border-border pb-3">
            <h2 className="font-semibold">
              {spot.table.name}
              <span className="ltr-nums mr-2 text-sm font-normal text-muted">
                {t.occupancy(spot.seated, spot.table.capacity)} · {t.shapes[spot.table.shape]}
              </span>
            </h2>

            {spot.people.length === 0 ? (
              <p className="text-sm text-muted">{t.emptyTable}</p>
            ) : (
              <ol className="mt-1 columns-2 text-sm">
                {spot.people.map((person) => (
                  <li key={person.id}>
                    {person.isUnnamed ? strings.guests.placeholder : person.name}
                    {person.isChild ? ` (${t.child})` : ''}
                    {/* The maybes are marked on paper too: someone reading this
                        at the venue needs to know which seats may go empty. */}
                    {person.certainty === 'undecided' ? ' ?' : ''}
                    <span className="text-muted"> · {person.inviteName}</span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
