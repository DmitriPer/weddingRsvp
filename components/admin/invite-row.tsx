'use client'

/**
 * One invitation in the list: summary, expand, edit, delete.
 *
 * The attendance line shows how many are INVITED before anyone answers, and how
 * many are COMING after — showing only the attending count made every new
 * invite read "0 guests" (lib/headcount.ts summarizeAttendance).
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { AttendeeList } from '@/components/admin/attendee-list'
import { CopyLinkButton } from '@/components/admin/copy-link-button'
import { HistoryModal } from '@/components/admin/history-modal'
import { InviteEditForm } from '@/components/admin/invite-edit-form'
import { WaSendButton } from '@/components/admin/wa-send-button'
import { summarizeAttendance } from '@/lib/headcount'
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
  const summary = summarizeAttendance(invite.attending, invite.attendees)
  const labels = strings.guests.summary

  switch (summary.kind) {
    case 'noPeople':
      return labels.noPeople
    case 'awaiting':
      return labels.awaiting(summary.invited)
    case 'declined':
      return labels.declined(summary.invited)
    case 'coming':
      return labels.coming(summary.coming, summary.invited)
  }
}

export function InviteRow({
  invite,
  config,
  selected,
  onToggleSelected,
}: {
  invite: InviteWithPeople
  config: WeddingConfig
  selected: boolean
  onToggleSelected: (id: string) => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const flagged = needsPhoneCall(invite.status, invite.contact_attempts)
  const sideRelation = sideRelationLabel(invite)

  function refresh() {
    router.refresh()
  }

  async function handleDelete() {
    // Cascades to every person and the whole history, with no undo (PRD §6.6).
    if (!window.confirm(strings.row.confirmDelete(invite.name))) return

    setDeleting(true)
    const response = await fetch(`/api/invites/${invite.id}`, { method: 'DELETE' })
    const body = await response.json()
    setDeleting(false)

    if (!body.success) {
      toast.error(body.error || strings.row.deleteFailed)
      return
    }
    toast.success(strings.row.deleted)
    refresh()
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
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
          className="flex min-w-0 flex-1 items-start gap-2 text-right"
          aria-expanded={expanded}
        >
          <span className="mt-0.5 shrink-0 text-muted">{expanded ? '▾' : '▸'}</span>
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

        <div className="shrink-0 text-left text-sm">
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

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <WaSendButton invite={invite} config={config} />
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
            disabled={deleting}
            className="rounded border border-border px-2 py-1 text-xs text-danger hover:bg-surface disabled:opacity-50"
          >
            {strings.row.delete}
          </button>
        </div>
      </div>

      {editing ? (
        <InviteEditForm invite={invite} onDone={() => setEditing(false)} onSaved={refresh} />
      ) : null}

      {expanded ? (
        <AttendeeList
          inviteId={invite.id}
          attendees={invite.attendees}
          editable={editing}
          onChanged={refresh}
        />
      ) : null}
    </li>
  )
}
