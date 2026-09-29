'use client'

/** Edits an invite's own fields. People are handled by AttendeeList. */

import { startTransition, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { jsonInit, requestJson } from '@/lib/request'
import { normalisePhone } from '@/lib/phone'
import { strings } from '@/lib/strings'
import {
  LANGUAGES,
  RELATIONS,
  SIDES,
  type Invite,
  type Language,
  type Relation,
  type Side,
} from '@/lib/types'

export function InviteEditForm({
  invite,
  onDone,
}: {
  invite: Invite
  /** Closes the form. Also called after a save, once the refreshed row has rendered. */
  onDone: () => void
}): React.JSX.Element {
  const [name, setName] = useState(invite.name)
  const [phone, setPhone] = useState(invite.phone ?? '')
  const [side, setSide] = useState<Side | ''>(invite.side ?? '')
  const [relation, setRelation] = useState<Relation | ''>(invite.relation ?? '')
  const [language, setLanguage] = useState<Language>(invite.language)
  const save = useAction()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (save.pending) return

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      side: side || null,
      relation: relation || null,
      language,
    }

    // The close is a transition inside the action, so it commits with the
    // refresh: the form stays open on "שומר…" until the row shows the new
    // values, instead of closing onto the old ones.
    save.run(
      async () => {
        const data = await requestJson<{ duplicatePhoneWith?: string[] }>(
          `/api/invites/${invite.id}`,
          jsonInit('PATCH', payload),
          strings.row.saveFailed
        )
        const duplicates = data.duplicatePhoneWith ?? []
        if (duplicates.length) toast.warning(strings.inviteForm.duplicatePhone(duplicates))
        startTransition(onDone)
      },
      { success: strings.row.saved, failure: strings.row.saveFailed }
    )
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
          placeholder="0549546899"
          className="ltr-nums mt-1 w-full rounded-md border border-border px-3 py-1.5"
        />
        {normalisePhone(phone).unrecognised ? (
          // Same check the importer flags (lib/phone.ts): saved as typed, but
          // a wa.me link built from it would likely reach nobody.
          <p role="status" className="mt-1 text-xs text-warning">
            {strings.inviteForm.phoneUnrecognised}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
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
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          aria-label={strings.language.label}
          className="rounded-md border border-border px-3 py-1.5"
        >
          {LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {strings.language[value]}
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
          disabled={save.pending}
          aria-busy={save.pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {save.pending ? <Spinner /> : null}
          {save.pending ? strings.app.saving : strings.app.save}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={save.pending}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-60"
        >
          {strings.app.cancel}
        </button>
      </div>
    </form>
  )
}
