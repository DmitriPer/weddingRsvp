'use client'

/**
 * The people on one invite: rename, change adult/child, remove, add.
 *
 * Renaming a placeholder is how an unnamed "+1" becomes a real person — the
 * PATCH clears is_placeholder, which is what makes them seatable by name
 * (PRD §5.3).
 *
 * `is_attending` is NOT editable here. That is the guest's answer, and the
 * admin overwriting it would make the headcount a claim rather than a record.
 *
 * The glyph beside each name is that person's OWN answer, not the tick. A tick
 * only means "coming" once the household has said it is coming, so reading the
 * raw flag would show a ✓ against someone on an invitation that never replied.
 *
 * Each person is its own row component with its own action, so a busy row
 * disables and spins only itself (docs/error-loading-PRD.md §4).
 */

import { startTransition, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { answerForPerson } from '@/lib/headcount'
import { jsonInit, requestJson } from '@/lib/request'
import { strings } from '@/lib/strings'
import type { Answer, Attendee } from '@/lib/types'

/** Glyph and tone per answer, so the list reads at a glance. */
const MARKS: Record<'yes' | 'no' | 'undecided' | 'none', { glyph: string; tone: string }> = {
  yes: { glyph: '✓', tone: 'text-accent' },
  no: { glyph: '✕', tone: 'text-danger' },
  undecided: { glyph: '?', tone: 'text-muted' },
  none: { glyph: '○', tone: 'text-muted' },
}

function patchAttendee(id: string, patch: { name?: string; is_child?: boolean }): Promise<unknown> {
  return requestJson(`/api/attendees/${id}`, jsonInit('PATCH', patch), strings.row.saveFailed)
}

export function AttendeeList({
  inviteId,
  answer,
  attendees,
  editable,
}: {
  inviteId: string
  /** The household's answer — needed to read each person's (lib/headcount.ts). */
  answer: Answer | null
  attendees: Attendee[]
  editable: boolean
}): React.JSX.Element | null {
  if (attendees.length === 0 && !editable) return null

  return (
    <div className="mt-2 border-t border-border pt-2">
      <ul className="space-y-1 text-sm">
        {attendees.map((person) => (
          <AttendeeRow key={person.id} person={person} answer={answer} editable={editable} />
        ))}
      </ul>

      {editable ? <AddAttendee inviteId={inviteId} /> : null}
    </div>
  )
}

function AttendeeRow({
  person,
  answer,
  editable,
}: {
  person: Attendee
  answer: Answer | null
  editable: boolean
}) {
  const action = useAction()
  // The chosen adult/child value, shown while the change is saving; the prop
  // still holds the old one until the refresh lands.
  const [draftIsChild, setDraftIsChild] = useState<boolean | null>(null)
  const isChild = draftIsChild ?? person.is_child
  const busy = action.pending

  const personAnswer = answerForPerson(answer, person) ?? 'none'
  const mark = MARKS[personAnswer]

  function rename(input: HTMLInputElement) {
    const trimmed = input.value.trim()
    if (busy || !trimmed || trimmed === person.name) return
    action.run(() => patchAttendee(person.id, { name: trimmed }), {
      failure: strings.row.saveFailed,
      onError: () => {
        input.value = person.name
      },
    })
  }

  function changeIsChild(next: boolean) {
    if (busy) return
    setDraftIsChild(next)
    action.run(
      async () => {
        await patchAttendee(person.id, { is_child: next })
        // Dropped with the refresh, when the prop already holds the new value.
        startTransition(() => setDraftIsChild(null))
      },
      { failure: strings.row.saveFailed, onError: () => setDraftIsChild(null) }
    )
  }

  function remove() {
    if (busy) return
    action.run(
      () => requestJson(`/api/attendees/${person.id}`, jsonInit('DELETE'), strings.row.deleteFailed),
      { failure: strings.row.deleteFailed }
    )
  }

  return (
    <li className="flex items-center gap-2" aria-busy={busy}>
      <span className={`shrink-0 ${mark.tone}`} title={strings.toolbar.answer[personAnswer]}>
        {mark.glyph}
      </span>

      {editable ? (
        <>
          <input
            defaultValue={person.name}
            onBlur={(event) => rename(event.currentTarget)}
            disabled={busy}
            placeholder={person.is_placeholder ? strings.row.renamePlaceholder : undefined}
            className={`min-w-0 flex-1 rounded border px-2 py-1 ${
              person.is_placeholder ? 'border-warning' : 'border-transparent hover:border-border'
            }`}
          />
          <select
            value={isChild ? 'child' : 'adult'}
            onChange={(event) => changeIsChild(event.target.value === 'child')}
            disabled={busy}
            aria-label={strings.inviteForm.adult}
            className="rounded border border-border px-1 py-1 text-xs"
          >
            <option value="adult">{strings.inviteForm.adult}</option>
            <option value="child">{strings.inviteForm.child}</option>
          </select>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={strings.row.removePerson}
            className="w-5 px-1 text-muted hover:text-danger"
          >
            {busy ? <Spinner /> : '×'}
          </button>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted">
          {person.name}
          {person.is_child ? ` (${strings.inviteForm.child})` : ''}
          {person.is_placeholder ? ` · ${strings.guests.placeholder}` : ''}
        </span>
      )}
    </li>
  )
}

function AddAttendee({ inviteId }: { inviteId: string }) {
  const action = useAction()
  const [newName, setNewName] = useState('')
  const [newIsChild, setNewIsChild] = useState(false)

  function add() {
    // Guards the Enter key too — it used to call add() again mid-request and
    // create the same person twice.
    const name = newName.trim()
    if (action.pending || !name) return

    action.run(
      async () => {
        await requestJson(
          '/api/attendees',
          jsonInit('POST', { invite_id: inviteId, name, is_child: newIsChild }),
          strings.row.saveFailed
        )
        // Cleared with the refresh, so the name leaves the field as the new
        // person appears in the list.
        startTransition(() => {
          setNewName('')
          setNewIsChild(false)
        })
      },
      { failure: strings.row.saveFailed }
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2" aria-busy={action.pending}>
      <input
        value={newName}
        onChange={(event) => setNewName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        readOnly={action.pending}
        placeholder={strings.row.addPerson}
        className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-sm"
      />
      <select
        value={newIsChild ? 'child' : 'adult'}
        onChange={(event) => setNewIsChild(event.target.value === 'child')}
        disabled={action.pending}
        className="rounded border border-border px-1 py-1 text-xs"
      >
        <option value="adult">{strings.inviteForm.adult}</option>
        <option value="child">{strings.inviteForm.child}</option>
      </select>
      <button
        type="button"
        onClick={add}
        disabled={action.pending || !newName.trim()}
        aria-label={strings.row.addPerson}
        className="inline-flex items-center rounded-md border border-border px-2 py-1 text-sm hover:bg-surface disabled:opacity-50"
      >
        {action.pending ? <Spinner /> : '+'}
      </button>
    </div>
  )
}
