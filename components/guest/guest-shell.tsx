/**
 * The layout every guest screen sits in, designed for a phone first.
 *
 *   greeting  — a frosted pill at the top
 *   middle    — deliberately empty: the artwork is the content
 *   bar       — the actions, fixed to the bottom
 *
 * `min-h-dvh` rather than `min-h-screen`: `vh` on mobile Safari measures the
 * viewport *without* the browser chrome, so a full-height layout puts its last
 * element behind the address bar. `dvh` tracks the visible area as the chrome
 * shows and hides.
 */

import { InvitationBackdrop } from '@/components/guest/invitation-backdrop'

interface GuestShellProps {
  greeting?: React.ReactNode
  bar?: React.ReactNode
  children?: React.ReactNode
}

export function GuestShell({ greeting, bar, children }: GuestShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <InvitationBackdrop />

      {greeting ? <header className="px-4 pt-6 text-center">{greeting}</header> : null}

      {/* The empty middle. Content only appears here on the landing page. */}
      <main className="flex flex-1 flex-col justify-center px-4">{children}</main>

      {bar ? <div className="sticky bottom-0 px-4 safe-bottom">{bar}</div> : null}
    </div>
  )
}

/**
 * The greeting pill.
 *
 * White frosted, dark-green text, a thin lilac ring. The palette is present as
 * an EDGE, not a fill: its five colours sit at almost identical lightness, so
 * green on any of them lands between 1.65:1 and 2.28:1 — unreadable. A ring
 * carries the colour at no cost to the text, which is the same trick the
 * invitation uses, holding its florals at the border and keeping the middle white.
 */
export function GuestGreeting({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="frosted inline-block rounded-full px-5 py-2 text-lg text-bloom-strong shadow-sm ring-1 ring-bloom-lilac">
      {children}
    </h1>
  )
}
