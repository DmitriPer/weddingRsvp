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
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/datetime'
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
          <input
            id="wedding-at"
            type="datetime-local"
            dir="ltr"
            value={weddingAt}
            onChange={(event) => setWeddingAt(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5"
          />
        </Field>

        <Field
          label={strings.settings.deadline}
          htmlFor="deadline"
          hint={strings.settings.deadlineHint}
        >
          <input
            id="deadline"
            type="datetime-local"
            dir="ltr"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5"
          />
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
