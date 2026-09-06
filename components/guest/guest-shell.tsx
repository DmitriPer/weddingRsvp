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
import { dirFor } from '@/lib/strings'
import type { Language } from '@/lib/types'

interface GuestShellProps {
  lang: Language
  /** Already resolved for this household's language (lib/invitation-image.ts). */
  backdropImage: string
  greeting?: React.ReactNode
  bar?: React.ReactNode
  children?: React.ReactNode
}

/**
 * `lang` and `dir` sit HERE, not on <html> (PRD §6.7b).
 *
 * The root layout cannot see `searchParams`, so it cannot know the token, so it
 * cannot know which language this household reads. It stays `he`/`rtl` for the
 * admin, and the guest subtree overrides both on this wrapper.
 *
 * Hebrew is right-to-left and Russian left-to-right, and `dir` is what flips
 * the layout: every component below lays out with flex and centring, with no
 * physical direction classes, so the whole subtree mirrors from this one
 * attribute. `lang` matters too — it tells the browser which font and hyphenation
 * rules to use, and screen readers which voice.
 */
export function GuestShell({ lang, backdropImage, greeting, bar, children }: GuestShellProps) {
  return (
    <div lang={lang} dir={dirFor(lang)} className="relative flex min-h-dvh flex-col">
      <InvitationBackdrop backdropImage={backdropImage} />

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
 * White frosted, dark-green text, no ring. The colour on this surface is the
 * artwork's own — the pill stays out of its way, the same trick the invitation
 * uses in holding its florals at the border and keeping the middle white.
 */
export function GuestGreeting({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="frosted inline-block rounded-full px-5 py-2 text-lg text-bloom-strong shadow-sm">
      {children}
    </h1>
  )
}
