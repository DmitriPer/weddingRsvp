'use client'

/**
 * The wedding details (PRD §6.5): names, date, venue, deadline, phone.
 *
 * These are not decoration. The date becomes the .ics guests download, the
 * venue is what the navigation button searches for, the phone is what the
 * past-deadline screen tells people to call, and the deadline is enforced
 * server-side in POST /api/rsvp. Every one of them is wrong until edited here.
 *
 * Dates go through lib/datetime's Jerusalem helpers rather than the browser's
 * own timezone — see the comment there for why that distinction is load-bearing.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  fromDateTimeLocalValue,
  joinDateTimeLocal,
  splitDateTimeLocal,
  toDateTimeLocalValue,
} from '@/lib/datetime'
import { strings } from '@/lib/strings'
import type { WeddingConfig } from '@/lib/types'

export function ConfigForm({ config }: { config: WeddingConfig }) {
  const router = useRouter()
  const [coupleNames, setCoupleNames] = useState(config.couple_names)
  const [venue, setVenue] = useState(config.venue_name)
  const [phone, setPhone] = useState(config.contact_phone)
  const [weddingAt, setWeddingAt] = useState(toDateTimeLocalValue(config.wedding_date_time))
  const [deadline, setDeadline] = useState(toDateTimeLocalValue(config.rsvp_deadline))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    const response = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        couple_names: coupleNames.trim(),
        venue_name: venue.trim(),
        contact_phone: phone.trim(),
        // null, never '' — an empty deadline means "always open" (PRD §6.3).
        wedding_date_time: fromDateTimeLocalValue(weddingAt),
        rsvp_deadline: fromDateTimeLocalValue(deadline),
      }),
    })
    const body = await response.json()
    setSaving(false)

    if (!body.success) {
      toast.error(body.error || strings.settings.saveFailed)
      return
    }
    toast.success(strings.settings.saved)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={strings.settings.coupleNames} htmlFor="couple-names">
          <input
            id="couple-names"
            value={coupleNames}
            onChange={(event) => setCoupleNames(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5"
          />
        </Field>

        <Field
          label={strings.settings.contactPhone}
          htmlFor="contact-phone"
          hint={strings.settings.contactPhoneHint}
        >
          <input
            id="contact-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+972501234567"
            className="w-full rounded-md border border-border px-3 py-1.5"
          />
        </Field>

        <Field
          label={strings.settings.weddingDateTime}
          htmlFor="wedding-at"
          hint={strings.settings.weddingDateTimeHint}
        >
          <DateTimeField id="wedding-at" value={weddingAt} onChange={setWeddingAt} />
        </Field>

        <Field
          label={strings.settings.deadline}
          htmlFor="deadline"
          hint={strings.settings.deadlineHint}
        >
          <DateTimeField id="deadline" value={deadline} onChange={setDeadline} />
        </Field>

        <div className="sm:col-span-2">
          <Field label={strings.settings.venue} htmlFor="venue" hint={strings.settings.venueHint}>
            <input
              id="venue"
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5"
            />
          </Field>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {saving ? strings.app.saving : strings.app.save}
      </button>
    </form>
  )
}

/** Minute options. Five-minute steps cover every time anyone sets a wedding to. */
const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))

/**
 * A date, an hour and a minute — deliberately NOT `<input type="datetime-local">`.
 *
 * That control renders in the browser's own locale, so an English-language
 * browser shows "06:30 PM" no matter what the page says; neither `lang` nor
 * `dir` overrides it. Selects are 24-hour everywhere because the options are
 * ours, and they are faster to operate at a desk than a stepper.
 *
 * Empty stays empty: clearing the date clears the whole value, which is how
 * "no deadline" (PRD §6.3) survives a round trip through this form.
 */
function DateTimeField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (next: string) => void
}) {
  const { date, time } = splitDateTimeLocal(value)
  const [hour = '', minute = ''] = time.split(':')

  // A stored 18:37 has no matching option, and a select silently discards a
  // value it cannot show. Offer it rather than round the wedding time off.
  const minutes = minute && !MINUTE_STEPS.includes(minute) ? [minute, ...MINUTE_STEPS] : MINUTE_STEPS

  const set = (nextDate: string, nextHour: string, nextMinute: string) => {
    // Picking a date with no time yet lands on a whole hour rather than nothing,
    // so one more click completes the value instead of two.
    const hh = nextHour || (nextDate ? '19' : '')
    const mm = nextMinute || (nextDate ? '00' : '')
    onChange(joinDateTimeLocal(nextDate, hh && mm ? `${hh}:${mm}` : ''))
  }

  return (
    // dir="ltr" on the ROW, not on each control. The page is RTL, which would
    // otherwise lay these out right-to-left and print the time as 30:18 — the
    // parts each rendered correctly, in the wrong order. A date and a clock read
    // left-to-right in Hebrew too.
    <div dir="ltr" className="flex items-center gap-2">
      <input
        id={id}
        type="date"
        value={date}
        onChange={(event) => set(event.target.value, hour, minute)}
        className="min-w-0 flex-1 rounded-md border border-border px-3 py-1.5"
      />
      <select
        aria-label={strings.settings.hour}
        value={hour}
        onChange={(event) => set(date, event.target.value, minute)}
        className="rounded-md border border-border px-2 py-1.5"
      >
        <option value="">{strings.settings.noTime}</option>
        {HOURS.map((one) => (
          <option key={one} value={one}>
            {one}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-muted">
        :
      </span>
      <select
        aria-label={strings.settings.minute}
        value={minute}
        onChange={(event) => set(date, hour, event.target.value)}
        className="rounded-md border border-border px-2 py-1.5"
      >
        <option value="">{strings.settings.noTime}</option>
        {minutes.map((one) => (
          <option key={one} value={one}>
            {one}
          </option>
        ))}
      </select>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? <p className="mb-1 mt-0.5 text-xs text-muted">{hint}</p> : <div className="mt-1" />}
      {children}
    </div>
  )
}
