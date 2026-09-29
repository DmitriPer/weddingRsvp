/**
 * Wedding bingo (docs/games-bingo-PRD.md): the square list, and cards dealt
 * from it for printing on A5.
 */

import { randomInt } from 'node:crypto'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { listBingoSquares } from '@/lib/data'
import { BingoGame } from '@/components/games/bingo-game'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: strings.bingo.title }

export default async function BingoPage() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const squares = await listBingoSquares()

  // Picked here and handed down, so the server render and the client's
  // hydration deal the same cards (lib/bingo.ts).
  const initialSeed = randomInt(0, 2 ** 32 - 1)

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold">{strings.bingo.title}</h2>
        <p className="text-sm text-muted">{strings.bingo.hint}</p>
      </div>

      <BingoGame squares={squares} initialSeed={initialSeed} />
    </div>
  )
}
