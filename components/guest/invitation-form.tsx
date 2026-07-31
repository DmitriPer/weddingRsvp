'use client'

/**
 * The guest's answer (PRD §6.1).
 *
 * Three things the guest controls: coming or not, which of the named people are
 * coming, and how many unnamed extras to add. Only the admin ever types a name.
 *
 * Ticking people individually is the point: declining one person while
 * approving another must be expressible, so the admin learns WHO dropped out
 * rather than inferring it from a falling number.
 *
 * Extras are a NUMBER, not rows — the server reconciles placeholder rows to
 * match (lib/placeholders.ts). There is deliberately no cap: an unexpected
 * headcount should surface in the total rather than be blocked at entry.
 */

import { useState } from 'react'
import { strings } from '@/lib/strings'
import type { Attendee, RsvpResult } from '@/lib/types'

interface InvitationFormProps {
  token: string
  attendees: Attendee[]
  /** null = never answered. Decides whether ticks are pre-filled or stored. */
  initialAttending: boolean | null
  onSubmitted: (result: RsvpResult) => void
  onCancel?: () => void
}

/**
 * A first-time guest gets everyone pre-ticked, because is_attending defaults to
 * false in the schema — reading that literally would show an all-empty list and
 * read as "nobody is invited". Once they have answered, the ticks are whatever
 * was actually stored, which is also why a decline correctly comes back blank
 * (declining unticks everyone and deletes placeholders).
 */
function initialTicks(named: Attendee[], hasAnswered: boolean): string[] {
  if (!hasAnswered) return named.map((person) => person.id)
  return named.filter((person) => person.is_attending).map((person) => person.id)
}

function countPlaceholders(attendees: Attendee[], isChild: boolean): number {
  return attendees.filter((person) => person.is_placeholder && person.is_child === isChild).length
}

export function InvitationForm({
  token,
  attendees,
  initialAttending,
  onSubmitted,
  onCancel,
}: InvitationFormProps) {
  const named = attendees.filter((person) => !person.is_placeholder)

  const [attending, setAttending] = useState<boolean | null>(initialAttending)
  const [ticked, setTicked] = useState<string[]>(() =>
    initialTicks(named, initialAttending !== null)
  )
  const [extraAdults, setExtraAdults] = useState(() => countPlaceholders(attendees, false))
  const [extraKids, setExtraKids] = useState(() => countPlaceholders(attendees, true))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setTicked((current) =>
      current.includes(id) ? current.filter((one) => one !== id) : [...current, id]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (attending === null) {
      setError(strings.rsvp.chooseAnswer)
      return
    }
    if (attending && ticked.length === 0 && extraAdults + extraKids === 0) {
      setError(strings.rsvp.pickSomeone)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          attending,
          attendingIds: ticked,
          extraAdults,
          extraKids,
        }),
      })

      // 410: the deadline passed while this page sat open. The server is the
      // one that decides, so say so rather than letting the form look broken.
      if (response.status === 410) {
        setError(strings.rsvp.closed.title)
        return
      }

      const body = await response.json()
      if (!body.success) throw new Error(body.error)

      onSubmitted(body.data as RsvpResult)
    } catch {
      setError(strings.rsvp.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-3" disabled={saving}>
        <legend className="sr-only">{strings.rsvp.intro}</legend>
        <div className="grid grid-cols-2 gap-3">
          <AnswerButton
            label={strings.rsvp.yes}
            selected={attending === true}
            onClick={() => setAttending(true)}
          />
          <AnswerButton
            label={strings.rsvp.no}
            selected={attending === false}
            onClick={() => setAttending(false)}
          />
        </div>
      </fieldset>

      {/* Declining zeroes everything, so the UI must not imply otherwise. */}
      {attending === true ? (
        <>
          {named.length > 0 ? (
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="font-semibold text-bloom-strong">{strings.rsvp.whoIsComing}</legend>
              <p className="text-sm text-bloom-ink">{strings.rsvp.whoIsComingHint}</p>
              {named.map((person) => (
                <label
                  key={person.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-bloom-strong ${
                    ticked.includes(person.id)
                      ? 'border-bloom-ink bg-bloom-ink/10'
                      : 'border-bloom-ink/25 bg-paper/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={ticked.includes(person.id)}
                    onChange={() => toggle(person.id)}
                    className="size-5 accent-[var(--bloom-ink)]"
                  />
                  <span>{person.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <fieldset className="space-y-3" disabled={saving}>
            <legend className="font-semibold text-bloom-strong">{strings.rsvp.extras}</legend>
            <p className="text-sm text-bloom-ink">{strings.rsvp.extrasHint}</p>
            <Counter
              label={strings.rsvp.extraAdults}
              value={extraAdults}
              onChange={setExtraAdults}
            />
            <Counter label={strings.rsvp.extraKids} value={extraKids} onChange={setExtraKids} />
          </fieldset>
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-bloom-ink px-4 py-3.5 font-semibold text-paper active:bg-bloom-strong disabled:opacity-60"
        >
          {saving ? strings.rsvp.submitting : strings.rsvp.submit}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-bloom-ink/30 px-4 py-3.5 text-sm text-bloom-ink active:bg-bloom-ink/10"
          >
            {strings.app.cancel}
          </button>
        ) : null}
      </div>
    </form>
  )
}

function AnswerButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3.5 transition-colors ${
        selected
          ? 'border-bloom-ink bg-bloom-ink font-semibold text-paper'
          : 'border-bloom-ink/30 text-bloom-ink'
      }`}
    >
      {label}
    </button>
  )
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-bloom-ink/25 bg-paper/60 px-3 py-2.5 text-bloom-strong">
      <span>{label}</span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`${strings.rsvp.fewer} ${label}`}
          className="size-9 rounded-lg border border-bloom-ink/30 text-lg text-bloom-ink active:bg-bloom-ink/10"
        >
          −
        </button>
        <span className="ltr-nums w-6 text-center">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`${strings.rsvp.more} ${label}`}
          className="size-9 rounded-lg border border-bloom-ink/30 text-lg text-bloom-ink active:bg-bloom-ink/10"
        >
          +
        </button>
      </span>
    </div>
  )
}
