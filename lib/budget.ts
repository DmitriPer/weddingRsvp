/**
 * The budget's arithmetic (PRD §6.22). Pure — items and headcounts in,
 * numbers out.
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

/**
 * The two headcounts a per-guest line can be multiplied by.
 *
 * `invited` is everyone on the list — the planning figure, usable before a
 * single answer arrives. `attending` is the confirmed headcount, which is 0
 * until people start responding. Both come from lib/stats.ts, which gets them
 * from lib/headcount.ts; this module never counts anyone itself.
 */
export interface BudgetHeadcounts {
  invited: number
  attending: number
}

/** A flat line ignores the headcount entirely — that is the whole distinction. */
function fullPrice(item: BudgetItem, headcount: number): number {
  return item.pricing === 'per_person' ? item.amount * headcount : item.amount
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

/** One line, resolved on both bases. */
export function budgetLine(item: BudgetItem, headcounts: BudgetHeadcounts): BudgetLine {
  const plannedFull = fullPrice(item, headcounts.invited)
  const confirmedFull = fullPrice(item, headcounts.attending)

  return {
    item,
    plannedFull,
    confirmedFull,
    plannedToPay: toPay(plannedFull, item.paid_in_advance),
    confirmedToPay: toPay(confirmedFull, item.paid_in_advance),
  }
}

export function budgetLines(items: BudgetItem[], headcounts: BudgetHeadcounts): BudgetLine[] {
  return items.map((item) => budgetLine(item, headcounts))
}

/**
 * The four tiles.
 *
 * Note that `toPay` counts EXPENSES only. Income that hasn't arrived yet is
 * money you are owed, not money you owe, and adding the two together would
 * produce a number that means nothing.
 */
export function computeBudgetTotals(
  items: BudgetItem[],
  headcounts: BudgetHeadcounts
): BudgetTotals {
  let plannedExpenses = 0
  let confirmedExpenses = 0
  let plannedIncome = 0
  let confirmedIncome = 0
  let plannedToPay = 0
  let confirmedToPay = 0

  for (const line of budgetLines(items, headcounts)) {
    if (line.item.kind === 'expense') {
      plannedExpenses += line.plannedFull
      confirmedExpenses += line.confirmedFull
      plannedToPay += line.plannedToPay
      confirmedToPay += line.confirmedToPay
    } else {
      plannedIncome += line.plannedFull
      confirmedIncome += line.confirmedFull
    }
  }

  return {
    plannedExpenses,
    confirmedExpenses,
    plannedIncome,
    confirmedIncome,
    plannedBalance: plannedIncome - plannedExpenses,
    confirmedBalance: confirmedIncome - confirmedExpenses,
    plannedToPay,
    confirmedToPay,
  }
}

/**
 * Whether a line's two bases differ — i.e. whether showing the second figure
 * tells the reader anything. False for every flat line, and also for a
 * per-guest line once the confirmed headcount reaches the invited one.
 */
export function hasDistinctBases(line: BudgetLine): boolean {
  return line.plannedFull !== line.confirmedFull
}
