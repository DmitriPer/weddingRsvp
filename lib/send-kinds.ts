/**
 * Which WhatsApp message a row's button sends, and who it may go to
 * (docs/whatsapp-rounds-PRD.md). Pure — shared by the button, which greys out
 * rows a message does not fit, and the /contacted route, which decides what a
 * confirmed send records.
 *
 * Still one human tap per row (PRD §3.1). Choosing a kind changes WHAT the
 * button prepares, never how many are sent.
 */

import { isAwaitingResponse } from '@/lib/status'
import type { Invite, WeddingConfig } from '@/lib/types'

export const SEND_KINDS = ['invite', 'reminder', 'day_of', 'thank_you'] as const
export type SendKind = (typeof SEND_KINDS)[number]

type TemplateField = Extract<keyof WeddingConfig, `${string}_message_template_${'he' | 'ru'}`>

const FIELDS: Record<SendKind, { he: TemplateField; ru: TemplateField }> = {
  invite: { he: 'invite_message_template_he', ru: 'invite_message_template_ru' },
  reminder: { he: 'reminder_message_template_he', ru: 'reminder_message_template_ru' },
  day_of: { he: 'day_of_message_template_he', ru: 'day_of_message_template_ru' },
  thank_you: { he: 'thank_you_message_template_he', ru: 'thank_you_message_template_ru' },
}

/**
 * The template for this kind in the household's language.
 *
 * `?? ''` because the reminder columns arrive with migration 014: read before
 * it has been run, they are absent, and an absent template is an empty one.
 */
export function templateFor(config: WeddingConfig, invite: Invite, kind: SendKind): string {
  return config[FIELDS[kind][invite.language]] ?? ''
}

export type SendBlock = 'noPhone' | 'notAwaiting' | 'notComing' | 'emptyTemplate'

/** Why this row cannot get this message, or null when it can. */
export function sendBlock(invite: Invite, config: WeddingConfig, kind: SendKind): SendBlock | null {
  if (!invite.phone) return 'noPhone'
  // A reminder to answer, sent to someone who already answered, is the one
  // message here that would read as the couple not keeping track.
  if (kind === 'reminder' && !isAwaitingResponse(invite.status)) return 'notAwaiting'
  if ((kind === 'day_of' || kind === 'thank_you') && invite.answer !== 'yes') return 'notComing'
  if (!templateFor(config, invite, kind).trim()) return 'emptyTemplate'
  return null
}

/**
 * Whether a confirmed send counts toward contact_attempts, which drives the
 * "needs a phone call" flag (PRD §6.10). Only messages chasing an answer do;
 * a day-of or thank-you message is not a follow-up.
 */
export function countsAsAttempt(kind: SendKind): boolean {
  return kind === 'invite' || kind === 'reminder'
}

/** Anything unknown or missing is an invitation — the route's behaviour before kinds existed. */
export function parseSendKind(value: unknown): SendKind {
  return SEND_KINDS.includes(value as SendKind) ? (value as SendKind) : 'invite'
}
