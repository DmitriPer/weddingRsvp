/**
 * THE phone normaliser (PRD §6.9). Pure: a typed string in, a canonical one out.
 *
 * Why it exists: every guest is Israeli, Israeli numbers are written `05…`, and
 * `wa.me` takes digits only. A number stored as typed produced
 * `wa.me/0549546899`, which resolves to nothing — a link that looked correct
 * and simply never reached anyone. Requiring `+972…` on 150 rows was friction
 * with a silent failure waiting behind it.
 *
 * Applied at every entry point (the add form, the edit form, the importer) so
 * the database holds ONE form and nothing downstream has to think about it.
 *
 * A LEADING `+` IS NEVER TOUCHED. That is the escape hatch: every guest is
 * Israeli today, and a foreign number typed with `+` passes through intact
 * without any code change.
 */

/** Israel. A named constant because it is an assumption, not a fact of the code. */
const COUNTRY_CODE = '972'

/**
 * Israeli subscriber numbers are 8 or 9 digits after the country code —
 * mobile `5X XXXXXXX` (9) and landline `X XXXXXXX` (8). Used only to decide
 * whether a bare digit string is plausibly local.
 */
const LOCAL_LENGTHS = [8, 9]

export interface NormalisedPhone {
  /** What to store. Never null unless the input was empty. */
  value: string | null
  /** True when the input was changed, so a caller can say so. */
  changed: boolean
  /**
   * True when the shape was not recognised. The value is then stored AS TYPED
   * rather than guessed at — a wrong number that looks right is worse than one
   * that looks wrong.
   */
  unrecognised: boolean
}

const EMPTY: NormalisedPhone = { value: null, changed: false, unrecognised: false }

export function normalisePhone(input: string | null | undefined): NormalisedPhone {
  const raw = (input ?? '').trim()
  if (!raw) return EMPTY

  // Everything a person might separate digits with: spaces, dashes, dots,
  // brackets, and the RTL/LTR marks a Hebrew keyboard can leave behind.
  const cleaned = raw.replace(/[\s\-().‎‏‪-‮]/g, '')

  // Already international. Left exactly as it is — including a foreign number.
  if (cleaned.startsWith('+')) {
    return { value: cleaned, changed: cleaned !== raw, unrecognised: false }
  }

  // `00` is the international access prefix: 00972… means +972…
  if (cleaned.startsWith('00')) {
    return { value: `+${cleaned.slice(2)}`, changed: true, unrecognised: false }
  }

  if (!/^\d+$/.test(cleaned)) {
    // Letters or symbols in the middle — not something to guess at.
    return { value: raw, changed: false, unrecognised: true }
  }

  // 972549546899 — the country code without its plus.
  if (cleaned.startsWith(COUNTRY_CODE)) {
    const rest = cleaned.slice(COUNTRY_CODE.length).replace(/^0+/, '')
    if (LOCAL_LENGTHS.includes(rest.length)) {
      return { value: `+${COUNTRY_CODE}${rest}`, changed: true, unrecognised: false }
    }
    return { value: raw, changed: false, unrecognised: true }
  }

  // 0549546899 — the local form, which is what anyone here actually writes.
  if (cleaned.startsWith('0')) {
    const rest = cleaned.slice(1)
    if (LOCAL_LENGTHS.includes(rest.length)) {
      return { value: `+${COUNTRY_CODE}${rest}`, changed: true, unrecognised: false }
    }
    return { value: raw, changed: false, unrecognised: true }
  }

  // 549546899 — local, with the trunk zero already dropped.
  if (LOCAL_LENGTHS.includes(cleaned.length)) {
    return { value: `+${COUNTRY_CODE}${cleaned}`, changed: true, unrecognised: false }
  }

  return { value: raw, changed: false, unrecognised: true }
}

/** When only the stored value matters. */
export function toStoredPhone(input: string | null | undefined): string | null {
  return normalisePhone(input).value
}
