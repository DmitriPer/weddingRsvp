'use client'

/**
 * The guest photo upload page's body (docs/wedding-photos-PRD.md §3). Mobile
 * first: it opens from a QR code on a phone at the wedding.
 *
 * Each file goes through: resize on the phone → one POST, which our server
 * passes into Google Drive (lib/image-resize.ts, lib/photo-upload.ts). Three
 * at a time. One bad file never stops the others; a failed one can be
 * retried alone.
 *
 * Hebrew by default, with a Русский toggle: the QR can't know who scanned it.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { dirFor, guestText } from '@/lib/strings'
import { resizePhoto } from '@/lib/image-resize'
import { runPool, uploadPhoto, UploadError, type UploadRefusal } from '@/lib/photo-upload'
import { MAX_FILES_PER_BATCH, MAX_NAME_LENGTH, UPLOAD_CONCURRENCY } from '@/lib/photos'
import type { Language } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'

type ItemStatus = 'waiting' | 'preparing' | 'uploading' | 'done' | 'failed' | 'notImage'

interface UploadItem {
  key: string
  file: File
  status: ItemStatus
  /** 0–1, while uploading. */
  progress: number
}

export function PhotoUploader({ uploadKey }: { uploadKey: string }): React.JSX.Element {
  const [lang, setLang] = useState<Language>('he')
  const [name, setName] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const [running, setRunning] = useState(false)
  const [refusal, setRefusal] = useState<'invalid' | 'closed' | null>(null)
  const t = guestText(lang).photos

  function patch(key: string, change: Partial<UploadItem>): void {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }

  /** What to do when the server refuses: gate screen, or a toast and "failed". */
  function onRefused(reason: UploadRefusal): void {
    if (reason === 'invalid' || reason === 'closed') setRefusal(reason)
    else if (reason === 'notReady') toast.error(t.notReady, { id: 'photos-refused' })
    else if (reason === 'busy') toast.error(t.busy, { id: 'photos-refused' })
  }

  /** resize → upload, for one file. */
  async function uploadOne(item: UploadItem): Promise<void> {
    patch(item.key, { status: 'preparing', progress: 0 })
    let photo: Blob
    try {
      photo = await resizePhoto(item.file)
    } catch {
      patch(item.key, { status: 'notImage' })
      return
    }
    try {
      patch(item.key, { status: 'uploading' })
      await uploadPhoto(uploadKey, name, photo, (fraction) => patch(item.key, { progress: fraction }))
      patch(item.key, { status: 'done', progress: 1 })
    } catch (thrown) {
      if (thrown instanceof UploadError) onRefused(thrown.reason)
      patch(item.key, { status: 'failed' })
    }
  }

  /** Three at a time: more gains nothing on one Wi-Fi connection. */
  async function uploadBatch(batch: UploadItem[]): Promise<void> {
    setRunning(true)
    try {
      await runPool(batch, UPLOAD_CONCURRENCY, uploadOne)
    } finally {
      setRunning(false)
    }
  }

  function onPick(files: FileList | null): void {
    if (!files || files.length === 0 || running) return
    const picked = Array.from(files)
    if (picked.length > MAX_FILES_PER_BATCH) toast.message(t.tooMany(MAX_FILES_PER_BATCH))
    const batch = picked.slice(0, MAX_FILES_PER_BATCH).map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'waiting' as const,
      progress: 0,
    }))
    setItems((current) => [...current, ...batch])
    void uploadBatch(batch)
  }

  function retry(item: UploadItem): void {
    if (running) return
    patch(item.key, { status: 'waiting', progress: 0 })
    void uploadBatch([{ ...item, status: 'waiting', progress: 0 }])
  }

  if (refusal === 'invalid' || refusal === 'closed') {
    return <RefusedCard lang={lang} reason={refusal} />
  }

  const done = items.filter((item) => item.status === 'done').length
  const finished = items.length > 0 && !running && items.every((item) => item.status !== 'waiting' && item.status !== 'preparing' && item.status !== 'uploading')

  return (
    <div lang={lang} dir={dirFor(lang)} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6">
      <button
        type="button"
        onClick={() => setLang(lang === 'he' ? 'ru' : 'he')}
        className="self-end rounded-full border border-border px-4 py-1.5 text-sm min-h-11"
      >
        {t.switchLanguage}
      </button>

      <header className="text-center">
        <h1 className="text-2xl font-semibold text-bloom-strong">{t.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.intro}</p>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        {t.nameLabel}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t.namePlaceholder}
          disabled={running}
          className="rounded-md border border-border bg-background px-3 py-3 text-base"
        />
      </label>

      <label
        aria-disabled={running}
        className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-6 text-lg font-medium text-white ${running ? 'opacity-60' : ''}`}
      >
        {running ? <Spinner /> : null}
        {items.length > 0 ? t.chooseMore : t.choose}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={running}
          // Reset so picking the same photo again still fires onChange.
          onChange={(event) => {
            onPick(event.target.files)
            event.target.value = ''
          }}
          className="sr-only"
        />
      </label>

      {items.length > 0 ? (
        <p role="status" aria-live="polite" className="text-center text-sm">
          {finished && done > 0 ? t.allDone(done) : t.progress(done, items.length)}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <UploadRow key={item.key} item={item} lang={lang} onRetry={() => retry(item)} canRetry={!running} />
        ))}
      </ul>
    </div>
  )
}

function UploadRow({
  item,
  lang,
  onRetry,
  canRetry,
}: {
  item: UploadItem
  lang: Language
  onRetry: () => void
  canRetry: boolean
}): React.JSX.Element {
  const t = guestText(lang).photos
  const label: Record<ItemStatus, string> = {
    waiting: t.preparing,
    preparing: t.preparing,
    uploading: t.uploading,
    done: t.done,
    failed: t.failed,
    notImage: t.notImage,
  }
  const busy = item.status === 'waiting' || item.status === 'preparing' || item.status === 'uploading'

  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate" dir="ltr">
          {item.file.name}
        </span>
        {busy ? <Spinner className="text-muted" /> : null}
        <span className={item.status === 'done' ? 'text-accent' : item.status === 'failed' || item.status === 'notImage' ? 'text-danger' : 'text-muted'}>
          {item.status === 'done' ? '✓ ' : ''}
          {label[item.status]}
        </span>
        {item.status === 'failed' ? (
          <button type="button" onClick={onRetry} disabled={!canRetry} className="min-h-11 rounded px-2 text-accent underline disabled:opacity-50">
            {t.retry}
          </button>
        ) : null}
      </div>
      {item.status === 'uploading' ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
        </div>
      ) : null}
    </li>
  )
}

/** A bad key or a closed switch, discovered mid-session. Same card as the server's. */
function RefusedCard({ lang, reason }: { lang: Language; reason: 'invalid' | 'closed' }): React.JSX.Element {
  return <PhotoGateMessage reason={reason} focus={lang} />
}

/**
 * Both languages, because the page may not know which one the guest reads.
 * Exported for the server page, which shows it before any upload is tried.
 */
export function PhotoGateMessage({
  reason,
  focus = 'he',
}: {
  reason: 'invalid' | 'closed'
  focus?: Language
}): React.JSX.Element {
  const order: Language[] = focus === 'ru' ? ['ru', 'he'] : ['he', 'ru']
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      {order.map((language) => {
        const t = guestText(language).photos
        return (
          <div key={language} lang={language} dir={dirFor(language)}>
            <p className="text-lg font-semibold">{reason === 'invalid' ? t.invalidTitle : t.closedTitle}</p>
            <p className="text-sm text-muted">{reason === 'invalid' ? t.invalidBody : t.closedBody}</p>
          </div>
        )
      })}
    </div>
  )
}
