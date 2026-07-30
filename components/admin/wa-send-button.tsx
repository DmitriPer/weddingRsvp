'use client'

/**
 * Opens WhatsApp with the invite message pre-filled (PRD §6.9).
 *
 * IT DOES NOT SEND. It opens WhatsApp; a human taps send there. No queue, no
 * schedule, no batch — this protects the couple's number from being flagged
 * (PRD §3.1), and is not a limitation to engineer around.
 *
 * Tapping it is also the ONLY thing that marks a guest as contacted: it
 * increments contact_attempts, sets last_contacted_at, and moves added →
 * pending (PRD §6.10).
 *
 * A plain <a target="_blank"> rather than window.open() after an await —
 * browsers block popups opened asynchronously, which would silently break the
 * one action this whole screen exists for.
 */

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { buildWhatsAppLink } from '@/lib/links'
import { renderForInvite } from '@/lib/templates'
import { formatShort } from '@/lib/datetime'
import { strings } from '@/lib/strings'
import type { Invite } from '@/lib/types'

export function WaSendButton({ invite, template }: { invite: Invite; template: string }) {
  const router = useRouter()

  if (!invite.phone) {
    return (
      <span className="rounded border border-border px-2 py-1 text-xs text-muted" title={strings.actions.noPhone}>
        WhatsApp
      </span>
    )
  }

  const message = renderForInvite(template, invite)
  const href = buildWhatsAppLink(invite.phone, message)

  const attemptsLabel =
    invite.contact_attempts > 0
      ? strings.actions.contactedCount(invite.contact_attempts)
      : strings.actions.neverContacted
  const lastLabel = invite.last_contacted_at
    ? `\n${strings.actions.lastContacted(formatShort(invite.last_contacted_at))}`
    : ''

  async function recordContact() {
    const response = await fetch(`/api/invites/${invite.id}/contacted`, { method: 'POST' })
    const body = await response.json()
    if (!body.success) {
      // WhatsApp already opened — say so rather than pretend it was recorded.
      toast.error(body.error || strings.row.saveFailed)
      return
    }
    router.refresh()
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={recordContact}
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
