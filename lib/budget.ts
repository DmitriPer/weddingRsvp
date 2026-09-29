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
 * Who a per-guest line is priced for — the three age groups of the people who
 * said yes (docs/child-age-pricing-PRD.md), from lib/stats.ts via
 * lib/headcount.ts; this module never counts anyone itself.
 *
 *   adults    7+    the line's price; the ONLY group the minimum applies to
 *   children  3–7   the line's child price (or its adult price when unset)
 *   infants   0–3   free
 *
 * `minGuests` is כמות התחייבות: the venue bills at least this many ADULT
 * plates whatever the turnout. There is deliberately no "everyone invited"
 * figure: the contract minimum is the planning floor.
 */
export interface BudgetBasis {
  adults: number
  children: number
  infants: number
  minGuests: number
}

/** Everyone coming, all ages — what a per-guest INCOME line counts. */
export function attendingTotal(basis: BudgetBasis): number {
  return basis.adults + basis.children + basis.infants
}

/**
 * A per-guest line's full price.
 *
 * EXPENSE: adult plates are billed for the approved adults but never below the
 * minimum (100 approved, minimum 120 → 120 plates; 125 → 125); children 3–7 at
 * the child price, which defaults to the adult price when the line has none;
 * infants free. 100 adults + 10 children + 5 infants at ₪470 / ₪200 with a 120
 * minimum = 120×470 + 10×200 = ₪58,400.
 *
 * INCOME is never floored and has no child price: a per-guest income line (a
 * gift estimate, say) counts the people actually coming.
 */
function perPersonPrice(item: BudgetItem, basis: BudgetBasis): number {
  if (item.kind === 'income') return item.amount * attendingTotal(basis)
  const adultPlates = Math.max(basis.adults, basis.minGuests)
  const childPrice = item.child_amount ?? item.amount
  return item.amount * adultPlates + childPrice * basis.children
}

/** A flat line ignores the headcount entirely — that is the whole distinction. */
function fullPrice(item: BudgetItem, basis: BudgetBasis): number {
  return item.pricing === 'per_person' ? perPersonPrice(item, basis) : item.amount
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
