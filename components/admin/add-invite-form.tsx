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

import { startTransition, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { jsonInit, requestJson } from '@/lib/request'
import { normalisePhone } from '@/lib/phone'
import { strings } from '@/lib/strings'
import { LANGUAGES, RELATIONS, SIDES, type Language, type Relation, type Side } from '@/lib/types'

interface PersonDraft {
  key: number
  name: string
  isChild: boolean
}

interface InviteDraft {
  name: string
  phone: string | null
  side: Side | null
  relation: Relation | null
  language: Language
}

interface CreatedInvite {
  invite: { id: string }
  duplicatePhoneWith?: string[]
}

let nextKey = 1

/** POST /api/invites. Returns the new invite's id. */
async function createInvite(draft: InviteDraft): Promise<string> {
  const created = await requestJson<CreatedInvite>(
    '/api/invites',
    jsonInit('POST', draft),
    strings.inviteForm.failed
  )

  // A duplicate phone is a warning, never a block (PRD §6.6) — one household
  // legitimately has one phone across two invites.
  const duplicates = created.duplicatePhoneWith ?? []
  if (duplicates.length) toast.warning(strings.inviteForm.duplicatePhone(duplicates))

  return created.invite.id
}

/** POST /api/attendees per named person, in the order typed. Blank rows are skipped. */
async function createPeople(inviteId: string, people: PersonDraft[]): Promise<void> {
  const named = people.filter((person) => person.name.trim())
  for (const person of named) {
    await requestJson(
      '/api/attendees',
      jsonInit('POST', { invite_id: inviteId, name: person.name.trim(), is_child: person.isChild }),
      strings.inviteForm.failed
    )
  }
}

export function AddInviteForm(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [side, setSide] = useState<Side | ''>('')
  const [relation, setRelation] = useState<Relation | ''>('')
  // Hebrew unless said otherwise — the default, not a blank (PRD §6.7b).
  const [language, setLanguage] = useState<Language>('he')
  const [people, setPeople] = useState<PersonDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const save = useAction()

  function reset() {
    setName('')
    setPhone('')
    setSide('')
    setRelation('')
    setLanguage('he')
    setPeople([])
    setError(null)
  }

  function close() {
    reset()
    setOpen(false)
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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (save.pending) return
    if (!name.trim()) {
      setError(strings.inviteForm.nameRequired)
      return
    }
    setError(null)

    const draft: InviteDraft = {
      name: name.trim(),
      phone: phone.trim() || null,
      side: side || null,
      relation: relation || null,
      language,
    }

    // Invite first — attendees reference its id. The form stays open, spinner
    // on, until the refreshed list shows the new row: the close is a
    // transition inside the action, so it commits together with the refresh
    // rather than leaving a gap where the form is gone and the row isn't there.
    save.run(
      async () => {
        const inviteId = await createInvite(draft)
        await createPeople(inviteId, people)
        startTransition(close)
      },
      { success: strings.inviteForm.created, failure: strings.inviteForm.failed }
    )
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
        placeholder="0549546899"
        className="ltr-nums mt-1 w-full rounded-md border border-border px-3 py-2"
      />
      {normalisePhone(phone).unrecognised ? (
        // Same check the importer flags (lib/phone.ts): saved as typed, but
        // a wa.me link built from it would likely reach nobody.
        <p role="status" className="mt-1 text-xs text-warning">
          {strings.inviteForm.phoneUnrecognised}
        </p>
      ) : null}
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
          disabled={save.pending}
          aria-busy={save.pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
        >
          {save.pending ? <Spinner /> : null}
          {save.pending ? strings.app.saving : strings.app.save}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={save.pending}
          className="rounded-md border border-border px-4 py-2 hover:bg-surface disabled:opacity-60"
        >
          {strings.app.cancel}
        </button>
      </div>
    </form>
  )
}
