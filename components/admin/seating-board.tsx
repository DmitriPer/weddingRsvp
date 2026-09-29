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
 *
 * Each kind of change is its own action (components/ui/use-action.ts), so the
 * control that was pressed shows the spinner, and every control that changes
 * the board is disabled until the refreshed data is on screen.
 */

import { startTransition, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { strings } from '@/lib/strings'
import { jsonInit, requestJson } from '@/lib/request'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import {
  capacityTotals,
  filterBoard,
  filterPeople,
  FULLNESS,
  groupByRelation,
  hasTableFilter,
  NO_PEOPLE_FILTERS,
  NO_TABLE_FILTERS,
  occupancy,
  reorderTables,
  searchPeople,
  seatablePeople,
  unseated,
  type Fullness,
  type PeopleFilters,
  type SeatablePerson,
  type TableFilters,
} from '@/lib/seating'
import {
  RELATIONS,
  SIDES,
  TABLE_SHAPES,
  type InviteWithPeople,
  type Relation,
  type SeatingTable,
  type Side,
  type TableShape,
} from '@/lib/types'

export function SeatingBoard({
  invites,
  tables,
}: {
  invites: InviteWithPeople[]
  tables: SeatingTable[]
}): React.JSX.Element {
  const t = strings.seating
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const placing = useAction()
  const ordering = useAction()
  const saving = useAction()
  const deleting = useAction()
  /** Any change to the board in flight: every mutating control waits for it. */
  const busy = placing.pending || ordering.pending || saving.pending || deleting.pending
  /** Which control started the running action, so only it shows the spinner. */
  const [placeTarget, setPlaceTarget] = useState<{ tableId: string | null; count: number }>({
    tableId: null,
    count: 0,
  })
  const [orderingControl, setOrderingControl] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
  /** Unseated-list filters only — the cards, map and printout ignore them. */
  const [peopleFilters, setPeopleFilters] = useState<PeopleFilters>(NO_PEOPLE_FILTERS)
  const unseatedPeople = useMemo(() => unseated(people), [people])
  const waiting = useMemo(
    () => filterPeople(searchPeople(unseatedPeople, query), peopleFilters),
    [unseatedPeople, query, peopleFilters]
  )
  const groups = useMemo(() => groupByRelation(waiting), [waiting])
  /** Who is selected, by name, for the selection bar. */
  const chosen = useMemo(
    () => people.filter((person) => selected.has(person.id)),
    [people, selected]
  )

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /**
   * After a failed loop some requests may already have landed. Refreshing
   * shows who actually moved, rather than leaving the board as it was.
   */
  function refreshAfterFailure(): void {
    startTransition(() => router.refresh())
  }

  /** Moves everyone selected. `null` takes them off their table. */
  function place(tableId: string | null): void {
    if (selected.size === 0 || busy) return
    const ids = [...selected]
    setPlaceTarget({ tableId, count: ids.length })

    placing.run(
      async () => {
        // Sequential, not parallel: forty requests at once against one row each
        // gains nothing and makes a partial failure harder to read.
        for (const id of ids) {
          await requestJson(
            `/api/attendees/${id}`,
            jsonInit('PATCH', { table_id: tableId }),
            t.saveFailed
          )
        }
        // Inside the action, so the selection clears in the same commit that
        // shows everyone in their new place. Kept on failure, to retry.
        startTransition(() => setSelected(new Set()))
      },
      { failure: t.saveFailed, onError: refreshAfterFailure }
    )
  }

  /**
   * Moves a table to `toIndex` in the saved order. Disabled while filtering:
   * "one place up" among the visible cards is not one place up in the order.
   *
   * `control` names what was pressed ("<id>:up", "<id>:down", "<id>:field"),
   * for the spinner.
   */
  function reorder(id: string, toIndex: number, control: string): void {
    if (busy || filtering) return
    const changes = reorderTables(tables, id, toIndex)
    if (changes.length === 0) return
    setOrderingControl(control)

    ordering.run(
      async () => {
        // Sequential for the same reason as place(): a partial failure stays readable.
        for (const change of changes) {
          await requestJson(
            `/api/tables/${change.id}`,
            jsonInit('PATCH', { sort_order: change.sort_order }),
            t.saveFailed
          )
        }
      },
      { failure: t.saveFailed, onError: refreshAfterFailure }
    )
  }

  /** Commits a typed position (1-based). Anything unparseable is ignored. */
  function commitPosition(id: string, current: number, typed: string): void {
    const position = Number.parseInt(typed, 10)
    if (!Number.isFinite(position) || position === current) return
    reorder(id, position - 1, `${id}:field`)
  }

  /** Whether the reorder started from this control is still running. */
  function isOrdering(control: string): boolean {
    return ordering.pending && orderingControl === control
  }

  /**
   * Saves a table's name and capacity.
   *
   * Editing lives on the card rather than in the table manager because this is
   * where the consequences are visible: shrinking a table to eight while ten
   * people sit at it turns the card red immediately, which is the point.
   *
   * The form stays open, disabled and spinning, until the refresh lands, and
   * closes in that same commit — so the card never shows its old values.
   */
  function saveTable(): void {
    if (!editing || busy) return
    const name = editing.name.trim()
    if (!name) return
    const { id, capacity } = editing

    saving.run(
      async () => {
        await requestJson(`/api/tables/${id}`, jsonInit('PATCH', { name, capacity }), t.saveFailed)
        startTransition(() => setEditing(null))
      },
      { failure: t.saveFailed }
    )
  }

  /**
   * Removes a table. Nobody is deleted with it: attendees.table_id is
   * ON DELETE SET NULL, so its people come back to the unseated list — which
   * the confirmation says, because "delete" next to a list of names reads
   * alarming otherwise.
   */
  function removeTable(id: string, name: string): void {
    if (busy || !window.confirm(t.confirmDeleteTable(name))) return
    setDeletingId(id)

    deleting.run(
      () => requestJson(`/api/tables/${id}`, jsonInit('DELETE'), t.saveFailed),
      { failure: t.saveFailed }
    )
  }

  /** Whether a place/unseat towards `tableId` (`null` = unseat) is running. */
  function isPlacing(tableId: string | null): boolean {
    return placing.pending && placeTarget.tableId === tableId
  }

  function isDeleting(id: string): boolean {
    return deleting.pending && deletingId === id
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
          actions that need a selection are never present and inert. Pinned to
          the bottom at every width: the tables can be a long scroll from the
          unseated list, and the selection must stay visible on the way. */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-3xl space-y-2 rounded-lg border border-bloom-ink bg-paper px-3 py-2 text-sm shadow-lg print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-bloom-strong">{t.selected(selected.size)}</span>
            <button
              type="button"
              onClick={() => place(null)}
              disabled={busy}
              aria-busy={isPlacing(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-paper px-2 py-1 disabled:opacity-60"
            >
              {isPlacing(null) ? (
                <>
                  <Spinner />
                  {t.unseating(placeTarget.count)}
                </>
              ) : (
                t.unseatSelected
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={placing.pending}
              className="rounded-md border border-border bg-paper px-2 py-1 disabled:opacity-60"
            >
              {t.clearSelection}
            </button>
          </div>

          {/* Capped and scrollable: a whole household selected at once must
              not turn the bar into a wall over the tables on a phone. */}
          <ul className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {chosen.map((person) => {
              const label = person.isUnnamed ? strings.guests.placeholder : person.name
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    disabled={placing.pending}
                    aria-label={t.deselect(label)}
                    title={t.deselect(label)}
                    className="inline-flex items-center gap-1 rounded-full border border-bloom-ink/40 bg-bloom-ink/10 px-2 py-0.5 text-xs text-bloom-strong hover:bg-bloom-ink/20 disabled:opacity-60"
                  >
                    {label}
                    <span aria-hidden>✕</span>
                  </button>
                </li>
              )
            })}
          </ul>
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

          <div className="mb-2 grid grid-cols-2 gap-2">
            <select
              value={peopleFilters.relation}
              onChange={(event) =>
                setPeopleFilters({
                  ...peopleFilters,
                  relation: event.target.value as Relation | '',
                })
              }
              aria-label={strings.toolbar.allRelations}
              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="">{strings.toolbar.allRelations}</option>
              {RELATIONS.map((value) => (
                <option key={value} value={value}>
                  {strings.relation[value]}
                </option>
              ))}
            </select>
            <select
              value={peopleFilters.side}
              onChange={(event) =>
                setPeopleFilters({ ...peopleFilters, side: event.target.value as Side | '' })
              }
              aria-label={strings.toolbar.allSides}
              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="">{strings.toolbar.allSides}</option>
              {SIDES.map((value) => (
                <option key={value} value={value}>
                  {strings.side[value]}
                </option>
              ))}
            </select>
          </div>

          {waiting.length === 0 ? (
            <p className="text-sm text-muted">
              {unseatedPeople.length === 0 ? t.noneUnseated : t.noneMatch}
            </p>
          ) : (
            // Grouped by relation, in the invitee list's order, so seating can
            // go family first, then friends, work and invited-by-family.
            <div className="max-h-[32rem] space-y-3 overflow-y-auto">
              {groups.map((group) => (
                <section key={group.relation ?? 'none'}>
                  <h3 className="mb-1 text-xs font-semibold text-muted">
                    {group.relation ? strings.relation[group.relation] : t.noRelation}{' '}
                    <span className="ltr-nums">({group.people.length})</span>
                  </h3>
                  <ul className="space-y-1">
                    {group.people.map((person) => (
                      <li key={person.id}>
                        <PersonChip
                          person={person}
                          selected={selected.has(person.id)}
                          disabled={placing.pending}
                          onClick={() => toggle(person.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
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
                        disabled={saving.pending}
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
                            disabled={saving.pending}
                            className="ltr-nums w-16 rounded-md border border-border px-2 py-1 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={saveTable}
                          disabled={busy}
                          aria-busy={saving.pending}
                          className="inline-flex items-center gap-1 rounded-md border border-bloom-ink bg-bloom-ink px-2 py-1 text-xs text-paper disabled:opacity-60"
                        >
                          {saving.pending ? (
                            <>
                              <Spinner />
                              {strings.app.saving}
                            </>
                          ) : (
                            t.saveTable
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          disabled={saving.pending}
                          className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-60"
                        >
                          {t.cancelEdit}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <header className="mb-2 space-y-1.5">
                      {/* Line 1, never wraps: which table, and how full. The
                          name truncates rather than pushing the count down. */}
                      <div className="flex items-center gap-2">
                        {/* A badge, not "1.": the period lands on the wrong
                            side of the number in RTL. */}
                        <span
                          className="ltr-nums inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-border px-1.5 text-xs text-muted"
                          title={t.position}
                        >
                          {position}
                        </span>
                        <ShapeMark shape={spot.table.shape} />
                        <h3 className="min-w-0 flex-1 truncate font-semibold" title={spot.table.name}>
                          {spot.table.name}
                        </h3>
                        <span
                          className={`ltr-nums shrink-0 whitespace-nowrap text-sm ${spot.over ? 'font-semibold text-danger' : 'text-muted'}`}
                        >
                          {t.occupancy(spot.seated, spot.table.capacity)}
                        </span>
                      </div>

                      {/* Line 2: ordering at the start, edit/delete at the end. */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => reorder(spot.table.id, position - 2, `${spot.table.id}:up`)}
                            disabled={busy || filtering || position === 1}
                            aria-busy={isOrdering(`${spot.table.id}:up`)}
                            aria-label={t.moveUp}
                            title={t.moveUp}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs hover:bg-surface disabled:opacity-40"
                          >
                            {isOrdering(`${spot.table.id}:up`) ? <Spinner /> : '▲'}
                          </button>
                          <button
                            type="button"
                            onClick={() => reorder(spot.table.id, position, `${spot.table.id}:down`)}
                            disabled={busy || filtering || position === board.length}
                            aria-busy={isOrdering(`${spot.table.id}:down`)}
                            aria-label={t.moveDown}
                            title={t.moveDown}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs hover:bg-surface disabled:opacity-40"
                          >
                            {isOrdering(`${spot.table.id}:down`) ? <Spinner /> : '▼'}
                          </button>
                          {/* Uncontrolled, keyed by position: a refresh after a
                              move resets it to the table's new place. */}
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
                            className="ltr-nums h-7 w-14 rounded-md border border-border px-2 text-sm disabled:opacity-40"
                          />
                          {isOrdering(`${spot.table.id}:field`) ? (
                            <Spinner className="text-muted" />
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                id: spot.table.id,
                                name: spot.table.name,
                                capacity: spot.table.capacity,
                              })
                            }
                            disabled={busy}
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
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-bloom-ink/30 text-base text-bloom-strong hover:bg-bloom-ink/10 disabled:opacity-40"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTable(spot.table.id, spot.table.name)}
                            disabled={busy}
                            aria-busy={isDeleting(spot.table.id)}
                            aria-label={isDeleting(spot.table.id) ? strings.app.deleting : t.deleteTable}
                            title={t.deleteTable}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-danger/40 text-base text-danger hover:bg-danger/10 disabled:opacity-40"
                          >
                            {isDeleting(spot.table.id) ? <Spinner className="text-sm" /> : '✕'}
                          </button>
                        </div>
                      </div>
                    </header>
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
                    // Capped at roughly five rows: a table seating a whole
                    // extended family must not stretch its card past its
                    // neighbours, so it scrolls internally instead.
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {spot.people.map((person) => (
                        <li key={person.id}>
                          <PersonChip
                            person={person}
                            selected={selected.has(person.id)}
                            disabled={placing.pending}
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
                    aria-busy={isPlacing(spot.table.id)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40 print:hidden"
                  >
                    {isPlacing(spot.table.id) ? (
                      <>
                        <Spinner />
                        {t.placing(placeTarget.count)}
                      </>
                    ) : selected.size > 0 ? (
                      t.selected(selected.size)
                    ) : (
                      t.emptyTable
                    )}
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
  disabled,
  onClick,
}: {
  person: SeatablePerson
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  const label = person.isUnnamed ? strings.guests.placeholder : person.name

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-baseline gap-2 rounded-md border px-2 py-1 text-start text-sm disabled:opacity-60 ${
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
