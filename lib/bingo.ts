/**
 * Wedding-bingo card dealing (docs/games-bingo-PRD.md §3.3–3.4). Pure: no React,
 * no I/O.
 *
 * Seeded, not Math.random. The bingo page renders on the server and again on
 * the client; an unseeded shuffle would deal different cards each time and
 * React would throw a hydration mismatch. The server picks the seed, both
 * renders deal from it, and "new shuffle" just picks another.
 *
 * Dealing and language are separate steps. A deal is a shuffled order of ALL
 * square ids per card; the language only filters that order. So switching
 * language never reshuffles, and in "both" mode the Hebrew card and its
 * Russian twin read the same filtered order — same squares, same spots.
 */

import type { BingoSquare } from '@/lib/types'

export type BingoLanguage = 'he' | 'ru'
export type BingoMode = BingoLanguage | 'both'

export const BINGO_MODES: readonly BingoMode[] = ['he', 'ru', 'both'] as const

/** 5×5 minus the free centre. */
export const SQUARES_PER_CARD = 24
export const MIN_CARDS = 1
export const MAX_CARDS = 80
export const DEFAULT_CARDS = 20

export interface BingoCard {
  /** Stable across language switches: card index plus language. */
  key: string
  language: BingoLanguage
  squares: BingoSquare[]
}

/** mulberry32 — tiny, fast, and deterministic for a given 32-bit seed. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates on a copy. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** A fresh 32-bit seed, for the shuffle button. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}

export function clampCardCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CARDS
  return Math.min(MAX_CARDS, Math.max(MIN_CARDS, Math.round(value)))
}

/** A square is on a card only if it has text in every language that card shows. */
export function isUsable(square: BingoSquare, mode: BingoMode): boolean {
  if (mode === 'he') return square.text_he !== ''
  if (mode === 'ru') return square.text_ru !== ''
  return square.text_he !== '' && square.text_ru !== ''
}

export function countUsable(squares: readonly BingoSquare[], mode: BingoMode): number {
  return squares.filter((square) => isUsable(square, mode)).length
}

/**
 * One shuffled order per card. Cards are dealt in sequence from one generator,
 * so raising the count adds cards without reshuffling the ones already dealt.
 */
export function dealOrders(squares: readonly BingoSquare[], count: number, seed: number): BingoSquare[][] {
  const random = seededRandom(seed)
  return Array.from({ length: count }, () => shuffle(squares, random))
}

/**
 * The 24 squares for one card. Fewer usable squares than that repeats them,
 * as the original page did — the page warns when that happens.
 */
function fillCard(order: readonly BingoSquare[], mode: BingoMode): BingoSquare[] {
  const usable = order.filter((square) => isUsable(square, mode))
  if (usable.length === 0) return []
  return Array.from({ length: SQUARES_PER_CARD }, (_, i) => usable[i % usable.length])
}

/**
 * The printed cards, in print order. "both" interleaves each Hebrew card with
 * its Russian twin, so a matching pair comes off the printer together.
 */
export function buildCards(orders: readonly BingoSquare[][], mode: BingoMode): BingoCard[] {
  const languages: BingoLanguage[] = mode === 'both' ? ['he', 'ru'] : [mode]
  return orders.flatMap((order, index) => {
    const squares = fillCard(order, mode)
    if (squares.length === 0) return []
    return languages.map((language) => ({ key: `${index}-${language}`, language, squares }))
  })
}
