/**
 * THE message template renderer.
 *
 * Templates hold {{name}} and {{link}}. Three of them live in wedding_config —
 * invite, day-of, thank-you — each independently editable (PRD §6.5).
 *
 * This file knows nothing about WhatsApp. Turning a rendered message into a
 * wa.me URL is lib/links.ts.
 */

import type { Invite } from '@/lib/types'
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
    link: buildInviteLink(invite.token),
  }
}

export function renderForInvite(template: string, invite: Invite): string {
  return renderTemplate(template, templateValuesForInvite(invite))
}

/** Powers the live preview in the template editor (PRD §6.5). */
export function renderPreview(template: string): string {
  return renderTemplate(template, {
    name: 'סלבה',
    link: buildInviteLink('00000000-0000-0000-0000-000000000000'),
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
