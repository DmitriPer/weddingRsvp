'use client'

/**
 * Error boundary for the guest page (docs/error-loading-PRD.md). /admin and
 * /games have their own, closer boundaries, so in practice this catches the
 * invitation page only.
 *
 * Bilingual on purpose: the page failed, so the household's language may
 * never have loaded (components/ui/bilingual-error.tsx).
 *
 * No guest loading.tsx beside it: a loading screen would flash in front of the
 * invitation artwork on every open from WhatsApp, and would change how the page
 * streams — the page whose metadata builds the WhatsApp preview card.
 */

import { BilingualError } from '@/components/ui/bilingual-error'

export default function GuestError({ unstable_retry }: { unstable_retry: () => void }) {
  return <BilingualError onRetry={unstable_retry} />
}
