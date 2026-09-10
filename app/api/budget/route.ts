import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseCreateBudgetItem } from '@/lib/validation'
import { createBudgetItem, listBudgetItems } from '@/lib/data'

/**
 * Expenses and income (PRD §6.22).
 *
 * Every method re-verifies the session independently of proxy.ts — this is a
 * separate URL, reachable with curl without touching a page (PRD §7.4).
 */
export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(await listBudgetItems())
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = parseCreateBudgetItem(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    return ok(await createBudgetItem(parsed.value))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
