/**
 * The admin shell.
 *
 * proxy.ts already blocked unauthenticated requests before this rendered
 * (lock #1), and every API route this page calls re-checks the session itself
 * (lock #2). This layout does not gate anything — it just draws the frame.
 */

import { AdminTabs } from '@/components/admin/admin-tabs'
import { SignOutButton } from '@/components/admin/sign-out-button'
import { strings } from '@/lib/strings'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold">{strings.app.title}</h1>
          <SignOutButton />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <AdminTabs />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
