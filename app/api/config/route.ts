import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { getConfig, updateConfig } from '@/lib/data'
import type { WeddingConfig } from '@/lib/types'

const EDITABLE_FIELDS = [
  'couple_names',
  'wedding_date_time',
  'venue_name',
  'venue_name_ru',
  'rsvp_deadline',
  'contact_phone',
  'invite_message_template_he',
  'invite_message_template_ru',
  'reminder_message_template_he',
  'reminder_message_template_ru',
  'day_of_message_template_he',
  'day_of_message_template_ru',
  'thank_you_message_template_he',
  'thank_you_message_template_ru',
  'budget_min_guests',
] as const

export async function GET() {
  try {
    if (!(await verifyAdmin())) return unauthorized()
    return ok(await getConfig())
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const body = await readJson(request)
    if (typeof body !== 'object' || body === null) return badRequest('Invalid request body')

    // Allow-list, so `id` and `updated_at` can never be written from a request.
    const update: Partial<WeddingConfig> = {}
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue
      const value = (body as Record<string, unknown>)[field]

      if (field === 'wedding_date_time' || field === 'rsvp_deadline') {
        if (value === null || value === '') {
          update[field] = null
          continue
        }
        if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
          return badRequest(`${field} must be a valid date`)
        }
        update[field] = new Date(value).toISOString()
        continue
      }

      // כמות התחייבות (migration 016): the one numeric field. A whole number,
      // 0 or more — the column's check constraint says the same.
      if (field === 'budget_min_guests') {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          return badRequest(`${field} must be a whole number of zero or more`)
        }
        update[field] = value
        continue
      }

      if (typeof value !== 'string') return badRequest(`${field} must be text`)
      update[field] = value
    }

    if (Object.keys(update).length === 0) return badRequest('Nothing to update')

    return ok(await updateConfig(update))
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
