'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { strings } from '@/lib/strings'

/**
 * The vertical game list (docs/games-bingo-PRD.md §3.1). One entry today; a new
 * game is a new line here plus its route under app/games/.
 */
const GAMES = [{ href: '/games/bingo', label: strings.games.nav.bingo }] as const

export function GamesNav() {
  const pathname = usePathname()

  return (
    <nav aria-label={strings.games.navLabel} className="flex gap-1 overflow-x-auto md:flex-col">
      {GAMES.map((game) => {
        const active = pathname.startsWith(game.href)
        return (
          <Link
            key={game.href}
            href={game.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm md:min-h-0 md:py-2 ${
              active ? 'bg-surface font-medium text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {game.label}
          </Link>
        )
      })}
    </nav>
  )
}
