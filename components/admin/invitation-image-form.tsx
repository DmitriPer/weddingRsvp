'use client'

/**
 * The guest page's backdrop image, per language (PRD §6.16) — a gallery, not
 * a single slot.
 *
 * Uploading adds a new entry and activates it immediately; it never deletes
 * a previous upload. Clicking any other thumbnail reactivates it without a
 * re-upload. The active thumbnail carries no delete control at all — the API
 * refuses that delete anyway (app/api/config/image/route.ts), so there is
 * nothing to invite an admin to click.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import type { InvitationImage } from '@/lib/data'
import type { Language, WeddingConfig } from '@/lib/types'

/** Drops the `?v=` cache-buster so a gallery entry's URL can be compared
    against the (also cache-busted) active URL in config. */
function stripVersion(url: string): string {
  return url.split('?')[0]
}

export function InvitationImageForm({
  config,
  heImages,
  ruImages,
}: {
  config: WeddingConfig
  heImages: InvitationImage[]
  ruImages: InvitationImage[]
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">{strings.settings.image.title}</h2>
        <p className="mt-0.5 text-xs text-muted">{strings.settings.image.hint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LanguageGallery
          language="he"
          label={strings.settings.image.he}
          activeUrl={config.invitation_image_he}
          images={heImages}
        />
        <LanguageGallery
          language="ru"
          label={strings.settings.image.ru}
          hint={strings.settings.image.ruHint}
          activeUrl={config.invitation_image_ru}
          images={ruImages}
        />
      </div>
    </div>
  )
}

function LanguageGallery({
  language,
  label,
  hint,
  activeUrl,
  images,
}: {
  language: Language
  label: string
  hint?: string
  activeUrl: string
  images: InvitationImage[]
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)

  const activePath = activeUrl ? stripVersion(activeUrl) : null

  async function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const form = new FormData()
    form.append('language', language)
    form.append('file', file)

    setUploading(true)
    const response = await fetch('/api/config/image', { method: 'POST', body: form })
    const body = await response.json()
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''

    if (!body.success) {
      toast.error(body.error || strings.settings.image.failed)
      return
    }
    toast.success(strings.settings.image.uploaded)
    router.refresh()
  }

  async function handleSelect(path: string) {
    setBusyPath(path)
    const response = await fetch('/api/config/image', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, path }),
    })
    const body = await response.json()
    setBusyPath(null)

    if (!body.success) {
      toast.error(body.error || strings.settings.image.selectFailed)
      return
    }
    toast.success(strings.settings.image.selected)
    router.refresh()
  }

  async function handleDelete(path: string) {
    if (!window.confirm(strings.settings.image.confirmDelete)) return

    setBusyPath(path)
    const response = await fetch('/api/config/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, path }),
    })
    const body = await response.json()
    setBusyPath(null)

    if (!body.success) {
      toast.error(body.error || strings.settings.image.deleteFailed)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {hint ? <p className="mb-1 mt-0.5 text-xs text-muted">{hint}</p> : <div className="mt-1" />}

      {images.length === 0 ? (
        <p className="mb-2 text-xs text-muted">{strings.settings.image.empty}</p>
      ) : (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {images.map((image) => {
            const isActive = activePath !== null && stripVersion(image.url) === activePath
            const busy = busyPath === image.path

            return (
              <div key={image.path} className="relative">
                <button
                  type="button"
                  disabled={isActive || busy}
                  onClick={() => handleSelect(image.path)}
                  className={`block w-full overflow-hidden rounded-md border ${
                    isActive ? 'border-accent ring-2 ring-accent' : 'border-border'
                  } disabled:cursor-default`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- an admin-uploaded external Storage URL, not a build-time asset next/image can optimize. */}
                  <img src={image.url} alt={label} className="h-20 w-full object-cover" />
                </button>

                {isActive ? (
                  <span className="absolute right-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                    {strings.settings.image.active}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(image.path)}
                    aria-label={strings.row.delete}
                    className="absolute left-1 top-1 rounded bg-danger/90 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
                  >
                    {strings.row.delete}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChoose}
        disabled={uploading}
        className="hidden"
        id={`invitation-image-input-${language}`}
      />
      <label
        htmlFor={`invitation-image-input-${language}`}
        className="inline-block cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
      >
        {uploading ? strings.settings.image.uploading : strings.settings.image.choose}
      </label>
    </div>
  )
}
