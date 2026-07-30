'use client'

/** Edits an invite's own fields. People are handled by AttendeeList. */

import { useState } from 'react'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import { RELATIONS, SIDES, type Invite, type Relation, type Side } from '@/lib/types'

export function InviteEditForm({
  invite,
  onDone,
  onSaved,
}: {
  invite: Invite
  onDone: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(invite.name)
  const [phone, setPhone] = useState(invite.phone ?? '')
  const [side, setSide] = useState<Side | ''>(invite.side ?? '')
  const [relation, setRelation] = useState<Relation | ''>(invite.relation ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    const response = await fetch(`/api/invites/${invite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || null,
        side: side || null,
        relation: relation || null,
      }),
    })
    const body = await response.json()
    setSaving(false)

    if (!body.success) {
      toast.error(body.error || strings.row.saveFailed)
      return
    }

    toast.success(strings.row.saved)
    const duplicates: string[] = body.data.duplicatePhoneWith ?? []
    if (duplicates.length) toast.warning(strings.inviteForm.duplicatePhone(duplicates))

    onSaved()
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t border-border pt-3">
      <div>
        <label className="block text-sm" htmlFor={`name-${invite.id}`}>
          {strings.inviteForm.name}
        </label>
        <input
          id={`name-${invite.id}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-1.5"
        />
      </div>

      <div>
        <label className="block text-sm" htmlFor={`phone-${invite.id}`}>
          {strings.inviteForm.phone}
        </label>
        <input
          id={`phone-${invite.id}`}
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="+972501234567"
          className="ltr-nums mt-1 w-full rounded-md border border-border px-3 py-1.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select
          value={side}
          onChange={(event) => setSide(event.target.value as Side | '')}
          aria-label={strings.inviteForm.side}
          className="rounded-md border border-border px-3 py-1.5"
        >
          <option value="">{strings.inviteForm.notSet}</option>
          {SIDES.map((value) => (
            <option key={value} value={value}>
              {strings.side[value]}
            </option>
          ))}
        </select>
        <select
          value={relation}
          onChange={(event) => setRelation(event.target.value as Relation | '')}
          aria-label={strings.inviteForm.relation}
          className="rounded-md border border-border px-3 py-1.5"
        >
          <option value="">{strings.inviteForm.notSet}</option>
          {RELATIONS.map((value) => (
            <option key={value} value={value}>
              {strings.relation[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {saving ? strings.app.saving : strings.app.save}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {strings.app.cancel}
        </button>
      </div>
    </form>
  )
}
