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
import { AGE_GROUPS, ageGroupOf, type AgeGroup } from '@/lib/age-group'
import { strings } from '@/lib/strings'
import type { Answer, Attendee } from '@/lib/types'

/** Glyph and tone per answer, so the list reads at a glance. */
const MARKS: Record<'yes' | 'no' | 'undecided' | 'none', { glyph: string; tone: string }> = {
  yes: { glyph: '✓', tone: 'text-accent' },
  no: { glyph: '✕', tone: 'text-danger' },
  undecided: { glyph: '?', tone: 'text-muted' },
  none: { glyph: '○', tone: 'text-muted' },
}

/** מבוגר / ילד 3–7 / תינוק 0–3 — the one control that sets a person's age group. */
function AgeGroupSelect({
  value,
  onChange,
  disabled,
}: {
  value: AgeGroup
  onChange: (next: AgeGroup) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as AgeGroup)}
      disabled={disabled}
      aria-label={strings.inviteForm.ageGroupLabel}
      className="rounded border border-border px-1 py-1 text-xs"
    >
      {AGE_GROUPS.map((option) => (
        <option key={option} value={option}>
          {strings.inviteForm.ageGroups[option]}
        </option>
      ))}
    </select>
  )
}

function patchAttendee(id: string, patch: { name?: string; age_group?: AgeGroup }): Promise<unknown> {
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
  // The chosen age group, shown while the change is saving; the prop still
  // holds the old one until the refresh lands.
  const [draftGroup, setDraftGroup] = useState<AgeGroup | null>(null)
  const group = draftGroup ?? ageGroupOf(person)
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

  function changeGroup(next: AgeGroup) {
    if (busy) return
    setDraftGroup(next)
    action.run(
      async () => {
        await patchAttendee(person.id, { age_group: next })
        // Dropped with the refresh, when the prop already holds the new value.
        startTransition(() => setDraftGroup(null))
      },
      { failure: strings.row.saveFailed, onError: () => setDraftGroup(null) }
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
          <AgeGroupSelect value={group} onChange={changeGroup} disabled={busy} />
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
          {person.is_child ? ` (${strings.inviteForm.ageGroups[ageGroupOf(person)]})` : ''}
          {person.is_placeholder ? ` · ${strings.guests.placeholder}` : ''}
        </span>
      )}
    </li>
  )
}

function AddAttendee({ inviteId }: { inviteId: string }) {
  const action = useAction()
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<AgeGroup>('adult')

  function add() {
    // Guards the Enter key too — it used to call add() again mid-request and
    // create the same person twice.
    const name = newName.trim()
    if (action.pending || !name) return

    action.run(
      async () => {
        await requestJson(
          '/api/attendees',
          jsonInit('POST', { invite_id: inviteId, name, age_group: newGroup }),
          strings.row.saveFailed
        )
        // Cleared with the refresh, so the name leaves the field as the new
        // person appears in the list.
        startTransition(() => {
          setNewName('')
          setNewGroup('adult')
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
      <AgeGroupSelect value={newGroup} onChange={setNewGroup} disabled={action.pending} />
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
