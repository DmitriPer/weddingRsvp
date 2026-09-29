/**
 * The /games shell (docs/games-bingo-PRD.md §3.1): a vertical game list on the
 * start side (right, in RTL) and the game beside it. Desktop first, like the
 * rest of the admin surface; below `md` the list becomes a strip above the game
 * so the cards get the full width (§3.7).
 *
 * proxy.ts gates /games like /admin (lock #1); each page re-checks, and each
 * API route verifies the session itself (lock #2).
 *
 * The card's two extra fonts load here, not in the root layout, so no other
 * page downloads them. next/font self-hosts them: no Google Fonts request, no
 * render-blocking stylesheet, no layout shift when they arrive.
 */

import Link from 'next/link'
import { Manrope, Parisienne } from 'next/font/google'
import { GamesNav } from '@/components/games/games-nav'
import { strings } from '@/lib/strings'

/** "Nicole & Dima" on the card — Latin letters only. */
const script = Parisienne({
  variable: '--font-script',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

/** The Russian card's body text. */
const cyrillic = Manrope({
  variable: '--font-cyrillic',
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
})

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${script.variable} ${cyrillic.variable} flex flex-1 flex-col`}>
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold">{strings.games.title}</h1>
          <Link href="/admin" className="text-sm text-muted hover:text-foreground">
            {strings.games.backToAdmin}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:gap-6 md:py-6 print:block print:max-w-none print:p-0">
        <aside className="md:w-48 md:shrink-0 print:hidden">
          <GamesNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
