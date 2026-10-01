'use client'

/**
 * The admin records what a household answered, usually on the phone
 * (docs/admin-answer-and-calls-PRD.md §5). It is written exactly like the
 * guest's own answer, with history marked 'admin'.
 *
 * Only NAMED people are ticked here. +1s are managed by count, not by tick, so
 * they are shown read-only and kept on a 'yes'; new ones are added in the
 * attendee editor. A 'no' or 'undecided' clears them, as it does for a guest.
 */

import { startTransition, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'
import { countExtras } from '@/lib/headcount'
import { jsonInit, requestJson } from '@/lib/request'
import { strings } from '@/lib/strings'
import { ANSWERS, type Answer, type InviteWithPeople } from '@/lib/types'

/** A household that said yes keeps its ticks; otherwise everyone starts ticked, like the guest form. */
function initialTicks(invite: InviteWithPeople): Set<string> {
  const named = invite.attendees.filter((person) => !person.is_placeholder)
  const ticked = invite.answer === 'yes' ? named.filter((person) => person.is_attending) : named
  return new Set(ticked.map((person) => person.id))
}

export function AnswerForm({
  invite,
  onDone,
}: {
  invite: InviteWithPeople
  /** Closes the form. Also called after a save, once the refreshed row has rendered. */
  onDone: () => void
}): React.JSX.Element {
  const [answer, setAnswer] = useState<Answer | null>(invite.answer)
  const [ticked, setTicked] = useState(() => initialTicks(invite))
  const save = useAction()

  const named = invite.attendees.filter((person) => !person.is_placeholder)
  const extras = countExtras(invite.attendees)
  const nobodyComing = answer === 'yes' && ticked.size === 0 && extras === 0

  function toggle(id: string) {
    setTicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (save.pending || !answer || nobodyComing) return

    const payload = { answer, attendingIds: answer === 'yes' ? [...ticked] : [] }

    save.run(
      async () => {
        await requestJson(`/api/invites/${invite.id}/answer`, jsonInit('POST', payload), strings.row.answerFailed)
        startTransition(onDone)
      },
      { success: strings.row.answerSaved, failure: strings.row.answerFailed }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t border-border pt-3">
      <fieldset>
        <legend className="text-sm">{strings.row.setAnswerTitle}</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {ANSWERS.map((value) => (
            <label key={value} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={`answer-${invite.id}`}
                value={value}
                checked={answer === value}
                onChange={() => setAnswer(value)}
              />
              {strings.toolbar.answer[value]}
            </label>
          ))}
        </div>
      </fieldset>

      {answer === 'yes' ? (
        <fieldset>
          <legend className="text-sm">{strings.row.whoIsComing}</legend>
          <ul className="mt-1 space-y-1">
            {named.map((person) => (
              <li key={person.id}>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={ticked.has(person.id)}
                    onChange={() => toggle(person.id)}
                  />
                  {person.name}
                </label>
              </li>
            ))}
          </ul>
          {extras > 0 ? (
            <p className="mt-1 text-sm text-muted">{strings.row.unnamedGuests(extras)}</p>
          ) : null}
          {nobodyComing ? (
            <p role="status" className="mt-1 text-xs text-warning">
              {strings.row.answerNeedsPerson}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.pending || !answer || nobodyComing}
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
