import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { parseCreateTable } from '@/lib/validation'
import { createTable, listTables } from '@/lib/data'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(await listTables())
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = parseCreateTable(await readJson(request))
    if (!parsed.ok) return badRequest(parsed.error)

    return ok(await createTable(parsed.value))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
