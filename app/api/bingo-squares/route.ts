import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseCreateBingoSquare } from '@/lib/validation'
import { createBingoSquare, listBingoSquares } from '@/lib/data'

/**
 * Wedding-bingo squares (docs/games-bingo-PRD.md §3.5).
 *
 * Every method re-verifies the session independently of proxy.ts — this is a
 * separate URL, reachable with curl without touching a page (PRD §7.4).
 */
export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(await listBingoSquares())
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = parseCreateBingoSquare(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    return ok(await createBingoSquare(parsed.value))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
