'use client'

/**
 * First-invitation coordination on one row (PRD §6.21): did it go out, and who
 * is sending it.
 *
 * Deliberately NOT part of the send pipeline. `status` and `contact_attempts`
 * belong to the wa.me button (PRD §6.9, §6.10) and mean a message was actually
 * prepared and confirmed sent; these two mean the couple divided ~150
 * households between them and are ticking the list off.
 *
 * Stateless apart from its in-flight flag. The optimistic value lives in
 * InviteTable and arrives already merged into `invite`, because a row unmounts
 * whenever a filter hides it or the toolbar toggle is switched off — state held
 * here would be discarded on unmount and the row would come back reading
 * "not sent" over a send that did happen.
 */

import { useState } from 'react'
import { isKnownSender } from '@/lib/senders'
import { strings } from '@/lib/strings'
import type { Invite, InviteWithPeople } from '@/lib/types'

/** The two planning fields, and nothing else this component may write. */
export type FirstInvitePatch = Partial<Pick<Invite, 'first_invite_sent' | 'first_invite_sender'>>

export function FirstInviteControls({
  invite,
  senders,
  onPatch,
}: {
  /** Already carries any optimistic value from InviteTable. */
  invite: InviteWithPeople
  /** Split out of wedding_config.couple_names by the table (lib/senders.ts). */
  senders: string[]
  /**
   * Owns the optimistic value, the write and its failure handling, so it never
   * rejects — the row only needs to know when it is in flight.
   */
  onPatch: (id: string, patch: FirstInvitePatch, previous: FirstInvitePatch) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const sent = invite.first_invite_sent
  const sender = invite.first_invite_sender

  async function apply(patch: FirstInvitePatch, previous: FirstInvitePatch) {
    setSaving(true)
    try {
      await onPatch(invite.id, patch, previous)
    } finally {
      // In a finally so a rejection can never strand the row disabled.
      setSaving(false)
    }
  }

  /*
   * An already-stored name that is no longer offered stays in the list.
   *
   * The options are derived from couple_names at render time while the column
   * holds free text, so renaming the couple in /admin/settings can orphan a
   * value saved here. Keeping the orphan visible beats a <select> silently
   * showing "לא נקבע" over a decision that was in fact recorded.
   */
  const options = sender && !isKnownSender(sender, senders) ? [...senders, sender] : senders

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2 text-sm">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={sent}
          disabled={saving}
          onChange={(event) =>
            void apply({ first_invite_sent: event.target.checked }, { first_invite_sent: sent })
          }
        />
        {strings.firstInvite.sent}
      </label>

      {/*
        Shown whenever there is something to show OR something already stored.
        Hiding it on an unconfigured couple_names would make an existing sender
        invisible and impossible to clear — the orphan rule above, inverted.
      */}
      {options.length > 0 ? (
        <label className="flex items-center gap-1.5 text-muted">
          {strings.firstInvite.sender}
          <select
            value={sender ?? ''}
            disabled={saving}
            onChange={(event) =>
              // '' is the "לא נקבע" option: undecided, stored as null.
              void apply(
                { first_invite_sender: event.target.value || null },
                { first_invite_sender: sender }
              )
            }
            className="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="">{strings.firstInvite.notSet}</option>
            {options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
