/**
 * Empty, loading, and error states (PRD §6.19).
 *
 * Every list and form uses all three. A blank box is a bug — on first run there
 * are zero guests, and a screen that renders nothing looks broken rather than
 * empty.
 */

import { strings } from '@/lib/strings'

export function LoadingState({ label = strings.app.loading }: { label?: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted" role="status" aria-live="polite">
      {label}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="py-12 text-center" role="alert">
      <p className="text-danger">{message || strings.app.error}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {strings.app.retry}
        </button>
      ) : null}
    </div>
  )
}
