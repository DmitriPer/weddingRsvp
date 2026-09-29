'use client'

/**
 * Pending state for a mutation that ends with a server refresh
 * (docs/error-loading-PRD.md §4.1).
 *
 * The bug this replaces: `setBusy(true); await fetch(); router.refresh();
 * setBusy(false)`. router.refresh() only STARTS the refresh, so the busy flag
 * cleared while the old data was still on screen — a seated guest still in the
 * unseated list, a deleted row still clickable, with no indicator.
 *
 * Here the request and the refresh run inside one React transition. `pending`
 * stays true until the refreshed server data has rendered, so the spinner
 * covers the whole wait and the control can't be pressed twice.
 *
 * The refresh is started in a nested startTransition because it happens after
 * an `await`: React only counts updates made after an await as part of the
 * action when they are wrapped again.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'

interface RunOptions {
  /** Refetch server data afterwards. Default true. */
  refresh?: boolean
  /** Toast shown on success. */
  success?: string
  /** Toast shown when the thrown error has no message of its own. */
  failure?: string
  /** Called after a failure, e.g. to roll back a local draft. */
  onError?: () => void
}

export interface Action {
  pending: boolean
  /** Runs `task`; never throws — failures become a toast and `onError`. */
  run: (task: () => Promise<unknown>, options?: RunOptions) => void
}

export function useAction(): Action {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(task: () => Promise<unknown>, options: RunOptions = {}): void {
    const { refresh = true, success, failure = strings.app.error, onError } = options

    startTransition(async () => {
      try {
        await task()
      } catch (thrown) {
        toast.error(thrown instanceof Error && thrown.message ? thrown.message : failure)
        onError?.()
        return
      }
      if (success) toast.success(success)
      if (refresh) startTransition(() => router.refresh())
    })
  }

  return { pending, run }
}
