import { redirect } from 'next/navigation'

/** One game so far; /games opens it (docs/games-bingo-PRD.md §3.1). */
export default function GamesPage(): never {
  redirect('/games/bingo')
}
