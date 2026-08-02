'use client'

/** Copies a guest's personal invite link, for anyone not on WhatsApp (PRD §6.8). */

import { useState } from 'react'
import { toast } from 'sonner'
import { buildInviteLink } from '@/lib/links'
import { strings } from '@/lib/strings'
import type { Language } from '@/lib/types'

export function CopyLinkButton({ token, language }: { token: string; language: Language }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildInviteLink(token, language))
      setCopied(true)
      toast.success(strings.actions.linkCopied)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access needs a secure context; it fails on plain http hosts.
      toast.error(strings.actions.copyFailed)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={strings.actions.copyLink}
      className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
    >
      {copied ? '✓' : strings.actions.copyLink}
    </button>
  )
}
