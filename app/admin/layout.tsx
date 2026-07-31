/**
 * The admin shell.
 *
 * proxy.ts already blocked unauthenticated requests before this rendered
 * (lock #1), and every API route this page calls re-checks the session itself
 * (lock #2). This layout does not gate anything — it just draws the frame.
 */

import Image from 'next/image'
import { AdminTabs } from '@/components/admin/admin-tabs'
import { SignOutButton } from '@/components/admin/sign-out-button'
import { strings } from '@/lib/strings'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {/* The couple's monogram, the same mark the invitation carries.
                Decorative beside the title, so it is hidden from screen
                readers rather than read out as a second heading.

                `unoptimized` because the source is SVG: the image optimiser
                refuses SVG unless dangerouslyAllowSVG is turned on, and there
                is nothing for it to do to a 3.8 KB vector anyway. */}
            <Image
              src="/assets/wedding-logo.svg"
              alt=""
              aria-hidden
              width={30}
              height={26}
              unoptimized
              priority
            />
            <h1 className="text-lg font-semibold">{strings.app.title}</h1>
          </div>
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
