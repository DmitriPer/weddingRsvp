/**
 * Who can be the sender of a first invitation (PRD §6.21): the two people in
 * `wedding_config.couple_names`, split apart.
 *
 * The couple is stored as one display string — `ניקול ודימה` — because that is
 * what titles the .ics event and what the confirmation screen greets with.
 * Splitting it here rather than adding bride_name / groom_name columns means
 * renaming the couple in /admin/settings changes the dropdown immediately, and
 * the names live in exactly one place. The cost is that this has to handle a
 * conjunction, which is what the regex below is.
 *
 * Pure — a string in, options out.
 */

/**
 * The conjunctions this splits on, in the forms actually written here:
 *
 *   `ניקול ודימה`    Hebrew vav, PREFIXED to the second name — the live value
 *   `ניקול ו דימה`   the same, spaced
 *   `Николь и Дима`  Russian, a standalone word
 *   `Nicole & Dima`  also `,` `+` and the English `and`
 *
 * The Hebrew branch requires whitespace BEFORE the vav and a non-space after
 * it, so a vav inside a name (`דוד`, `ויקטוריה`) is never a split point. A name
 * that genuinely begins with vav would lose it — accepted: the alternative is
 * failing to split the one form that is actually in the database.
 *
 * The word conjunctions are whitespace-delimited rather than `\b`-delimited on
 * purpose. `\b` is defined against ASCII `\w`, so `\bи\b` can never match a
 * Cyrillic и at all — it would look correct and silently do nothing. The
 * whitespace form also keeps `and` from matching inside `Alexander`.
 */
const CONJUNCTION = /\s*[&,+]\s*|\s+(?:and|и)\s+|\s+ו\s*(?=\S)/iu

const MAX_SENDERS = 4

/**
 * The dropdown's options.
 *
 * Returns the WHOLE trimmed string as a single option when it can't find two
 * names — a one-item dropdown is honest about what it knows, where silently
 * returning nothing would leave the control unusable with no explanation. An
 * empty config gives an empty list, and the UI then shows the checkbox alone.
 */
export function coupleSenders(coupleNames: string): string[] {
  const whole = coupleNames.trim()
  if (!whole) return []

  const parts = whole
    .split(CONJUNCTION)
    .map((part) => part.trim())
    .filter(Boolean)

  // Deduplicated: two identically-named options are indistinguishable once
  // stored, since the column holds the name and not an index.
  const unique = [...new Set(parts)]

  if (unique.length < 2) return [whole]
  return unique.slice(0, MAX_SENDERS)
}

/**
 * Whether a stored sender is still one of the offered options.
 *
 * The column is free text and the options are derived, so editing
 * `couple_names` can orphan a value already saved on a row. The UI keeps
 * showing an orphan rather than blanking the row — losing a recorded decision
 * silently is worse than an unexpected name in a list.
 */
export function isKnownSender(sender: string | null, senders: string[]): boolean {
  return sender !== null && senders.includes(sender)
}
