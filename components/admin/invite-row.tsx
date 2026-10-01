'use client'

/**
 * One invitation in the list: summary, expand, edit, delete.
 *
 * The attendance line shows how many are INVITED before anyone answers, and how
 * many are COMING after — showing only the attending count made every new
 * invite read "0 guests" (lib/headcount.ts summarizeAttendance).
 */

import { useState } from 'react'
import { AttendeeList } from '@/components/admin/attendee-list'
import { CopyLinkButton } from '@/components/admin/copy-link-button'
import { HistoryModal } from '@/components/admin/history-modal'
import { InviteEditForm } from '@/components/admin/invite-edit-form'
import { WaSendButton } from '@/components/admin/wa-send-button'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import type { SendKind } from '@/lib/send-kinds'
import { summarizeAttendance } from '@/lib/headcount'
import { jsonInit, requestJson } from '@/lib/request'
import { needsPhoneCall } from '@/lib/status'
import { strings } from '@/lib/strings'
import type { InviteWithPeople, WeddingConfig } from '@/lib/types'

/** Null when neither is set — the line is then omitted entirely rather than shown empty. */
function sideRelationLabel(invite: InviteWithPeople): string | null {
  const side = invite.side ? strings.side[invite.side] : null
  const relation = invite.relation ? strings.relation[invite.relation] : null
  if (!side && !relation) return null
  return [side, relation].filter(Boolean).join(' · ')
}

function attendanceLabel(invite: InviteWithPeople): string {
  const summary = summarizeAttendance(invite.answer, invite.attendees)
  const labels = strings.guests.summary

  switch (summary.kind) {
    case 'noPeople':
      return labels.noPeople
    case 'awaiting':
      return labels.awaiting(summary.invited)
    case 'undecided':
      return labels.undecided(summary.invited)
    case 'declined':
      return labels.declined(summary.invited)
    case 'coming':
      return labels.coming(summary.coming, summary.invited, summary.undecided)
  }
}

export function InviteRow({
  invite,
  config,
  selected,
  onToggleSelected,
  sendKind,
}: {
  invite: InviteWithPeople
  config: WeddingConfig
  /** The toolbar's שליחה mode: which message the WhatsApp button prepares. */
  sendKind: SendKind
  selected: boolean
  onToggleSelected: (id: string) => void
  /** The toolbar's toggle (PRD §6.21). Off is the normal state of this screen. */
  /** Owned by InviteTable: a row unmounts, so it cannot hold this state. */
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const remove = useAction()

  const flagged = needsPhoneCall(invite.status, invite.contact_attempts)
  const sideRelation = sideRelationLabel(invite)

  function handleDelete() {
    if (remove.pending) return
    // Cascades to every person and the whole history, with no undo (PRD §6.6).
    if (!window.confirm(strings.row.confirmDelete(invite.name))) return

    // Pending lasts until the refreshed list no longer has this row, so the
    // button never re-enables on a row that is already gone.
    remove.run(
      () => requestJson(`/api/invites/${invite.id}`, jsonInit('DELETE'), strings.row.deleteFailed),
      { success: strings.row.deleted, failure: strings.row.deleteFailed }
    )
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 md:flex-nowrap md:justify-start">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelected(invite.id)}
          aria-label={invite.name}
          className="mt-1 shrink-0"
        />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-2 text-start md:w-72 md:flex-none"
          aria-expanded={expanded}
        >
          <span className="mt-0.5 shrink-0 text-muted">{expanded ? '▾' : '◂'}</span>
          <span className="min-w-0">
            <span className="block truncate">{invite.name}</span>
            <span className="ltr-nums block truncate text-sm text-muted">
              {invite.phone ?? '—'}
            </span>
            {sideRelation ? (
              <span className="block truncate text-sm text-muted">{sideRelation}</span>
            ) : null}
          </span>
        </button>

        <div className="shrink-0 text-end text-sm md:w-48 md:text-start">
          <p className="text-muted">
            {strings.status[invite.status]}
            {invite.language !== 'he' ? (
              <span className="ms-1 rounded border border-border px-1 text-xs">
                {strings.language.badge[invite.language]}
              </span>
            ) : null}
          </p>
          <p className="text-muted">{attendanceLabel(invite)}</p>
          {flagged ? <p className="text-warning">{strings.guests.needsPhoneCall}</p> : null}
        </div>

        {/* Own full-width line below md: five buttons that never shrink need
            ~350px, which pushed the whole page sideways on a phone. From md
            up, fixed name and status columns put them right beside the status
            instead of across the screen from the name. */}
        <div className="flex basis-full flex-wrap justify-start gap-1 md:basis-auto md:flex-1">
          <WaSendButton invite={invite} config={config} kind={sendKind} />
          {/* Only on flagged rows, so it reads as a to-do. Opens the dialer and
              records nothing: the app cannot know whether the call connected. */}
          {flagged && invite.phone ? (
            <a
              href={`tel:${invite.phone}`}
              className="rounded border border-border px-2 py-1 text-xs text-warning hover:bg-surface"
            >
              {strings.row.call}
            </a>
          ) : null}
          <CopyLinkButton token={invite.token} language={invite.language} />
          <HistoryModal inviteId={invite.id} name={invite.name} />
          <button
            type="button"
            onClick={() => {
              setEditing((value) => !value)
              setExpanded(true)
            }}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
          >
            {strings.row.edit}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.pending}
            aria-busy={remove.pending}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-danger hover:bg-surface disabled:opacity-50"
          >
            {remove.pending ? <Spinner /> : null}
            {remove.pending ? strings.app.deleting : strings.row.delete}
          </button>
        </div>
      </div>


      {editing ? (
        <InviteEditForm invite={invite} onDone={() => setEditing(false)} />
      ) : null}

      {expanded ? (
        <AttendeeList
          inviteId={invite.id}
          attendees={invite.attendees}
          editable={editing}
        />
      ) : null}
    </li>
  )
}
