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
import { strings } from '@/lib/strings'
import { ActionBar } from '@/components/guest/action-bar'
import { Confirmation } from '@/components/guest/confirmation'
import { GuestGreeting, GuestShell } from '@/components/guest/guest-shell'
import { InvitationForm } from '@/components/guest/invitation-form'
import { RsvpClosed } from '@/components/guest/rsvp-closed'
import { RsvpSheet } from '@/components/guest/rsvp-sheet'
import type { Attendee, RsvpResult } from '@/lib/types'

interface RsvpScreenProps {
  token: string
  inviteName: string
  attendees: Attendee[]
  /** null = never answered. */
  attending: boolean | null
  when: string
  venue: string
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
  token,
  inviteName,
  attendees,
  attending,
  when,
  venue,
  phone,
  hasDate,
  rsvpOpen,
}: RsvpScreenProps) {
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
    ? strings.rsvp.nav.yourAnswer
    : saved
      ? strings.rsvp.nav.yourAnswer
      : strings.rsvp.nav.rsvp

  return (
    <GuestShell
      greeting={<GuestGreeting>{strings.rsvp.greeting(inviteName)}</GuestGreeting>}
      bar={
        <ActionBar
          rsvpLabel={label}
          onRsvp={() => setSheetOpen(true)}
          venue={venue}
          hasDate={hasDate}
        />
      }
    >
      <RsvpSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {!rsvpOpen ? (
          <RsvpClosed
            attending={saved ? saved.attending : attending}
            attendees={saved?.attendees ?? attendees}
            when={when}
            venue={venue}
            phone={phone}
          />
        ) : saved && !editing ? (
          <Confirmation
            attending={saved.attending}
            attendees={saved.attendees}
            when={when}
            venue={venue}
            onChangeAnswer={() => setEditing(true)}
          />
        ) : (
          <InvitationForm
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
