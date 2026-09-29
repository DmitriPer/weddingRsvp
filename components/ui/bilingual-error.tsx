/**
 * The guest-facing error screen (docs/error-loading-PRD.md), shared by
 * app/error.tsx and app/global-error.tsx.
 *
 * Hebrew and Russian together, each in its own direction. When this renders
 * the page itself has failed, so the household — and with it the language —
 * may never have loaded; showing both is the only way to be understood.
 *
 * Mobile first: guests arrive from a WhatsApp link on a phone.
 */

import { strings } from '@/lib/strings'

export function BilingualError({ onRetry }: { onRetry: () => void }) {
  const { he, ru } = strings.fallback

  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div dir="rtl" lang="he">
        <p className="text-lg font-semibold">{he.title}</p>
        <p className="text-sm text-muted">{he.body}</p>
      </div>
      <div dir="ltr" lang="ru">
        <p className="text-lg font-semibold">{ru.title}</p>
        <p className="text-sm text-muted">{ru.body}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-md bg-accent px-6 text-sm font-medium text-white"
      >
        {he.retry} · <span lang="ru">{ru.retry}</span>
      </button>
    </div>
  )
}
