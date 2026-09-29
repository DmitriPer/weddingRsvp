'use client'

/**
 * Error boundary for /games (docs/error-loading-PRD.md). Renders inside the
 * games layout, so the header and navigation stay usable. Next 16 names the
 * retry prop `unstable_retry`: it re-fetches and re-renders this segment.
 */

import { RouteError } from '@/components/ui/route-error'

export default function GamesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <RouteError error={error} retry={unstable_retry} />
}
