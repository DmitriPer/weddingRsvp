/**
 * Shown inside the games layout while a page's server data loads
 * (docs/error-loading-PRD.md): the tabs respond at once instead of the old
 * page sitting frozen until the new one is ready.
 */

import { LoadingState } from '@/components/ui/states'

export default function GamesLoading() {
  return <LoadingState />
}
