'use client'

/**
 * Creating and removing tables (PRD §6.17).
 *
 * Kept apart from the board: arranging people and defining the room are
 * different jobs, done at different times — the tables are set up once from
 * what the venue gives you, and the seating is then worked over days.
 *
 * Deleting a table does NOT delete anyone. `attendees.table_id` is
 * ON DELETE SET NULL, so its people return to the unseated list.
 *
 * ONLY creating. Renaming, resizing and deleting all live on the table's own
 * card in the board, where you can see who sits there — shrinking a table below
 * the people at it, or deleting one, should be done while looking at them.
 */

import { startTransition, useState } from 'react'
import { strings } from '@/lib/strings'
import { jsonInit, requestJson } from '@/lib/request'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { TABLE_SEATS, TABLE_SHAPES, type SeatingTable, type TableShape } from '@/lib/types'

export function TableManager({ tables }: { tables: SeatingTable[] }): React.JSX.Element {
  const t = strings.seating
  const creating = useAction()

  const [name, setName] = useState('')
  const [shape, setShape] = useState<TableShape>('round')
  // Follows the shape until the admin types over it, which is what makes the
  // shape useful rather than decorative.
  const [capacity, setCapacity] = useState(TABLE_SEATS.round.default)

  function chooseShape(next: TableShape) {
    setShape(next)
    setCapacity(TABLE_SEATS[next].default)
  }

  function add(event: React.FormEvent): void {
    event.preventDefault()
    if (creating.pending) return

    const payload = {
      name: name.trim(),
      shape,
      capacity,
      // Appended, so tables stay in the order they were created.
      sort_order: tables.length,
    }
    creating.run(
      async () => {
        await requestJson('/api/tables', jsonInit('POST', payload), t.saveFailed)
        // Inside the action, so the field empties as the new table appears.
        startTransition(() => setName(''))
      },
      { failure: t.saveFailed }
    )
  }

  const seats = TABLE_SEATS[shape]

  return (
    <section className="rounded-lg border border-border p-3 print:hidden">
      <h2 className="mb-2 font-semibold">
        {t.tables} <span className="text-muted">({tables.length})</span>
      </h2>

      <form onSubmit={add} className="mb-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.tableName}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.namePlaceholder}
            required
            className="w-40 rounded-md border border-border px-2 py-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.shape}</span>
          <select
            value={shape}
            onChange={(event) => chooseShape(event.target.value as TableShape)}
            className="rounded-md border border-border px-2 py-1.5"
          >
            {TABLE_SHAPES.map((value) => (
              <option key={value} value={value}>
                {t.shapes[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted">{t.capacity}</span>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            className="ltr-nums w-20 rounded-md border border-border px-2 py-1.5"
          />
        </label>

        <span className="pb-2 text-xs text-muted">{t.shapeHint(seats.min, seats.max)}</span>

        <button
          type="submit"
          disabled={creating.pending}
          aria-busy={creating.pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-bloom-ink bg-bloom-ink px-3 py-1.5 text-sm text-paper disabled:opacity-60"
        >
          {creating.pending ? (
            <>
              <Spinner />
              {strings.app.saving}
            </>
          ) : (
            t.addTable
          )}
        </button>
      </form>

    </section>
  )
}
