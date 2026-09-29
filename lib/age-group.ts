/**
 * A person's age group (docs/child-age-pricing-PRD.md). Pure.
 *
 * Stored as two flags rather than one enum on purpose: `is_child` predates this
 * and is read by import, export, the guest form, placeholders and seating. An
 * infant is a child with `is_infant` set, so all of that keeps working, and
 * only the places that care about 0–3 look at the second flag.
 *
 *   adult   7+    adult price, counts toward the committed minimum
 *   child   3–7   the budget line's child price
 *   infant  0–3   free — but still takes a chair
 */

export type AgeGroup = 'adult' | 'child' | 'infant'

export const AGE_GROUPS: readonly AgeGroup[] = ['adult', 'child', 'infant'] as const

export function ageGroupOf(person: { is_child: boolean; is_infant?: boolean }): AgeGroup {
  if (!person.is_child) return 'adult'
  return person.is_infant ? 'infant' : 'child'
}

/** The two stored flags for a group — the only way they should be written together. */
export function flagsFor(group: AgeGroup): { is_child: boolean; is_infant: boolean } {
  return { is_child: group !== 'adult', is_infant: group === 'infant' }
}

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === 'string' && (AGE_GROUPS as readonly string[]).includes(value)
}
