'use client'

/**
 * Creates an invite, and optionally the people under it.
 *
 * Two API calls, in order: POST /api/invites, then POST /api/attendees per
 * person. The invite must exist first — attendees reference its id.
 *
 * Only the admin ever types a name (PRD §6.1). Guests tick who is coming and
 * can add an unnamed "+1"; they never enter names.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import { LANGUAGES, RELATIONS, SIDES, type Language, type Relation, type Side } from '@/lib/types'

interface PersonDraft {
  key: number
  name: string
  isChild: boolean
}

let nextKey = 1

export function AddInviteForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [side, setSide] = useState<Side | ''>('')
  const [relation, setRelation] = useState<Relation | ''>('')
  // Hebrew unless said otherwise — the default, not a blank (PRD §6.7b).
  const [language, setLanguage] = useState<Language>('he')
  const [people, setPeople] = useState<PersonDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setPhone('')
    setSide('')
    setRelation('')
    setLanguage('he')
    setPeople([])
    setError(null)
  }

  function addPerson() {
    setPeople((current) => [...current, { key: nextKey++, name: '', isChild: false }])
  }

  function updatePerson(key: number, patch: Partial<PersonDraft>) {
    setPeople((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function removePerson(key: number) {
    setPeople((current) => current.filter((p) => p.key !== key))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError(strings.inviteForm.nameRequired)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const inviteResponse = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          side: side || null,
          relation: relation || null,
          language,
        }),
      })
      const inviteBody = await inviteResponse.json()
      if (!inviteBody.success) throw new Error(inviteBody.error)

      const inviteId: string = inviteBody.data.invite.id

      // Named people, in the order typed. Blank rows are simply skipped.
      const named = people.filter((person) => person.name.trim())
      for (const person of named) {
        const personResponse = await fetch('/api/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite_id: inviteId,
            name: person.name.trim(),
            is_child: person.isChild,
          }),
        })
        const personBody = await personResponse.json()
        if (!personBody.success) throw new Error(personBody.error)
      }

      toast.success(strings.inviteForm.created)

      // A duplicate phone is a warning, never a block (PRD §6.6) — one household
      // legitimately has one phone across two invites.
      const duplicates: string[] = inviteBody.data.duplicatePhoneWith ?? []
      if (duplicates.length) {
        toast.warning(strings.inviteForm.duplicatePhone(duplicates))
      }

      reset()
      setOpen(false)
      router.refresh()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : strings.inviteForm.failed)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-white"
      >
        + {strings.inviteForm.addInvite}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4">
      <h2 className="mb-4 font-semibold">{strings.inviteForm.title}</h2>

      <label className="block text-sm" htmlFor="invite-name">
        {strings.inviteForm.name} *
      </label>
      <input
        id="invite-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        className="mt-1 w-full rounded-md border border-border px-3 py-2"
      />
      <p className="mt-1 mb-3 text-xs text-muted">{strings.inviteForm.nameHint}</p>

      <label className="block text-sm" htmlFor="invite-phone">
        {strings.inviteForm.phone}
      </label>
      <input
        id="invite-phone"
        type="tel"
        dir="ltr"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="+972501234567"
        className="ltr-nums mt-1 w-full rounded-md border border-border px-3 py-2"
      />
      <p className="mt-1 mb-3 text-xs text-muted">{strings.inviteForm.phoneHint}</p>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm" htmlFor="invite-side">
            {strings.inviteForm.side}
          </label>
          <select
            id="invite-side"
            value={side}
            onChange={(event) => setSide(event.target.value as Side | '')}
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
          >
            <option value="">{strings.inviteForm.notSet}</option>
            {SIDES.map((value) => (
              <option key={value} value={value}>
                {strings.side[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm" htmlFor="invite-language">
            {strings.language.label}
          </label>
          <select
            id="invite-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
          >
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {strings.language[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm" htmlFor="invite-relation">
            {strings.inviteForm.relation}
          </label>
          <select
            id="invite-relation"
            value={relation}
            onChange={(event) => setRelation(event.target.value as Relation | '')}
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
          >
            <option value="">{strings.inviteForm.notSet}</option>
            {RELATIONS.map((value) => (
              <option key={value} value={value}>
                {strings.relation[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mb-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm">{strings.inviteForm.people}</legend>
        <p className="mb-3 text-xs text-muted">{strings.inviteForm.peopleHint}</p>

        {people.map((person) => (
          <div key={person.key} className="mb-2 flex items-center gap-2">
            <input
              value={person.name}
              onChange={(event) => updatePerson(person.key, { name: event.target.value })}
              placeholder={strings.inviteForm.personName}
              className="min-w-0 flex-1 rounded-md border border-border px-3 py-1.5"
            />
            <select
              value={person.isChild ? 'child' : 'adult'}
              onChange={(event) =>
                updatePerson(person.key, { isChild: event.target.value === 'child' })
              }
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <option value="adult">{strings.inviteForm.adult}</option>
              <option value="child">{strings.inviteForm.child}</option>
            </select>
            <button
              type="button"
              onClick={() => removePerson(person.key)}
              aria-label={strings.inviteForm.removePerson}
              className="px-2 text-muted hover:text-danger"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addPerson}
          className="mt-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          + {strings.inviteForm.addPerson}
        </button>
      </fieldset>

      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? strings.app.saving : strings.app.save}
        </button>
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className="rounded-md border border-border px-4 py-2 hover:bg-surface"
        >
          {strings.app.cancel}
        </button>
      </div>
    </form>
  )
}
