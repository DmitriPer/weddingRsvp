'use client'

/**
 * The seating board (PRD §6.17).
 *
 * SELECT THEN PLACE, rather than drag and drop. Dragging is nicer with a mouse
 * and much worse with a finger, and it needs a library; selecting a few people
 * and clicking a table works the same on both and is faster when seating a
 * household one after another. Clicking someone already seated takes them off.
 *
 * Every change is one PATCH per person against attendees.table_id, then a
 * refresh. No optimistic state: a wrong seat that looks right is worse than a
 * half-second wait, and there are forty-odd people to place, not four thousand.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import {
  capacityTotals,
  filterBoard,
  FULLNESS,
  hasTableFilter,
  NO_TABLE_FILTERS,
  occupancy,
  reorderTables,
  searchPeople,
  seatablePeople,
  unseated,
  type Fullness,
  type SeatablePerson,
  type TableFilters,
} from '@/lib/seating'
import { TABLE_SHAPES, type InviteWithPeople, type SeatingTable, type TableShape } from '@/lib/types'

export function SeatingBoard({
  invites,
  tables,
}: {
  invites: InviteWithPeople[]
  tables: SeatingTable[]
}) {
  const t = strings.seating
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  /** The table whose name and capacity are open for editing, if any. */
  const [editing, setEditing] = useState<{ id: string; name: string; capacity: number } | null>(
    null
  )

  /** Card filters only — the map, printout and unseated list ignore them. */
  const [filters, setFilters] = useState<TableFilters>(NO_TABLE_FILTERS)
  const filtering = hasTableFilter(filters)

  const people = useMemo(() => seatablePeople(invites), [invites])
  const board = useMemo(() => occupancy(tables, people), [tables, people])
  // Numbered before filtering, so a card keeps its real place in the order.
  const cards = useMemo(
    () =>
      filterBoard(
        board.map((spot, index) => ({ spot, position: index + 1 })),
        filters
      ),
    [board, filters]
  )
  const totals = useMemo(() => capacityTotals(tables, people), [tables, people])
  const waiting = useMemo(() => searchPeople(unseated(people), query), [people, query])

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Moves everyone selected. `null` takes them off their table. */
  async function place(tableId: string | null) {
    if (selected.size === 0 || busy) return
    setBusy(true)

    try {
      // Sequential, not parallel: forty requests at once against one row each
      // gains nothing and makes a partial failure harder to read.
      for (const id of selected) {
        const response = await fetch(`/api/attendees/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_id: tableId }),
        })
        if (!response.ok) throw new Error(t.saveFailed)
      }
      setSelected(new Set())
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : t.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Moves a table to `toIndex` in the saved order. Disabled while filtering:
   * "one place up" among the visible cards is not one place up in the order.
   */
  async function reorder(id: string, toIndex: number) {
    if (busy || filtering) return
    const changes = reorderTables(tables, id, toIndex)
    if (changes.length === 0) return

    setBusy(true)
    try {
      // Sequential for the same reason as place(): a partial failure stays readable.
      for (const change of changes) {
        const response = await fetch(`/api/tables/${change.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: change.sort_order }),
        })
        if (!response.ok) throw new Error(t.saveFailed)
      }
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : t.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  /** Commits a typed position (1-based). Anything unparseable is ignored. */
  function commitPosition(id: string, current: number, typed: string) {
    const position = Number.parseInt(typed, 10)
    if (!Number.isFinite(position) || position === current) return
    void reorder(id, position - 1)
  }

  /**
   * Saves a table's name and capacity.
   *
   * Editing lives on the card rather than in the table manager because this is
   * where the consequences are visible: shrinking a table to eight while ten
   * people sit at it turns the card red immediately, which is the point.
   */
  async function saveTable() {
    if (!editing || busy) return
    const name = editing.name.trim()
    if (!name) return

    setBusy(true)
    try {
      const response = await fetch(`/api/tables/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, capacity: editing.capacity }),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error)
      setEditing(null)
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : t.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Removes a table. Nobody is deleted with it: attendees.table_id is
   * ON DELETE SET NULL, so its people come back to the unseated list — which
   * the confirmation says, because "delete" next to a list of names reads
   * alarming otherwise.
   */
  async function removeTable(id: string, name: string) {
    if (!window.confirm(t.confirmDeleteTable(name))) return

    try {
      const response = await fetch(`/api/tables/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(t.saveFailed)
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : t.saveFailed)
    }
  }

  return (
    // print:hidden as a whole: the printed page is SeatingPrintout, which lists
    // each table for reading at the venue. Printing both would repeat every
    // name twice in two different layouts.
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <span className="text-sm text-muted">
          {t.totals(totals.seated, totals.people, totals.chairs)}
        </span>
        {/* A plain link: the arrangement has nothing to filter, so the file
            is the same for everyone and a GET can be downloaded directly. */}
        <a
          href="/api/tables/export"
          download
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface print:hidden"
        >
          {t.exportPlan}
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface print:hidden"
        >
          {t.print}
        </button>
      </div>

      <p className="text-sm text-muted print:hidden">{t.hint}</p>

      {/* The selection bar only exists while something is selected, so the
          actions that need a selection are never present and inert. */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-bloom-ink bg-bloom-ink/10 px-3 py-2 text-sm print:hidden">
          <span className="font-semibold text-bloom-strong">{t.selected(selected.size)}</span>
          <button
            type="button"
            onClick={() => place(null)}
            disabled={busy}
            className="rounded-md border border-border bg-paper px-2 py-1 disabled:opacity-60"
          >
            {t.unseatSelected}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-border bg-paper px-2 py-1"
          >
            {t.clearSelection}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="rounded-lg border border-border p-3 print:hidden">
          <h2 className="mb-2 font-semibold">
            {t.unseated} <span className="text-muted">({waiting.length})</span>
          </h2>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPeople}
            aria-label={t.searchPeople}
            className="mb-2 w-full rounded-md border border-border px-2 py-1.5 text-sm"
          />

          {waiting.length === 0 ? (
            <p className="text-sm text-muted">{t.noneUnseated}</p>
          ) : (
            <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
              {waiting.map((person) => (
                <li key={person.id}>
                  <PersonChip
                    person={person}
                    selected={selected.has(person.id)}
                    onClick={() => toggle(person.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          {board.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={filters.name}
                onChange={(event) => setFilters({ ...filters, name: event.target.value })}
                placeholder={t.filterByName}
                aria-label={t.filterByName}
                className="w-48 rounded-md border border-border px-2 py-1.5 text-sm"
              />
              <select
                value={filters.shape}
                onChange={(event) =>
                  setFilters({ ...filters, shape: event.target.value as TableShape | '' })
                }
                aria-label={t.allShapes}
                className="rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <option value="">{t.allShapes}</option>
                {TABLE_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {t.shapes[shape]}
                  </option>
                ))}
              </select>
              <select
                value={filters.fullness}
                onChange={(event) =>
                  setFilters({ ...filters, fullness: event.target.value as Fullness | '' })
                }
                aria-label={t.allFullness}
                className="rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <option value="">{t.allFullness}</option>
                {FULLNESS.map((level) => (
                  <option key={level} value={level}>
                    {t.fullness[level]}
                  </option>
                ))}
              </select>
              {filtering ? (
                <>
                  <button
                    type="button"
                    onClick={() => setFilters(NO_TABLE_FILTERS)}
                    className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-surface"
                  >
                    {t.clearFilters}
                  </button>
                  <span className="text-xs text-muted">{t.orderLockedHint}</span>
                </>
              ) : null}
            </div>
          ) : null}

          {board.length === 0 ? (
            <div className="rounded-lg border border-border p-6 text-center">
              <p className="font-semibold">{t.noTables}</p>
              <p className="text-sm text-muted">{t.noTablesHint}</p>
            </div>
          ) : cards.length === 0 ? (
            <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
              {t.noTablesMatch}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(({ spot, position }) => (
                <article
                  key={spot.table.id}
                  className={`rounded-lg border p-3 ${
                    spot.over ? 'border-danger bg-danger/5' : 'border-border'
                  }`}
                >
                  {editing?.id === spot.table.id ? (
                    <div className="mb-2 space-y-2">
                      <input
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        aria-label={t.tableName}
                        autoFocus
                        className="w-full rounded-md border border-border px-2 py-1 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-muted">
                          {t.capacity}
                          <input
                            type="number"
                            min={1}
                            value={editing.capacity}
                            onChange={(event) =>
                              setEditing({ ...editing, capacity: Number(event.target.value) })
                            }
                            className="ltr-nums w-16 rounded-md border border-border px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={saveTable}
                          disabled={busy}
                          className="rounded-md border border-bloom-ink bg-bloom-ink px-2 py-1 text-xs text-paper disabled:opacity-60"
                        >
                          {t.saveTable}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          {t.cancelEdit}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <header className="mb-2 flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">
                        <span className="ltr-nums text-muted" title={t.position}>
                          {position}.
                        </span>{' '}
                        <ShapeMark shape={spot.table.shape} /> {spot.table.name}
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: spot.table.id,
                              name: spot.table.name,
                              capacity: spot.table.capacity,
                            })
                          }
                          aria-label={t.editTable}
                          title={t.editTable}
                          /*
                           * Sized and coloured rather than a faint glyph: these
                           * sit on a card full of names, and an edit control
                           * that has to be hunted for gets clicked by accident
                           * on the way to finding it. A touch target of 1.75rem
                           * is also the smallest that is comfortable on a
                           * trackpad.
                           */
                          className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-bloom-ink/30 text-base text-bloom-strong hover:bg-bloom-ink/10"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTable(spot.table.id, spot.table.name)}
                          aria-label={t.deleteTable}
                          title={t.deleteTable}
                          className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-danger/40 text-base text-danger hover:bg-danger/10"
                        >
                          ✕
                        </button>
                      </h3>
                      <span
                        className={`ltr-nums text-sm ${spot.over ? 'font-semibold text-danger' : 'text-muted'}`}
                      >
                        {t.occupancy(spot.seated, spot.table.capacity)}
                      </span>
                    </header>
                  )}

                  {editing?.id === spot.table.id ? null : (
                    <div className="mb-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reorder(spot.table.id, position - 2)}
                        disabled={busy || filtering || position === 1}
                        aria-label={t.moveUp}
                        title={t.moveUp}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs hover:bg-surface disabled:opacity-40"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => reorder(spot.table.id, position)}
                        disabled={busy || filtering || position === board.length}
                        aria-label={t.moveDown}
                        title={t.moveDown}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs hover:bg-surface disabled:opacity-40"
                      >
                        ▼
                      </button>
                      {/* Uncontrolled, keyed by position: a refresh after a move
                          resets it to the table's new place. */}
                      <input
                        key={`${spot.table.id}-${position}`}
                        type="number"
                        min={1}
                        max={board.length}
                        defaultValue={position}
                        disabled={busy || filtering}
                        aria-label={t.position}
                        title={t.position}
                        onBlur={(event) =>
                          commitPosition(spot.table.id, position, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                        }}
                        className="ltr-nums w-14 rounded-md border border-border px-2 py-0.5 text-sm disabled:opacity-40"
                      />
                    </div>
                  )}

                  {spot.over ? (
                    <p className="mb-2 text-xs font-semibold text-danger">{t.over}</p>
                  ) : null}
                  {spot.undecided > 0 ? (
                    <p className="mb-2 text-xs text-muted">{t.undecidedHere(spot.undecided)}</p>
                  ) : null}

                  {spot.people.length === 0 ? (
                    <p className="text-sm text-muted">{t.emptyTable}</p>
                  ) : (
                    <ul className="space-y-1">
                      {spot.people.map((person) => (
                        <li key={person.id}>
                          <PersonChip
                            person={person}
                            selected={selected.has(person.id)}
                            onClick={() => toggle(person.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Placing is the card's own action, so the target is the
                      whole card rather than a button hidden inside it. */}
                  <button
                    type="button"
                    onClick={() => place(spot.table.id)}
                    disabled={busy || selected.size === 0}
                    className="mt-2 w-full rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40 print:hidden"
                  >
                    {selected.size > 0 ? t.selected(selected.size) : t.emptyTable}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** A round table is a circle, an ellipse an oval, a rectangle a square. */
function ShapeMark({ shape }: { shape: TableShape }) {
  const mark = { round: '●', ellipse: '⬭', rectangle: '▭' }[shape]
  return (
    <span className="text-muted" title={strings.seating.shapes[shape]}>
      {mark}
    </span>
  )
}

function PersonChip({
  person,
  selected,
  onClick,
}: {
  person: SeatablePerson
  selected: boolean
  onClick: () => void
}) {
  const label = person.isUnnamed ? strings.guests.placeholder : person.name

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-baseline gap-2 rounded-md border px-2 py-1 text-right text-sm ${
        selected ? 'border-bloom-ink bg-bloom-ink/10' : 'border-transparent hover:bg-surface'
      }`}
    >
      {/* Marked, not hidden: a table that looks full may be full of maybes. */}
      {person.certainty === 'undecided' ? (
        <span className="text-muted" title={strings.toolbar.answer.undecided}>
          ?
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {person.isChild ? ` (${strings.seating.child})` : ''}
      </span>
      <span className="shrink-0 truncate text-xs text-muted">{person.inviteName}</span>
    </button>
  )
}
