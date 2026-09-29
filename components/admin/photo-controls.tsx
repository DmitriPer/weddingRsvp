'use client'

/**
 * The Google Drive card, the QR card and its print sheet, the open/closed
 * switch and the new-key button (docs/wedding-photos-PRD.md §4).
 */

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAction } from '@/components/ui/use-action'
import { Spinner } from '@/components/ui/spinner'
import { formatMegabytes } from '@/lib/photos'
import { jsonInit, requestJson } from '@/lib/request'
import { strings } from '@/lib/strings'
import type { DriveStatus } from '@/lib/types'

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-60 md:min-h-0'

/**
 * WHY THE PRINT SHEET IS PORTALLED TO <body>, with a scoped @media print rule.
 *
 * The admin layout's header and tabs sit outside this component, and it may not
 * be edited. `print:hidden` on our own content can't reach them. The common
 * `visibility: hidden` trick hides them but keeps their height, so a long
 * gallery would still print as several blank pages behind a fixed QR.
 *
 * Rendering the sheet as a direct child of <body> lets one rule remove
 * everything else from the printed flow — `display: none` on every other body
 * child — so exactly one page prints. The <style> lives inside the portal, so
 * it exists only while this page is mounted and affects no other admin screen.
 */
const PRINT_RULE = `@media print {
  body > :not([data-print-qr]) { display: none !important; }
  @page { margin: 12mm; }
}`

/** False on the server and during hydration; true once the DOM exists. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/**
 * Our own SVG: generated on the server by the `qrcode` package from our own
 * URL (site origin + a random key from our database). No user input reaches
 * it, so injecting it as markup is safe.
 */
function QrImage({ svg, className }: { svg: string; className: string }) {
  return <div className={`[&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

function PrintSheet({ svg }: { svg: string }) {
  return (
    <div data-print-qr className="hidden flex-col items-center justify-center gap-6 bg-white text-black print:flex print:min-h-[90vh]">
      <style>{PRINT_RULE}</style>
      <QrImage svg={svg} className="w-[70vmin] max-w-[160mm]" />
      <p className="text-center text-4xl font-semibold">{strings.photos.qrCaption}</p>
      <p lang="ru" dir="ltr" className="text-center text-3xl">
        {strings.photos.qrCaptionRu}
      </p>
    </div>
  )
}

function QrCard({ svg, uploadUrl }: { svg: string; uploadUrl: string }) {
  const isClient = useIsClient()

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{strings.photos.qrTitle}</h3>
      {/* White behind the code whatever the theme: scanners need the contrast. */}
      <QrImage svg={svg} className="w-48 rounded bg-white p-2" />
      <p dir="ltr" className="break-all text-start text-xs text-muted">{uploadUrl}</p>
      <button type="button" onClick={() => window.print()} className={BUTTON}>
        {strings.photos.printQr}
      </button>
      {isClient ? createPortal(<PrintSheet svg={svg} />, document.body) : null}
    </div>
  )
}

/**
 * Connecting is a full page navigation to Google, not a fetch: consent happens
 * on Google's own page, and the callback redirects back here (?drive=…).
 */
function DriveCard({ drive, configured }: { drive: DriveStatus; configured: boolean }) {
  const action = useAction()
  const t = strings.photos

  function disconnect(): void {
    if (!window.confirm(t.confirmDisconnect)) return
    action.run(() => requestJson('/api/google/disconnect', jsonInit('POST')), { success: t.disconnected })
  }

  if (!configured) {
    return <p role="alert" className="text-sm text-warning">{t.driveNotConfigured}</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.driveTitle}</p>
      <p className="text-xs text-muted">{t.driveHint}</p>
      {drive.state === 'disconnected' ? (
        <>
          <p className="text-sm text-muted">{t.driveDisconnected}</p>
          <a href="/api/google/connect" className={BUTTON}>{t.connect}</a>
        </>
      ) : drive.state === 'broken' ? (
        <>
          <p role="alert" className="text-sm text-danger">{t.driveBroken(drive.email)}</p>
          <a href="/api/google/connect" className={BUTTON}>{t.reconnect}</a>
        </>
      ) : (
        <>
          <p className="text-sm text-accent" dir="auto">{t.driveConnected(drive.email)}</p>
          <div className="flex flex-wrap gap-2">
            <a href={drive.folderUrl} target="_blank" rel="noopener noreferrer" className={BUTTON}>
              {t.openFolder}
            </a>
            <button type="button" onClick={disconnect} disabled={action.pending} aria-busy={action.pending} className={BUTTON}>
              {action.pending ? <Spinner /> : null}
              {t.disconnect}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Shows how the Google round trip went (?drive=connected|denied|failed), once,
 * then removes the parameter so a reload doesn't repeat the toast. An effect
 * is right here: it syncs with the URL, an external system.
 */
function DriveResultToast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const result = params.get('drive')

  useEffect(() => {
    if (!result) return
    const t = strings.photos
    if (result === 'connected') toast.success(t.connectedToast)
    else if (result === 'denied') toast.message(t.deniedToast)
    else toast.error(t.failedToast)
    router.replace(pathname)
  }, [result, router, pathname])

  return null
}

function UploadSwitch({ isOpen, canOpen }: { isOpen: boolean; canOpen: boolean }) {
  const action = useAction()

  function toggle(): void {
    action.run(() => requestJson('/api/config', jsonInit('PATCH', { photo_upload_open: !isOpen })))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{strings.photos.openLabel}</p>
      <p role="status" className={`text-sm ${isOpen ? 'text-accent' : 'text-muted'}`}>
        {isOpen ? strings.photos.isOpen : strings.photos.isClosed}
      </p>
      {/* Opening needs a working Drive (the server refuses it too). Closing never does. */}
      <button
        type="button"
        onClick={toggle}
        disabled={action.pending || (!isOpen && !canOpen)}
        aria-busy={action.pending}
        title={!isOpen && !canOpen ? strings.photos.connectFirst : undefined}
        className={BUTTON}
      >
        {action.pending ? <Spinner /> : null}
        {isOpen ? strings.photos.close : strings.photos.open}
      </button>
      {!isOpen && !canOpen ? <p className="text-xs text-muted">{strings.photos.connectFirst}</p> : null}
    </div>
  )
}

function NewKeyButton() {
  const action = useAction()

  function regenerate(): void {
    if (!window.confirm(strings.photos.confirmNewKey)) return
    action.run(() => requestJson('/api/photos/key', jsonInit('POST')), { success: strings.photos.newKeyDone })
  }

  return (
    <button type="button" onClick={regenerate} disabled={action.pending} aria-busy={action.pending} className={BUTTON}>
      {action.pending ? <Spinner /> : null}
      {strings.photos.newKey}
    </button>
  )
}

export function PhotoControls({
  qrSvg,
  uploadUrl,
  isOpen,
  count,
  bytes,
  drive,
  driveConfigured,
}: {
  qrSvg: string
  uploadUrl: string
  isOpen: boolean
  count: number
  bytes: number
  drive: DriveStatus
  driveConfigured: boolean
}): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DriveResultToast />
      <div className="space-y-4 rounded-lg border border-border p-4 md:col-span-2">
        <DriveCard drive={drive} configured={driveConfigured} />
      </div>

      <QrCard svg={qrSvg} uploadUrl={uploadUrl} />

      <div className="space-y-4 rounded-lg border border-border p-4">
        <UploadSwitch isOpen={isOpen} canOpen={drive.state === 'connected'} />
        <NewKeyButton />
        <p className="text-sm text-muted">{strings.photos.stats(count, formatMegabytes(bytes))}</p>
      </div>
    </div>
  )
}
