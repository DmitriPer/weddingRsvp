'use client'

/**
 * The guest's screen: the invitation, a greeting, and the action bar that
 * raises the sheet.
 *
 * The invitation is what a guest sees first — the sheet starts closed. Opening
 * it shows the form, or, for someone who has already answered, their saved
 * answer with a button to change it. Re-opening the link is usually a "did it
 * save?" check, so the answer comes before the form.
 *
 * This component decides which screen is in the sheet and holds the latest
 * saved answer. It contains no business logic beyond that.
 */

import { useState } from 'react'
import { guestText } from '@/lib/strings'
import { ActionBar } from '@/components/guest/action-bar'
import { Confirmation } from '@/components/guest/confirmation'
import { GuestGreeting, GuestShell } from '@/components/guest/guest-shell'
import { InvitationForm } from '@/components/guest/invitation-form'
import { RsvpClosed } from '@/components/guest/rsvp-closed'
import { RsvpSheet } from '@/components/guest/rsvp-sheet'
import type { Attendee, Language, RsvpResult } from '@/lib/types'

interface RsvpScreenProps {
  lang: Language
  token: string
  inviteName: string
  attendees: Attendee[]
  /** null = never answered. */
  attending: boolean | null
  when: string
  /** What the guest READS. Follows their language (lib/venue.ts). */
  venue: string
  /** What Waze searches. Always the Hebrew address. */
  venueForNav: string
  phone: string
  hasDate: boolean
  /** False past the deadline. The server enforces it either way (PRD §6.3). */
  rsvpOpen: boolean
}

interface SavedAnswer {
  attending: boolean
  attendees: Attendee[]
}

export function RsvpScreen({
  lang,
  token,
  inviteName,
  attendees,
  attending,
  when,
  venue,
  venueForNav,
  phone,
  hasDate,
  rsvpOpen,
}: RsvpScreenProps) {
  const t = guestText(lang)
  const [saved, setSaved] = useState<SavedAnswer | null>(
    attending === null ? null : { attending, attendees }
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(attending === null)

  function handleSubmitted(result: RsvpResult) {
    setSaved({
      // The route always writes a boolean; null only exists before a first
      // answer, which by definition is no longer the case here.
      attending: result.invite.attending ?? false,
      attendees: result.invite.attendees,
    })
    setEditing(false)
  }

  const label = !rsvpOpen
    ? t.rsvp.nav.yourAnswer
    : saved
      ? t.rsvp.nav.yourAnswer
      : t.rsvp.nav.rsvp

  return (
    <GuestShell
      lang={lang}
      greeting={<GuestGreeting>{t.rsvp.greeting(inviteName)}</GuestGreeting>}
      bar={
        <ActionBar
          lang={lang}
          rsvpLabel={label}
          onRsvp={() => setSheetOpen(true)}
          venue={venueForNav}
          hasDate={hasDate}
        />
      }
    >
      <RsvpSheet lang={lang} open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {!rsvpOpen ? (
          <RsvpClosed
            lang={lang}
            attending={saved ? saved.attending : attending}
            attendees={saved?.attendees ?? attendees}
            when={when}
            venue={venue}
            phone={phone}
          />
        ) : saved && !editing ? (
          <Confirmation
            lang={lang}
            attending={saved.attending}
            attendees={saved.attendees}
            when={when}
            venue={venue}
            onChangeAnswer={() => setEditing(true)}
          />
        ) : (
          <InvitationForm
            lang={lang}
            token={token}
            attendees={saved?.attendees ?? attendees}
            initialAttending={saved?.attending ?? attending}
            onSubmitted={handleSubmitted}
            onCancel={saved ? () => setEditing(false) : undefined}
          />
        )}
      </RsvpSheet>
    </GuestShell>
  )
}
