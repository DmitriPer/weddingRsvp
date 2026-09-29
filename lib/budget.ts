/**
 * The budget's arithmetic (PRD §6.22, docs/budget-min-guests-PRD.md). Pure —
 * items and a headcount basis in, numbers out.
 *
 * This is the ONLY place a full price or a remaining balance is worked out,
 * for the same reason lib/headcount.ts is the only place people are counted:
 * a second `amount * count` somewhere else is a second definition of what a
 * caterer charges, and the first thing to disagree with the caterer.
 *
 * Nothing here is stored. A per-guest line's full price depends on the guest
 * list, which changes every time an RSVP lands, so a stored copy would be
 * stale within the hour with nothing to say so (PRD §5.1, same reasoning).
 *
 * Every figure is in AGOROT (lib/money.ts) and stays an integer throughout:
 * price × headcount is exact integer multiplication, and the sums are exact
 * additions, so the total cannot drift by an agora.
 */

import type { BudgetItem, BudgetLine, BudgetTotals } from '@/lib/types'

/** Used until migration 016 has run and the config row carries its own value. */
export const DEFAULT_MIN_GUESTS = 120

/**
 * What a per-guest line is multiplied by.
 *
 * `attending` is everyone who said yes, adults and kids, from lib/stats.ts via
 * lib/headcount.ts — this module never counts anyone itself. `minGuests` is
 * כמות התחייבות, the number the venue bills no matter the turnout.
 *
 * There is deliberately no "everyone invited" figure any more: the contract
 * minimum replaces it as the planning floor.
 */
export interface BudgetBasis {
  attending: number
  minGuests: number
}

/**
 * The people a per-guest line is billed for.
 *
 * An EXPENSE is billed for the approved count but never below the minimum:
 * 100 approved with a 120 minimum pays for 120; 125 approved pays for 125.
 *
 * INCOME is never floored: a per-guest income line (a gift estimate, say)
 * counts the people actually coming. Flooring it would book 20 phantom
 * guests' gifts against the real bill.
 */
function billedGuests(item: BudgetItem, basis: BudgetBasis): number {
  if (item.kind === 'income') return basis.attending
  return Math.max(basis.attending, basis.minGuests)
}

/** A flat line ignores the headcount entirely — that is the whole distinction. */
function fullPrice(item: BudgetItem, basis: BudgetBasis): number {
  return item.pricing === 'per_person' ? item.amount * billedGuests(item, basis) : item.amount
}

/**
 * What is left to hand over.
 *
 * Clamped at zero: overpaying is a data-entry mistake, and a line reading
 * "−₪500 still to pay" would quietly subtract from the total owed on every
 * other line, understating what the couple actually has to find. A negative
 * balance belongs in a conversation with the supplier, not in a sum.
 */
function toPay(full: number, paidInAdvance: number): number {
  return Math.max(0, full - paidInAdvance)
}

export function budgetLine(item: BudgetItem, basis: BudgetBasis): BudgetLine {
  const full = fullPrice(item, basis)
  return { item, full, toPay: toPay(full, item.paid_in_advance) }
}

export function budgetLines(items: BudgetItem[], basis: BudgetBasis): BudgetLine[] {
  return items.map((item) => budgetLine(item, basis))
}

/**
 * The four tiles.
 *
 * Note that `toPay` counts EXPENSES only. Income that hasn't arrived yet is
 * money you are owed, not money you owe, and adding the two together would
 * produce a number that means nothing.
 */
export function computeBudgetTotals(items: BudgetItem[], basis: BudgetBasis): BudgetTotals {
  let expenses = 0
  let income = 0
  let owed = 0

  for (const line of budgetLines(items, basis)) {
    if (line.item.kind === 'expense') {
      expenses += line.full
      owed += line.toPay
    } else {
      income += line.full
    }
  }

  return { expenses, income, balance: income - expenses, toPay: owed }
}
