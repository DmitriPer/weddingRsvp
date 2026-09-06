/**
 * The guest page's backdrop image, per language (PRD §6.16) — a gallery, not a
 * single slot.
 *
 *   POST    upload a new image. A picture, not data — one wrong upload is a
 *           one-click re-upload, unlike the spreadsheet importer
 *           (app/api/invites/import), so there is no preview step. Uploads
 *           accumulate; they never overwrite (lib/data's uploadInvitationImage).
 *   PATCH   make an already-uploaded image active again. No Storage write.
 *   DELETE  remove a previously-uploaded image permanently. Refused when the
 *           image is the currently active one — checked HERE, not in lib/data,
 *           so a guest can never end up pointed at a file that no longer
 *           exists.
 */

import type { NextRequest } from 'next/server'
import { badRequest, fromThrown, ok, readJson, unauthorized } from '@/lib/api'
import { verifyAdmin } from '@/lib/auth'
import { deleteInvitationImage, getConfig, selectInvitationImage, uploadInvitationImage } from '@/lib/data'
import { LANGUAGES, type Language } from '@/lib/types'

// A backdrop, not a print. This repo doesn't resize images at request time —
// `sharp` is a build-script-only devDependency (see docs/progress.md) — so the
// cap is enforced rather than the file optimized.
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Shared by PATCH and DELETE — both take the same `{ language, path }` shape. */
async function parseLanguageAndPath(
  request: NextRequest
): Promise<{ language: Language; path: string } | { error: string }> {
  const body = await readJson(request)
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' }

  const { language, path } = body as Record<string, unknown>
  if (!LANGUAGES.includes(language as Language)) return { error: 'שפה לא תקינה' }
  if (typeof path !== 'string' || !path) return { error: 'נתיב לא תקין' }

  return { language: language as Language, path }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const form = await request.formData()
    const language = form.get('language')
    const file = form.get('file')

    if (!LANGUAGES.includes(language as Language)) return badRequest('שפה לא תקינה')
    if (!(file instanceof File)) return badRequest('לא נבחר קובץ')
    if (file.size === 0) return badRequest('הקובץ ריק')
    if (file.size > MAX_BYTES) return badRequest('הקובץ גדול מדי (עד 2MB)')
    if (!ALLOWED_TYPES.includes(file.type)) return badRequest('יש להעלות תמונת JPEG, PNG או WebP')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const config = await uploadInvitationImage(language as Language, bytes, file.type)

    return ok(config)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = await parseLanguageAndPath(request)
    if ('error' in parsed) return badRequest(parsed.error)

    const config = await selectInvitationImage(parsed.language, parsed.path)
    return ok(config)
  } catch (thrown) {
    return fromThrown(thrown)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifyAdmin())) return unauthorized()

    const parsed = await parseLanguageAndPath(request)
    if ('error' in parsed) return badRequest(parsed.error)
    const { language, path } = parsed

    // The active URL carries a `?v=` cache-buster the stored path doesn't —
    // compare by suffix rather than requiring an exact match.
    const config = await getConfig()
    const activeUrl = language === 'ru' ? config.invitation_image_ru : config.invitation_image_he
    if (activeUrl.split('?')[0].endsWith(path)) {
      return badRequest('לא ניתן למחוק את התמונה הפעילה')
    }

    await deleteInvitationImage(language, path)
    return ok({ deleted: true })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
