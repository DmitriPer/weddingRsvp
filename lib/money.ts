/**
 * Money, in agorot (PRD §6.22). The only place they are parsed or formatted.
 *
 * Every amount in the database is an integer number of agorot, because a
 * budget is repeated addition and `0.1 + 0.2 !== 0.3` in JavaScript. Integers
 * add and multiply exactly; the conversion happens here, at the two edges
 * where a human types a number and reads one.
 *
 * Pure — a string in, agorot out, and back.
 */

const AGOROT_PER_SHEKEL = 100

/**
 * What a person typed, as agorot. `null` when it isn't a number at all.
 *
 * Deliberately permissive about how a number is written, because this is typed
 * into a table cell over and over: `8000`, `8,000`, `₪8,000`, `8000.50` and a
 * padded `  8000  ` all mean the same thing. An empty string is `null` rather
 * than `0` — the caller decides whether blank means zero (paid in advance) or
 * a missing required value (the price).
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₪,\s]/g, '')
  if (!cleaned) return null

  /*
   * Rejects '1.2.3', '8k', an empty decimal like '5.', three decimal places,
   * and anything negative. Number() alone would accept some of these and
   * quietly return NaN for others.
   *
   * No leading '-': there is no negative price or negative payment, the column
   * has a CHECK forbidding it, and accepting one here would send a request the
   * server refuses in English. Refusing it in the cell shows the Hebrew
   * message instead. A refund belongs on its own income line.
   */
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const shekels = Number(cleaned)
  if (!Number.isFinite(shekels)) return null

  // Math.round, not truncation: 250.5 * 100 is 25050.000000000004 in binary
  // floating point, and truncating would silently lose an agora.
  return Math.round(shekels * AGOROT_PER_SHEKEL)
}

/** For a table cell being edited: plain digits, no symbol, no separators. */
export function toAmountInput(agorot: number): string {
  const shekels = agorot / AGOROT_PER_SHEKEL
  return Number.isInteger(shekels) ? String(shekels) : shekels.toFixed(2)
}

/**
 * For display: `₪39,500`, or `₪39,500.50` when there are agorot.
 *
 * Whole shekels drop the decimals, because a budget of round contract prices
 * reads as noise with `.00` on every line. `he-IL` places the ₪ before the
 * number, which is what the rest of the admin UI does with currency.
 */
export function formatAmount(agorot: number): string {
  const shekels = agorot / AGOROT_PER_SHEKEL
  const fractionDigits = Number.isInteger(shekels) ? 0 : 2

  return shekels.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/** Same as formatAmount but always signed, for a balance that can go either way. */
export function formatSignedAmount(agorot: number): string {
  const formatted = formatAmount(Math.abs(agorot))
  if (agorot === 0) return formatted
  return agorot > 0 ? `+${formatted}` : `−${formatted}`
}
