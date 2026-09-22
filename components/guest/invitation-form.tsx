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
import { guestText } from '@/lib/strings'
import type { Answer, Attendee, Language, RsvpResult } from '@/lib/types'

interface InvitationFormProps {
  lang: Language
  token: string
  attendees: Attendee[]
  /** null = never answered. Decides whether ticks are pre-filled or stored. */
  initialAnswer: Answer | null
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
  lang,
  token,
  attendees,
  initialAnswer,
  onSubmitted,
  onCancel,
}: InvitationFormProps) {
  const t = guestText(lang)
  const named = attendees.filter((person) => !person.is_placeholder)

  /** null = nothing picked yet, which is not the same as answering 'undecided'. */
  const [answer, setAnswer] = useState<Answer | null>(initialAnswer)
  const [ticked, setTicked] = useState<string[]>(() => initialTicks(named, initialAnswer !== null))
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

    if (answer === null) {
      setError(t.rsvp.chooseAnswer)
      return
    }
    if (answer === 'yes' && ticked.length === 0 && extraAdults + extraKids === 0) {
      setError(t.rsvp.pickSomeone)
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
          answer,
          attendingIds: ticked,
          extraAdults,
          extraKids,
        }),
      })

      // 410: the deadline passed while this page sat open. The server is the
      // one that decides, so say so rather than letting the form look broken.
      if (response.status === 410) {
        setError(t.rsvp.closed.title)
        return
      }

      const body = await response.json()
      if (!body.success) throw new Error(body.error)

      onSubmitted(body.data as RsvpResult)
    } catch {
      setError(t.rsvp.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-3" disabled={saving}>
        <legend className="sr-only">{t.rsvp.intro}</legend>
        {/*
          * One row, and "עדיין לא יודעים" sits between the two definite
          * answers — yes, not sure, no is a scale, and putting the middle
          * answer in the middle is the only arrangement that reads as one.
          *
          * Equal columns, so the longest label sets the height of all three and
          * they stay a single block rather than three buttons of different
          * sizes. Its two words wrap on a narrow phone; the row grows.
          */}
        <div className="grid grid-cols-3 items-stretch gap-2">
          <AnswerButton
            label={t.rsvp.yes}
            selected={answer === 'yes'}
            onClick={() => setAnswer('yes')}
          />
          <AnswerButton
            label={t.rsvp.undecided}
            selected={answer === 'undecided'}
            onClick={() => setAnswer('undecided')}
          />
          <AnswerButton
            label={t.rsvp.no}
            selected={answer === 'no'}
            onClick={() => setAnswer('no')}
          />
        </div>
      </fieldset>

      {/* Declining zeroes everything, so the UI must not imply otherwise. */}
      {answer === 'yes' ? (
        <>
          {named.length > 0 ? (
            <fieldset className="space-y-2" disabled={saving}>
              <legend className="font-semibold text-bloom-strong">{t.rsvp.whoIsComing}</legend>
              <p className="text-sm text-bloom-ink">{t.rsvp.whoIsComingHint}</p>
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
            <legend className="font-semibold text-bloom-strong">{t.rsvp.extras}</legend>
            <p className="text-sm text-bloom-ink">{t.rsvp.extrasHint}</p>
            <Counter
              lang={lang}
              label={t.rsvp.extraAdults}
              value={extraAdults}
              onChange={setExtraAdults}
            />
            <Counter lang={lang} label={t.rsvp.extraKids} value={extraKids} onChange={setExtraKids} />
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
          {saving ? t.rsvp.submitting : t.rsvp.submit}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-bloom-ink/30 px-4 py-3.5 text-sm text-bloom-ink active:bg-bloom-ink/10"
          >
            {t.cancel}
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
      className={`flex h-full items-center justify-center rounded-xl border px-2 py-3.5 text-center leading-tight text-balance transition-colors ${
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
  lang,
  label,
  value,
  onChange,
}: {
  lang: Language
  label: string
  value: number
  onChange: (next: number) => void
}) {
  const t = guestText(lang)
  return (
    <div className="flex items-center justify-between rounded-xl border border-bloom-ink/25 bg-paper/60 px-3 py-2.5 text-bloom-strong">
      <span>{label}</span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`${t.rsvp.fewer} ${label}`}
          className="size-9 rounded-lg border border-bloom-ink/30 text-lg text-bloom-ink active:bg-bloom-ink/10"
        >
          −
        </button>
        <span className="ltr-nums w-6 text-center">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`${t.rsvp.more} ${label}`}
          className="size-9 rounded-lg border border-bloom-ink/30 text-lg text-bloom-ink active:bg-bloom-ink/10"
        >
          +
        </button>
      </span>
    </div>
  )
}
