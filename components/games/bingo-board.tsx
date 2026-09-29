'use client'

/**
 * The bingo controls and the printable cards (docs/games-bingo-PRD.md §3.3).
 *
 * Count, language and seed are page state only — nothing here is saved. The
 * deal is derived, not stored: same squares + count + seed always produce the
 * same cards, so the server render and the client render agree, and switching
 * language re-filters the same deal instead of reshuffling it (lib/bingo.ts).
 */

import { useMemo, useState } from 'react'
import {
  BINGO_MODES,
  DEFAULT_CARDS,
  MAX_CARDS,
  MIN_CARDS,
  SQUARES_PER_CARD,
  buildCards,
  clampCardCount,
  countUsable,
  dealOrders,
  newSeed,
  type BingoMode,
} from '@/lib/bingo'
import type { BingoSquare } from '@/lib/types'
import { EmptyState } from '@/components/ui/states'
import { BingoCard } from '@/components/games/bingo-card'
import { strings } from '@/lib/strings'
import styles from './bingo-card.module.css'

/** 16px on phones: iOS Safari zooms the page into any focused field smaller than that. */
const INPUT_TEXT = 'text-base md:text-sm'
/** 44px tap targets on phones (WCAG 2.5.5); the desktop sizes are unchanged. */
const BUTTON_SIZE = 'min-h-11 flex-1 px-4 sm:flex-none md:min-h-0 md:py-1.5'

export function BingoBoard({
  squares,
  initialSeed,
}: {
  squares: BingoSquare[]
  initialSeed: number
}) {
  const [seed, setSeed] = useState(initialSeed)
  // The field keeps what is typed (even an empty box mid-edit); the clamped
  // number is derived, so clearing the box to type "40" doesn't snap to 20.
  const [countInput, setCountInput] = useState(String(DEFAULT_CARDS))
  const [mode, setMode] = useState<BingoMode>('he')

  const count = clampCardCount(Number(countInput))
  const orders = useMemo(() => dealOrders(squares, count, seed), [squares, count, seed])
  const cards = useMemo(() => buildCards(orders, mode), [orders, mode])
  const usable = countUsable(squares, mode)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface px-4 py-3 print:hidden">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {strings.bingo.count}
          <input
            type="number"
            min={MIN_CARDS}
            max={MAX_CARDS}
            value={countInput}
            onChange={(event) => setCountInput(event.target.value)}
            onBlur={() => setCountInput(String(count))}
            className={`w-20 rounded border border-border bg-background px-2 py-2 text-center text-foreground ltr-nums md:py-1 ${INPUT_TEXT}`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {strings.bingo.language}
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as BingoMode)}
            className={`rounded border border-border bg-background px-2 py-2 text-foreground md:py-1 ${INPUT_TEXT}`}
          >
            {BINGO_MODES.map((value) => (
              <option key={value} value={value}>
                {strings.bingo.languages[value]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setSeed(newSeed())}
          className={`rounded-md bg-accent text-sm font-medium text-white hover:opacity-90 ${BUTTON_SIZE}`}
        >
          {strings.bingo.shuffle}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={cards.length === 0}
          className={`rounded-md border border-border text-sm hover:bg-background disabled:opacity-50 ${BUTTON_SIZE}`}
        >
          {strings.bingo.print}
        </button>

        <p className="w-full text-sm text-muted sm:ms-auto sm:w-auto">{strings.bingo.printCount(cards.length)}</p>
      </div>

      {usable > 0 && usable < SQUARES_PER_CARD ? (
        <p role="status" className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning print:hidden">
          {strings.bingo.tooFew(usable)}
        </p>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState title={strings.bingo.noCards} hint={strings.bingo.noCardsHint} />
      ) : (
        <div id="bingo-cards" className={`${styles.sheet} scroll-mt-4`}>
          {cards.map((card) => (
            <BingoCard key={card.key} language={card.language} squares={card.squares} />
          ))}
        </div>
      )}
    </section>
  )
}
