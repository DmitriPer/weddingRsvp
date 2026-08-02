/**
 * THE message template renderer.
 *
 * Templates hold {{name}} and {{link}}. Three of them live in wedding_config —
 * invite, day-of, thank-you — each independently editable (PRD §6.5).
 *
 * This file knows nothing about WhatsApp. Turning a rendered message into a
 * wa.me URL is lib/links.ts.
 */

import type { Invite, Language } from '@/lib/types'
import { buildInviteLink } from '@/lib/links'

export const TEMPLATE_VARIABLES = ['name', 'link'] as const
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export type TemplateValues = Record<TemplateVariable, string>

/** Replaces {{name}} and {{link}}. Unknown placeholders are left untouched. */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, variable: string) => {
    const key = variable as TemplateVariable
    return key in values ? values[key] : whole
  })
}

export function templateValuesForInvite(invite: Invite): TemplateValues {
  return {
    name: invite.name,
    // The invite's OWN language, so the link a Russian household receives
    // carries &lang=ru. Without it WhatsApp's crawler has nothing to select on
    // and shows the Hebrew card — which would have silently defeated the whole
    // per-language preview design, since the link in the message is the only
    // one a guest ever clicks.
    link: buildInviteLink(invite.token, invite.language),
  }
}

export function renderForInvite(template: string, invite: Invite): string {
  return renderTemplate(template, templateValuesForInvite(invite))
}

/**
 * Powers the live preview in the template editor (PRD §6.5).
 *
 * The sample name follows the template's language. A Hebrew name inside a
 * Russian message previews as "Здравствуйте, סלבה" — which is not what any
 * guest would receive, and the preview exists precisely because a template is
 * never seen rendered until it has already been sent.
 *
 * The sample link carries the language too, so the preview shows the `&lang=ru`
 * a Russian guest's real link would have.
 */
const PREVIEW_NAME: Record<Language, string> = { he: 'סלבה', ru: 'Слава' }

export function renderPreview(template: string, language: Language = 'he'): string {
  return renderTemplate(template, {
    name: PREVIEW_NAME[language],
    link: buildInviteLink('00000000-0000-0000-0000-000000000000', language),
  })
}

/** Placeholders in the template that this renderer does not understand. */
export function unknownVariables(template: string): string[] {
  const found = template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)
  const unknown = new Set<string>()
  for (const match of found) {
    const name = match[1] as TemplateVariable
    if (!TEMPLATE_VARIABLES.includes(name)) unknown.add(match[1])
  }
  return [...unknown]
}
