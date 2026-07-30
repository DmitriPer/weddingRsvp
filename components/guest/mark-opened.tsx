'use client'

/**
 * Reports that a real person opened the invitation (PRD §6.15).
 *
 * This MUST stay client-side. Sending one invite triggers two non-human fetches
 * — WhatsApp reads the page's meta tags and its OG image to build the preview
 * card — so marking `opened` during server rendering would flip every invite
 * the moment it was SENT, destroying the "who hasn't looked yet" filter the
 * follow-up workflow (§6.10) depends on entirely. Crawlers fetch HTML; they do
 * not execute JavaScript.
 *
 * Renders nothing.
 */

import { useEffect, useRef } from 'react'

interface MarkOpenedProps {
  inviteId: string
  /** Already answered — status never moves backwards, so the call is noise. */
  skip?: boolean
}

export function MarkOpened({ inviteId, skip = false }: MarkOpenedProps) {
  const reported = useRef(false)

  useEffect(() => {
    if (skip || reported.current) return
    // StrictMode runs effects twice in development; once is enough.
    reported.current = true

    // Best effort by design: a failed status update must never break, block or
    // even be visible on the guest's page.
    void fetch(`/api/invites/${inviteId}/opened`, { method: 'POST' }).catch(() => {})
  }, [inviteId, skip])

  return null
}
