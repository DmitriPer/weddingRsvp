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
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import type { Attendee } from '@/lib/types'

export function AttendeeList({
  inviteId,
  attendees,
  editable,
  onChanged,
}: {
  inviteId: string
  attendees: Attendee[]
  editable: boolean
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newIsChild, setNewIsChild] = useState(false)
  const [adding, setAdding] = useState(false)

  async function rename(person: Attendee, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === person.name) return

    setBusyId(person.id)
    const response = await fetch(`/api/attendees/${person.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const body = await response.json()
    setBusyId(null)

    if (!body.success) {
      toast.error(body.error || strings.row.saveFailed)
      return
    }
    onChanged()
  }

  async function setIsChild(person: Attendee, isChild: boolean) {
    setBusyId(person.id)
    const response = await fetch(`/api/attendees/${person.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_child: isChild }),
    })
    const body = await response.json()
    setBusyId(null)
    if (!body.success) toast.error(body.error || strings.row.saveFailed)
    else onChanged()
  }

  async function remove(person: Attendee) {
    setBusyId(person.id)
    const response = await fetch(`/api/attendees/${person.id}`, { method: 'DELETE' })
    const body = await response.json()
    setBusyId(null)
    if (!body.success) toast.error(body.error || strings.row.deleteFailed)
    else onChanged()
  }

  async function add() {
    if (!newName.trim()) return
    setAdding(true)
    const response = await fetch('/api/attendees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId, name: newName.trim(), is_child: newIsChild }),
    })
    const body = await response.json()
    setAdding(false)
    if (!body.success) {
      toast.error(body.error || strings.row.saveFailed)
      return
    }
    setNewName('')
    setNewIsChild(false)
    onChanged()
  }

  if (attendees.length === 0 && !editable) return null

  return (
    <div className="mt-2 border-t border-border pt-2">
      <ul className="space-y-1 text-sm">
        {attendees.map((person) => (
          <li key={person.id} className="flex items-center gap-2">
            <span
              className={`shrink-0 ${person.is_attending ? 'text-accent' : 'text-muted'}`}
              title={person.is_attending ? strings.row.attending : strings.row.notAttending}
            >
              {person.is_attending ? '✓' : '○'}
            </span>

            {editable ? (
              <>
                <input
                  defaultValue={person.name}
                  onBlur={(event) => rename(person, event.target.value)}
                  disabled={busyId === person.id}
                  placeholder={person.is_placeholder ? strings.row.renamePlaceholder : undefined}
                  className={`min-w-0 flex-1 rounded border px-2 py-1 ${
                    person.is_placeholder ? 'border-warning' : 'border-transparent hover:border-border'
                  }`}
                />
                <select
                  value={person.is_child ? 'child' : 'adult'}
                  onChange={(event) => setIsChild(person, event.target.value === 'child')}
                  disabled={busyId === person.id}
                  aria-label={strings.inviteForm.adult}
                  className="rounded border border-border px-1 py-1 text-xs"
                >
                  <option value="adult">{strings.inviteForm.adult}</option>
                  <option value="child">{strings.inviteForm.child}</option>
                </select>
                <button
                  type="button"
                  onClick={() => remove(person)}
                  disabled={busyId === person.id}
                  aria-label={strings.row.removePerson}
                  className="px-1 text-muted hover:text-danger"
                >
                  ×
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
        ))}
      </ul>

      {editable ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder={strings.row.addPerson}
            className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-sm"
          />
          <select
            value={newIsChild ? 'child' : 'adult'}
            onChange={(event) => setNewIsChild(event.target.value === 'child')}
            className="rounded border border-border px-1 py-1 text-xs"
          >
            <option value="adult">{strings.inviteForm.adult}</option>
            <option value="child">{strings.inviteForm.child}</option>
          </select>
          <button
            type="button"
            onClick={add}
            disabled={adding || !newName.trim()}
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-surface disabled:opacity-50"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  )
}
