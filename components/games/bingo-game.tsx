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
import { toast } from 'sonner'
import { jsonInit, requestJson } from '@/lib/request'
import type { BingoSquare, UpdateBingoSquareInput } from '@/lib/types'
import { BingoBoard } from '@/components/games/bingo-board'
import { BingoSquareEditor } from '@/components/games/bingo-square-editor'
import { useAction } from '@/components/ui/use-action'
import { strings } from '@/lib/strings'

export function BingoGame({
  squares,
  initialSeed,
}: {
  squares: BingoSquare[]
  initialSeed: number
}): React.JSX.Element {
  const [patches, setPatches] = useState<Record<string, UpdateBingoSquareInput>>({})
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  // One delete at a time: the row stays disabled, with a spinner, until the
  // refreshed list no longer contains it.
  const deletion = useAction()
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      await requestJson(`/api/bingo-squares/${id}`, jsonInit('PATCH', patch), strings.bingo.saveFailed)
    } catch (thrown) {
      setPatches((current) => ({ ...current, [id]: { ...current[id], ...previous } }))
      toast.error(thrown instanceof Error ? thrown.message : strings.bingo.saveFailed)
    } finally {
      markBusy(id, false)
    }
  }

  function remove(square: BingoSquare): void {
    if (!window.confirm(strings.bingo.confirmDelete(square.text_he || square.text_ru))) return

    setDeletingId(square.id)
    // Which rows exist changed, so the server list is refetched, not patched.
    deletion.run(
      () =>
        requestJson(`/api/bingo-squares/${square.id}`, jsonInit('DELETE'), strings.bingo.deleteFailed),
      { success: strings.bingo.deleted, failure: strings.bingo.deleteFailed }
    )
  }

  return (
    <div className="space-y-6">
      <BingoSquareEditor
        squares={patched}
        busyIds={busyIds}
        deletingId={deletion.pending ? deletingId : null}
        onSave={save}
        onDelete={remove}
      />
      <BingoBoard squares={patched} initialSeed={initialSeed} />
    </div>
  )
}
