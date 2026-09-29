'use client'

/**
 * The bingo screen's state owner: the square list with optimistic edits, fed
 * to both the editor and the cards so a fixed typo shows on the cards at once.
 *
 * The patch map lives here, not in the editor's cells — the same lesson
 * components/admin/budget-table.tsx records: per-row state is lost whenever a
 * row unmounts, and comes back showing a stale value.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { BingoSquare, UpdateBingoSquareInput } from '@/lib/types'
import { BingoBoard } from '@/components/games/bingo-board'
import { BingoSquareEditor } from '@/components/games/bingo-square-editor'
import { strings } from '@/lib/strings'

export function BingoGame({
  squares,
  initialSeed,
}: {
  squares: BingoSquare[]
  initialSeed: number
}) {
  const router = useRouter()
  const [patches, setPatches] = useState<Record<string, UpdateBingoSquareInput>>({})
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const patched = useMemo(() => {
    if (Object.keys(patches).length === 0) return squares
    return squares.map((square) => (patches[square.id] ? { ...square, ...patches[square.id] } : square))
  }, [squares, patches])

  function markBusy(id: string, busy: boolean) {
    setBusyIds((current) => {
      const next = new Set(current)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** Applies the edit immediately, writes it, and restores `previous` on failure. */
  async function save(id: string, patch: UpdateBingoSquareInput, previous: UpdateBingoSquareInput) {
    setPatches((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
    markBusy(id, true)

    try {
      const response = await fetch(`/api/bingo-squares/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.bingo.saveFailed)
    } catch (thrown) {
      setPatches((current) => ({ ...current, [id]: { ...current[id], ...previous } }))
      toast.error(thrown instanceof Error ? thrown.message : strings.bingo.saveFailed)
    } finally {
      markBusy(id, false)
    }
  }

  async function remove(square: BingoSquare) {
    if (!window.confirm(strings.bingo.confirmDelete(square.text_he || square.text_ru))) return

    markBusy(square.id, true)
    try {
      const response = await fetch(`/api/bingo-squares/${square.id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!body.success) throw new Error(body.error || strings.bingo.deleteFailed)
      toast.success(strings.bingo.deleted)
      // Which rows exist changed, so the server list is refetched, not patched.
      router.refresh()
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : strings.bingo.deleteFailed)
    } finally {
      markBusy(square.id, false)
    }
  }

  return (
    <div className="space-y-6">
      <BingoSquareEditor
        squares={patched}
        busyIds={busyIds}
        onSave={save}
        onDelete={remove}
        onAdded={() => router.refresh()}
      />
      <BingoBoard squares={patched} initialSeed={initialSeed} />
    </div>
  )
}
