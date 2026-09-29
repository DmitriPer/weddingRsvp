'use client'

/**
 * The square list, Hebrew and Russian side by side (docs/games-bingo-PRD.md
 * §3.5). Each cell saves on its own, like the budget table; state lives in
 * components/games/bingo-game.tsx.
 *
 * Collapsed on desktop, as on the original page — the cards are what the
 * screen is for there. Open on a phone, where editing text and checking the
 * result is the main job (docs/games-bingo-PRD.md §3.7).
 *
 * Desktop is a table; below `md` every row stacks into a block (Hebrew, then
 * Russian, then delete), because two 192px inputs side by side don't fit.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import type { BingoSquare, UpdateBingoSquareInput } from '@/lib/types'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

type Side = 'text_he' | 'text_ru'

/** Same breakpoint as Tailwind's `md`, where the layout switches. */
const PHONE_QUERY = '(max-width: 767px)'

/**
 * Opens the editor on a phone, once, on mount. A ref callback declared at
 * module level has a stable identity, so React calls it on mount only — a
 * user who then closes the list keeps it closed. Not `open` in JSX: the server
 * can't know the screen width, so it would hydrate to the wrong state.
 */
function openOnPhone(element: HTMLDetailsElement | null): void {
  if (element && window.matchMedia(PHONE_QUERY).matches) element.open = true
}

/** 16px on phones: iOS Safari zooms the page into any focused field smaller than that. */
const INPUT_TEXT = 'text-base md:text-sm'

export function BingoSquareEditor({
  squares,
  busyIds,
  onSave,
  onDelete,
  onAdded,
}: {
  squares: BingoSquare[]
  busyIds: Set<string>
  onSave: (id: string, patch: UpdateBingoSquareInput, previous: UpdateBingoSquareInput) => void
  onDelete: (square: BingoSquare) => void
  onAdded: () => void
}) {
  return (
    <details ref={openOnPhone} className="rounded-lg border border-border px-4 print:hidden">
      <summary className="cursor-pointer py-3 text-sm font-medium">
        {strings.bingo.editorTitle} <span className="text-muted ltr-nums">({squares.length})</span>
      </summary>

      <div className="space-y-3 pb-4">
        <p className="text-sm text-muted">{strings.bingo.editorHint}</p>
        {/* On a phone the stacked list is several screens long; this is the
            way back to the result of an edit. */}
        <a
          href="#bingo-cards"
          className="flex min-h-11 items-center justify-center rounded-md border border-border text-sm md:hidden"
        >
          {strings.bingo.jumpToCards}
        </a>

        {squares.length === 0 ? (
          <EmptyState title={strings.bingo.empty} hint={strings.bingo.emptyHint} />
        ) : (
          <div className="rounded-lg border border-border md:overflow-x-auto">
            <table className="block w-full border-collapse text-sm md:table md:min-w-2xl">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-border bg-surface">
                  <Th>{strings.bingo.textHe}</Th>
                  <Th>{strings.bingo.textRu}</Th>
                  <Th>
                    <span className="sr-only">{strings.bingo.delete}</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {squares.map((square) => {
                  const busy = busyIds.has(square.id)
                  return (
                    <tr
                      key={square.id}
                      className="grid gap-2 border-b border-border px-3 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
                    >
                      {(['text_he', 'text_ru'] as const).map((side) => (
                        <td key={side} className="block md:table-cell md:px-3 md:py-1.5">
                          {/* The table header names the column on desktop; stacked, each field needs its own. */}
                          <span aria-hidden className="mb-1 block text-xs text-muted md:hidden">
                            {side === 'text_he' ? strings.bingo.textHe : strings.bingo.textRu}
                          </span>
                          <SquareTextCell
                            // Keyed on the value so a failed save's revert remounts the draft.
                            key={square[side]}
                            square={square}
                            side={side}
                            disabled={busy}
                            onSave={(next) => onSave(square.id, { [side]: next }, { [side]: square[side] })}
                          />
                        </td>
                      ))}
                      <td className="block text-end md:table-cell md:w-px md:px-3 md:py-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDelete(square)}
                          className="min-h-11 rounded px-3 text-sm text-danger hover:bg-surface disabled:opacity-50 md:min-h-0 md:px-2 md:py-1 md:text-xs"
                        >
                          {strings.bingo.delete}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Appended at the end: the seed uses 1..28, and a default 0 would put
            every new square at the top of the list. */}
        <AddSquareRow
          nextSortOrder={squares.reduce((max, square) => Math.max(max, square.sort_order), 0) + 1}
          onAdded={onAdded}
        />
      </div>
    </details>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-medium text-muted">{children}</th>
}

function SquareTextCell({
  square,
  side,
  disabled,
  onSave,
}: {
  square: BingoSquare
  side: Side
  disabled: boolean
  onSave: (next: string) => void
}) {
  const value = square[side]
  const [draft, setDraft] = useState(value)
  const other = side === 'text_he' ? square.text_ru : square.text_he

  function commit() {
    const trimmed = draft.trim()
    if (trimmed === value) return
    // One side may be blank (it just leaves the square off that language's
    // cards), but not both — a square with no text is on no card at all.
    if (!trimmed && !other) {
      setDraft(value)
      toast.error(strings.bingo.textRequired)
      return
    }
    onSave(trimmed)
  }

  return (
    <input
      value={draft}
      disabled={disabled}
      dir={side === 'text_ru' ? 'ltr' : 'rtl'}
      lang={side === 'text_ru' ? 'ru' : 'he'}
      aria-label={side === 'text_ru' ? strings.bingo.textRu : strings.bingo.textHe}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(value)
      }}
      className={`w-full rounded border border-border px-2 py-2 disabled:opacity-50 md:min-w-48 md:py-1 ${INPUT_TEXT}`}
    />
  )
}

function AddSquareRow({ nextSortOrder, onAdded }: { nextSortOrder: number; onAdded: () => void }) {
  const [textHe, setTextHe] = useState('')
  const [textRu, setTextRu] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd() {
    const he = textHe.trim()
    const ru = textRu.trim()
    if (!he && !ru) {
      toast.error(strings.bingo.textRequired)
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/bingo-squares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text_he: he, text_ru: ru, sort_order: nextSortOrder }),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.bingo.saveFailed)

      setTextHe('')
      setTextRu('')
      onAdded()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : strings.bingo.saveFailed)
    } finally {
      setAdding(false)
    }
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault()
        void handleAdd()
      }}
    >
      <label className="flex w-full flex-col gap-1 text-xs text-muted sm:w-auto sm:flex-1">
        {strings.bingo.textHe}
        <input
          value={textHe}
          onChange={(event) => setTextHe(event.target.value)}
          placeholder={strings.bingo.placeholderHe}
          dir="rtl"
          lang="he"
          className={`w-full rounded border border-border px-2 py-2 text-foreground sm:min-w-48 md:py-1 ${INPUT_TEXT}`}
        />
      </label>
      <label className="flex w-full flex-col gap-1 text-xs text-muted sm:w-auto sm:flex-1">
        {strings.bingo.textRu}
        <input
          value={textRu}
          onChange={(event) => setTextRu(event.target.value)}
          placeholder={strings.bingo.placeholderRu}
          dir="ltr"
          lang="ru"
          className={`w-full rounded border border-border px-2 py-2 text-foreground sm:min-w-48 md:py-1 ${INPUT_TEXT}`}
        />
      </label>
      <button
        type="submit"
        disabled={adding}
        className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto md:min-h-0 md:py-1.5"
      >
        {adding ? strings.bingo.adding : `+ ${strings.bingo.addRow}`}
      </button>
    </form>
  )
}
