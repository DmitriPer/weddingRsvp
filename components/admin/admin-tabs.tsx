'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { strings } from '@/lib/strings'

/**
 * Three tabs, not five.
 *
 * Statistics folded into the top of the invitees screen — they are four numbers
 * and read better beside the list than on their own page. Answers folded into a
 * history modal opened from a guest's row, since the row already shows status,
 * headcount, and each person's approved/declined.
 */
const TABS = [
  { href: '/admin', label: strings.admin.tabs.invitees },
  { href: '/admin/seating', label: strings.admin.tabs.seating },
  { href: '/admin/settings', label: strings.admin.tabs.settings },
] as const

function isActive(pathname: string, href: string): boolean {
  // '/admin' would otherwise match every child route.
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

export function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label={strings.app.title}>
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              active ? 'bg-surface font-medium text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
