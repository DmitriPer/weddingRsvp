/**
 * Budget tab — expenses and income (PRD §6.22).
 *
 * Reads the lines and the guest list, works out the totals, and renders. The
 * guest list is needed because a per-guest line's price is multiplied by the
 * headcount, and this page must never count anyone itself: the numbers come
 * from computeStats -> lib/headcount.ts, the single definition of "attending".
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { listBudgetItems, listInvites } from '@/lib/data'
import { computeBudgetTotals, type BudgetHeadcounts } from '@/lib/budget'
import { computeStats } from '@/lib/stats'
import { BudgetTable } from '@/components/admin/budget-table'
import { BudgetTotalsBar } from '@/components/admin/budget-totals'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export default async function BudgetPage() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const [items, invites] = await Promise.all([listBudgetItems(), listInvites()])

  const stats = computeStats(invites)
  const headcounts: BudgetHeadcounts = {
    // People, not invitations: a caterer charges per plate.
    invited: stats.totalInvitedPeople,
    attending: stats.totalAttending,
  }

  const totals = computeBudgetTotals(items, headcounts)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{strings.budget.title}</h1>
        <p className="text-sm text-muted">{strings.budget.hint}</p>
      </div>

      <BudgetTotalsBar totals={totals} />

      {/* The empty state lives inside the table, so the add row is always there. */}
      <BudgetTable items={items} headcounts={headcounts} />
    </div>
  )
}
