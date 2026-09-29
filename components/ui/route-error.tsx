'use client'

/**
 * The admin-side error screen (docs/error-loading-PRD.md), shared by
 * app/admin/error.tsx and app/games/error.tsx.
 *
 * It renders INSIDE the segment's layout, so the header and tabs above it keep
 * working: a broken tab is a message and a retry button, never a dead page.
 *
 * In production a server error arrives with its message stripped (Next hides
 * it so nothing sensitive leaks) and only a `digest`. The digest is shown so a
 * failure on the live site can be matched to its entry in the server logs.
 */

import { ErrorState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

export function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="mx-auto max-w-xl">
      <ErrorState onRetry={retry} />
      {error.digest ? (
        <p className="ltr-nums text-center text-xs text-muted">
          {strings.app.errorCode(error.digest)}
        </p>
      ) : null}
    </div>
  )
}
