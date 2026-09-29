'use client'

/**
 * Opens WhatsApp with a message pre-filled (PRD §6.9) — the invitation, or the
 * reminder, day-of or thank-you message, as chosen in the invitee toolbar
 * (docs/whatsapp-rounds-PRD.md). A row the chosen message does not fit is
 * greyed out with the reason, rather than hidden, so the list stays the list.
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

import { startTransition, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { buildWhatsAppLink } from '@/lib/links'
import { renderForInvite } from '@/lib/templates'
import { formatShort } from '@/lib/datetime'
import { jsonInit, requestJson } from '@/lib/request'
import { sendBlock, templateFor, type SendKind } from '@/lib/send-kinds'
import { strings } from '@/lib/strings'
import type { Invite, WeddingConfig } from '@/lib/types'

export function WaSendButton({
  invite,
  config,
  kind = 'invite',
}: {
  invite: Invite
  config: WeddingConfig
  kind?: SendKind
}): React.JSX.Element {
  const [asking, setAsking] = useState(false)
  const record = useAction()

  const label = kind === 'invite' ? 'WhatsApp' : `WhatsApp · ${strings.actions.sendKindShort[kind]}`

  const block = sendBlock(invite, config, kind)
  if (block || !invite.phone) {
    return (
      <span
        className="rounded border border-border px-2 py-1 text-xs text-muted opacity-60"
        title={block === 'noPhone' || !block ? strings.actions.noPhone : strings.actions.blocked[block]}
      >
        {label}
      </span>
    )
  }

  const message = renderForInvite(templateFor(config, invite, kind), invite)
  const href = buildWhatsAppLink(invite.phone, message)

  const attemptsLabel =
    invite.contact_attempts > 0
      ? strings.actions.contactedCount(invite.contact_attempts)
      : strings.actions.neverContacted
  const lastLabel = invite.last_contacted_at
    ? `\n${strings.actions.lastContacted(formatShort(invite.last_contacted_at))}`
    : ''

  function confirmSent() {
    if (record.pending) return
    // The server decides what this records (lib/send-kinds.ts): only an
    // invitation or a reminder counts as an attempt.
    //
    // The prompt closes as a transition inside the action, so it goes away
    // together with the refresh — the row then already shows the new count
    // and status, never the stale ones.
    record.run(
      async () => {
        await requestJson(
          `/api/invites/${invite.id}/contacted`,
          jsonInit('POST', { template: kind }),
          strings.row.saveFailed
        )
        startTransition(() => setAsking(false))
      },
      {
        success: strings.actions.recorded,
        failure: strings.row.saveFailed,
        onError: () => setAsking(false),
      }
    )
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
          disabled={record.pending}
          aria-busy={record.pending}
          className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-white disabled:opacity-60"
        >
          {record.pending ? <Spinner /> : null}
          {strings.actions.yesSent}
        </button>
        <button
          type="button"
          onClick={declineSent}
          disabled={record.pending}
          className="rounded border border-border px-1.5 py-0.5 hover:bg-surface disabled:opacity-60"
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
      {label}
      {invite.contact_attempts > 0 ? (
        <span className="ltr-nums ms-1 text-muted">{invite.contact_attempts}</span>
      ) : null}
    </a>
  )
}
