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
import { jsonInit, requestJson } from '@/lib/request'
import { strings } from '@/lib/strings'
import type { InvitationImage } from '@/lib/data'
import type { Language, WeddingConfig } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/components/ui/use-action'

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
}): React.JSX.Element {
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
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useAction()
  // Select and delete share one action: while either runs, every thumbnail is
  // locked, so a second click can't race the first before the refresh lands.
  const gallery = useAction()
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const busy = upload.pending || gallery.pending

  const activePath = activeUrl ? stripVersion(activeUrl) : null

  function handleChoose(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return

    const form = new FormData()
    form.append('language', language)
    form.append('file', file)
    // Cleared now, so choosing the same file again (after a failure) still fires onChange.
    if (fileInput.current) fileInput.current.value = ''

    upload.run(
      () =>
        requestJson('/api/config/image', { method: 'POST', body: form }, strings.settings.image.failed),
      { success: strings.settings.image.uploaded, failure: strings.settings.image.failed }
    )
  }

  function handleSelect(path: string): void {
    setBusyPath(path)
    gallery.run(
      () =>
        requestJson(
          '/api/config/image',
          jsonInit('PATCH', { language, path }),
          strings.settings.image.selectFailed
        ),
      { success: strings.settings.image.selected, failure: strings.settings.image.selectFailed }
    )
  }

  function handleDelete(path: string): void {
    if (!window.confirm(strings.settings.image.confirmDelete)) return

    setBusyPath(path)
    gallery.run(
      () =>
        requestJson(
          '/api/config/image',
          jsonInit('DELETE', { language, path }),
          strings.settings.image.deleteFailed
        ),
      { failure: strings.settings.image.deleteFailed }
    )
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>

      {images.length === 0 ? (
        <p className="mb-2 text-xs text-muted">{strings.settings.image.empty}</p>
      ) : (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {images.map((image) => {
            const isActive = activePath !== null && stripVersion(image.url) === activePath
            const isBusyTile = gallery.pending && busyPath === image.path

            return (
              <div key={image.path} className="relative" aria-busy={isBusyTile}>
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

                {/* On the tile being selected or deleted, until the refreshed
                    gallery moves the ring or drops the tile. */}
                {isBusyTile ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/40 text-lg text-white">
                    <Spinner />
                  </span>
                ) : null}

                {isActive ? (
                  <span className="absolute start-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                    {strings.settings.image.active}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(image.path)}
                    aria-label={strings.row.delete}
                    className="absolute end-1 top-1 rounded bg-danger/90 px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
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
        disabled={busy}
        className="hidden"
        id={`invitation-image-input-${language}`}
      />
      <label
        htmlFor={`invitation-image-input-${language}`}
        aria-disabled={busy}
        aria-busy={upload.pending}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface aria-disabled:cursor-default aria-disabled:opacity-60"
      >
        {upload.pending ? <Spinner /> : null}
        {upload.pending ? strings.settings.image.uploading : strings.settings.image.choose}
      </label>
      {/* Last, like the settings fields: above the gallery it dropped only the
          Russian slot lower than the Hebrew one. */}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
