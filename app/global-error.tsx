'use client'

/**
 * Last resort (docs/error-loading-PRD.md): shown only when the ROOT layout
 * itself fails, which no other error.tsx can catch. It replaces the root
 * layout, so it brings its own <html>, <body> and stylesheet.
 *
 * A full reload rather than unstable_retry: whatever broke the root layout is
 * as likely to break a soft re-render, and a reload is what a guest would try
 * anyway.
 */

import './globals.css'
import { BilingualError } from '@/components/ui/bilingual-error'
import { strings } from '@/lib/strings'

export default function GlobalError() {
  return (
    <html lang="he" dir="rtl">
      <body>
        <title>{strings.fallback.he.title}</title>
        <BilingualError onRetry={() => window.location.reload()} />
      </body>
    </html>
  )
}
