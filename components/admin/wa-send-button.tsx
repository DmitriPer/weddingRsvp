'use client'

/**
 * Opens WhatsApp with the invite message pre-filled (PRD §6.9).
 *
 * IT DOES NOT SEND. It opens WhatsApp; a human taps send there. No queue, no
 * schedule, no batch — this protects the couple's number from being flagged
 * (PRD §3.1), and is not a limitation to engineer around.
 *
 * WhatsApp gives no callback, so the app cannot know whether send was actually
 * pressed. It therefore ASKS. Clicking opens the chat and shows "נשלח?" on the
 * row; nothing is recorded until that is answered.
 *
 * This matters because contact_attempts drives the "needs a phone call" flag
 * (PRD §6.10) and the status move added → pending. Counting an opened-then-
 * abandoned chat would inflate both, and the follow-up list would claim people
 * were contacted when they were not.
 *
 * A plain <a target="_blank"> rather than window.open() after an await —
 * browsers block popups opened asynchronously, which would silently break the
 * one action this screen exists for.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { buildWhatsAppLink } from '@/lib/links'
import { renderForInvite } from '@/lib/templates'
import { formatShort } from '@/lib/datetime'
import { strings } from '@/lib/strings'
import type { Invite, WeddingConfig } from '@/lib/types'

/** The invite template for this household's language. */
function templateFor(config: WeddingConfig, invite: Invite): string {
  return invite.language === 'ru'
    ? config.invite_message_template_ru
    : config.invite_message_template_he
}

export function WaSendButton({ invite, config }: { invite: Invite; config: WeddingConfig }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!invite.phone) {
    return (
      <span
        className="rounded border border-border px-2 py-1 text-xs text-muted"
        title={strings.actions.noPhone}
      >
        WhatsApp
      </span>
    )
  }

  const message = renderForInvite(templateFor(config, invite), invite)
  const href = buildWhatsAppLink(invite.phone, message)

  const attemptsLabel =
    invite.contact_attempts > 0
      ? strings.actions.contactedCount(invite.contact_attempts)
      : strings.actions.neverContacted
  const lastLabel = invite.last_contacted_at
    ? `\n${strings.actions.lastContacted(formatShort(invite.last_contacted_at))}`
    : ''

  async function confirmSent() {
    setSaving(true)
    const response = await fetch(`/api/invites/${invite.id}/contacted`, { method: 'POST' })
    const body = await response.json()
    setSaving(false)
    setAsking(false)

    if (!body.success) {
      toast.error(body.error || strings.row.saveFailed)
      return
    }
    toast.success(strings.actions.recorded)
    router.refresh()
  }

  function declineSent() {
    setAsking(false)
    toast.info(strings.actions.notRecorded)
  }

  // The question replaces the button, so there is no way to double-count by
  // clicking again while it is open.
  if (asking) {
    return (
      <span className="flex items-center gap-1 rounded border border-warning px-2 py-1 text-xs">
        <span className="text-muted">{strings.actions.didYouSend}</span>
        <button
          type="button"
          onClick={confirmSent}
          disabled={saving}
          className="rounded bg-accent px-1.5 py-0.5 text-white disabled:opacity-60"
        >
          {strings.actions.yesSent}
        </button>
        <button
          type="button"
          onClick={declineSent}
          disabled={saving}
          className="rounded border border-border px-1.5 py-0.5 hover:bg-surface"
        >
          {strings.actions.notSent}
        </button>
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setAsking(true)}
      title={`${strings.actions.sendWhatsApp}\n${attemptsLabel}${lastLabel}`}
      className="rounded border border-border px-2 py-1 text-xs text-accent hover:bg-surface"
    >
      WhatsApp
      {invite.contact_attempts > 0 ? (
        <span className="ltr-nums ms-1 text-muted">{invite.contact_attempts}</span>
      ) : null}
    </a>
  )
}
