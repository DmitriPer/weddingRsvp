import { fromThrown, ok, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { listInvites } from '@/lib/data'
import { computeStats } from '@/lib/stats'

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(computeStats(await listInvites()))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
