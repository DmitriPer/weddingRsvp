/**
 * The busy indicator inside a button or row (docs/error-loading-PRD.md §4.1).
 *
 * Sized to the surrounding text and drawn in `currentColor`, so it fits a
 * white-on-green primary button and a muted ✕ alike without variants.
 * Decorative: the control it sits in carries the state via `aria-busy` and
 * `disabled`, and its label.
 */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-[1em] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] ${className}`}
    />
  )
}
