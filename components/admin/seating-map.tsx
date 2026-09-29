'use client'

/**
 * The floor plan (PRD §6.17, migration 012).
 *
 * Tables are dragged into the shape of the actual room, so the plan can be read
 * by someone standing in it. This is the one place dragging is right: there are
 * a dozen objects, not a hundred and seventy, and the whole point is *where*
 * something is — which a list cannot express and a dropdown cannot either.
 *
 * Pointer events, no drag-and-drop library. `setPointerCapture` keeps the
 * gesture attached to the table even when the pointer outruns it, which is the
 * one hard part of dragging by hand, and it covers mouse, pen and touch from a
 * single set of handlers.
 *
 * Positions are saved on release, not on every move: a drag across the floor is
 * hundreds of pointermove events and one intended change.
 *
 * The one piece of optimistic state: a dropped table's position is held
 * locally (`dropped`) until the save and the refresh behind it land, so the
 * table stays where it was put instead of snapping back to its old spot for
 * the length of a round trip. A failed save drops the override, and the table
 * returns to where the database says it is. A table can't be grabbed again
 * while its position is saving.
 */

import { startTransition, useRef, useState } from 'react'
import { strings } from '@/lib/strings'
import { jsonInit, requestJson } from '@/lib/request'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { occupancy, seatablePeople, type TableOccupancy } from '@/lib/seating'
import type { InviteWithPeople, SeatingTable } from '@/lib/types'

type Point = { x: number; y: number }

/**
 * Where a table sits before anyone has dragged it.
 *
 * Laid out in a grid rather than all at 0,0 — a first visit should show the
 * tables spread out and ready to arrange, not a single stack in the corner.
 *
 * The grid is sized to the table count, so every slot stays inside the floor
 * however many tables there are. A fixed column count with a fixed row step
 * pushed the fifth row past 100% and out of sight.
 */
function defaultPosition(index: number, count: number): { x: number; y: number } {
  // The floor is 3:2, so aim for half again as many columns as rows.
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * 1.5)))
  const rows = Math.max(1, Math.ceil(count / columns))
  const margin = 10
  const span = 100 - margin * 2
  return {
    x: margin + ((index % columns) + 0.5) * (span / columns),
    y: margin + (Math.floor(index / columns) + 0.5) * (span / rows),
  }
}

export function SeatingMap({
  invites,
  tables,
}: {
  invites: InviteWithPeople[]
  tables: SeatingTable[]
}): React.JSX.Element | null {
  const t = strings.seating
  const moving = useAction()
  const rotating = useAction()
  const floor = useRef<HTMLDivElement>(null)

  /** Only while dragging. The saved position is the source of truth otherwise. */
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null)
  /**
   * Where inside the table it was grabbed, in floor percent.
   *
   * Without it the table's centre snaps to the pointer the instant it is
   * touched, so grabbing a table by its edge makes it jump before it moves.
   */
  const grab = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  /** Dropped positions still being saved, by table id. See the file header. */
  const [dropped, setDropped] = useState<Record<string, Point>>({})
  /** The table whose ⟳ was pressed, for its spinner. */
  const [rotatingId, setRotatingId] = useState<string | null>(null)

  const board = occupancy(tables, seatablePeople(invites))

  function positionOf(spot: TableOccupancy, index: number): { x: number; y: number } {
    if (dragging?.id === spot.table.id) return { x: dragging.x, y: dragging.y }
    // Gated on pending as well: once the action settles the refreshed data is
    // on screen, so a leftover override can never outlive its save.
    const saving = moving.pending ? dropped[spot.table.id] : undefined
    if (saving) return saving
    if (spot.table.pos_x !== null && spot.table.pos_y !== null) {
      return { x: spot.table.pos_x, y: spot.table.pos_y }
    }
    return defaultPosition(index, board.length)
  }

  /** Pointer position as a percentage of the floor, clamped to it. */
  function toPercent(event: React.PointerEvent): { x: number; y: number } | null {
    const box = floor.current?.getBoundingClientRect()
    if (!box) return null
    const clamp = (value: number) => Math.min(100, Math.max(0, value))
    return {
      x: clamp(((event.clientX - box.left) / box.width) * 100),
      y: clamp(((event.clientY - box.top) / box.height) * 100),
    }
  }

  function isSavingPosition(id: string): boolean {
    return moving.pending && id in dropped
  }

  function forgetDropped(id: string): void {
    setDropped((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function startDrag(event: React.PointerEvent, id: string, at: { x: number; y: number }) {
    if (isSavingPosition(id)) return
    const point = toPercent(event)
    if (!point) return
    grab.current = { x: point.x - at.x, y: point.y - at.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging({ id, x: at.x, y: at.y })
  }

  function moveDrag(event: React.PointerEvent) {
    if (!dragging) return
    const point = toPercent(event)
    if (!point) return
    const clamp = (value: number) => Math.min(100, Math.max(0, value))
    setDragging({
      ...dragging,
      x: clamp(point.x - grab.current.x),
      y: clamp(point.y - grab.current.y),
    })
  }

  /**
   * Turns a table a step clockwise.
   *
   * 45° steps, not free rotation: a room is laid out along its walls and across
   * its corners, and eight positions cover that. Free rotation would mean a
   * second drag gesture competing with the one that moves the table, for an
   * angle nobody needs to the degree.
   */
  function rotate(table: SeatingTable): void {
    if (rotating.pending) return
    setRotatingId(table.id)
    const rotation = (table.rotation + 45) % 360
    rotating.run(
      () => requestJson(`/api/tables/${table.id}`, jsonInit('PATCH', { rotation }), t.saveFailed),
      { failure: t.saveFailed }
    )
  }

  function endDrag(event: React.PointerEvent): void {
    if (!dragging) return
    const moved = dragging
    // Rounded: a plan does not need six decimal places of a percent, and
    // whole numbers make the stored value readable in the database.
    const at = { x: Math.round(moved.x), y: Math.round(moved.y) }
    // Set together with clearing the drag, so there is no frame in which the
    // table sits at its old saved position.
    setDropped((current) => ({ ...current, [moved.id]: at }))
    setDragging(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
    savePosition(moved.id, at)
  }

  function savePosition(id: string, at: Point): void {
    moving.run(
      async () => {
        await requestJson(
          `/api/tables/${id}`,
          jsonInit('PATCH', { pos_x: at.x, pos_y: at.y }),
          t.saveFailed
        )
        // Inside the action, so the override is dropped in the same commit
        // that brings the saved position from the server.
        startTransition(() => forgetDropped(id))
      },
      { failure: t.saveFailed, onError: () => forgetDropped(id) }
    )
  }

  if (board.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-semibold">{t.mapTitle}</h2>
        <p className="text-sm text-muted print:hidden">{t.mapHint}</p>
      </div>

      <div
        ref={floor}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-border bg-surface/40"
      >
        {board.map((spot, index) => {
          const at = positionOf(spot, index)
          const isDragging = dragging?.id === spot.table.id
          const isSaving = isSavingPosition(spot.table.id)
          const isRotating = rotating.pending && rotatingId === spot.table.id

          return (
            /*
             * A div, not a button, because it holds one: the rotate control is
             * a real button and nesting buttons is invalid. Dragging is the
             * whole interaction here, so there is nothing to activate by
             * keyboard that the board below does not already offer.
             */
            <div
              key={spot.table.id}
              onPointerDown={(event) => startDrag(event, spot.table.id, at)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-busy={isSaving || isRotating}
              style={{
                left: `${at.x}%`,
                top: `${at.y}%`,
                // The shape turns; the label does not, so it stays readable at
                // every angle — see the counter-rotation below.
                rotate: `${spot.table.rotation}deg`,
              }}
              /*
               * -translate-*-1/2 puts the table's CENTRE under the pointer.
               * Without it a table jumps by half its own width the moment it is
               * grabbed, which reads as the app fighting you.
               *
               * touch-none stops the browser scrolling the page instead of
               * moving the table on a touchscreen.
               */
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 touch-none select-none flex-col items-center justify-center border p-1 text-center text-xs leading-tight ${
                SHAPE_CLASS[spot.table.shape]
              } ${
                spot.over
                  ? 'border-danger bg-danger/10 text-danger'
                  : 'border-bloom-ink/40 bg-paper text-bloom-strong'
              } ${isDragging ? 'z-10 shadow-lg' : ''}`}
            >
              <div
                className="flex flex-col items-center"
                style={{ rotate: `${-spot.table.rotation}deg` }}
              >
                <span className="max-w-full truncate font-semibold">{spot.table.name}</span>
                <span className="ltr-nums text-[0.65rem] opacity-70">
                  {t.occupancy(spot.seated, spot.table.capacity)}
                </span>
                {isSaving ? <Spinner className="mt-0.5 text-[0.65rem] opacity-70" /> : null}
              </div>

              {/* A circle looks the same at every angle, so it gets no control. */}
              {spot.table.shape !== 'round' ? (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => rotate(spot.table)}
                  /* Every click turns from the saved angle, so a second click
                     before the first lands would be lost: one turn at a time. */
                  disabled={rotating.pending}
                  aria-label={t.rotateTable}
                  title={t.rotateTable}
                  style={{ rotate: `${-spot.table.rotation}deg` }}
                  className="absolute -top-2 left-1/2 inline-flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-bloom-ink/40 bg-paper text-xs text-bloom-strong hover:bg-bloom-ink/10 disabled:opacity-60 print:hidden"
                >
                  {isRotating ? <Spinner /> : '⟳'}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * The table's footprint, so the plan reads as a room.
 *
 * A round table is a circle, an ellipse is wider than tall, a rectangle is a
 * rectangle. Sizes are fixed rather than scaled by capacity: at plan scale the
 * difference between ten and fourteen seats is a couple of pixels, and legible
 * labels matter more than proportion.
 */
const SHAPE_CLASS: Record<SeatingTable['shape'], string> = {
  round: 'h-20 w-20 rounded-full',
  ellipse: 'h-16 w-28 rounded-[50%]',
  rectangle: 'h-16 w-24 rounded-md',
}
