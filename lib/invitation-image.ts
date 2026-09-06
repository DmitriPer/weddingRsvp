/**
 * The guest page's full-screen background image (PRD §6.16). Pure — config
 * in, a URL out.
 *
 * Blank Russian falls back to the Hebrew image, same reasoning as
 * `venueForDisplay` (lib/venue.ts): a Russian household seeing the Hebrew
 * artwork is a lesser gap than seeing no background at all.
 */

import type { Language, WeddingConfig } from '@/lib/types'

export function invitationImageForLanguage(config: WeddingConfig, language: Language): string {
  if (language === 'ru') {
    const russian = config.invitation_image_ru.trim()
    if (russian) return russian
  }
  return config.invitation_image_he
}
