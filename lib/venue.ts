/**
 * The venue has two jobs, and they are not the same string (PRD §6.7b).
 *
 *   DISPLAY     what a guest reads — follows their language.
 *   NAVIGATION  what Waze searches — always the Hebrew address.
 *
 * Keeping them apart is the whole point of this file. Waze finds
 * `החצר של רוז, המלאכה 27, נתניה`; a Cyrillic transliteration of it may find
 * nothing, and a guest tapping "Как добраться" into a dead end is a worse
 * failure than reading a Hebrew address.
 *
 * Pure — config in, string out.
 */

import type { Language, WeddingConfig } from '@/lib/types'

/**
 * What the guest reads: the preview line, the confirmation, the closed screen.
 *
 * Falls back to the Hebrew when no Russian version is set — correct here,
 * unlike the message templates, where a blank must NOT fall back. A Hebrew
 * address is still usable to a Russian speaker; a whole Hebrew invitation is
 * not, which is why that one is surfaced as a warning instead.
 */
export function venueForDisplay(config: WeddingConfig, language: Language): string {
  if (language === 'ru') {
    const russian = config.venue_name_ru.trim()
    if (russian) return russian
  }
  return config.venue_name
}

/** What Waze searches. Never translated, whatever the household reads. */
export function venueForNavigation(config: WeddingConfig): string {
  return config.venue_name
}
