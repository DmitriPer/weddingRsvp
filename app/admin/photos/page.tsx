/**
 * Guest photos (docs/wedding-photos-PRD.md §4): the Google Drive connection,
 * the QR code for the tables, the open/closed switch and the counter. The
 * photos themselves live in Drive; "open the folder" is the gallery.
 *
 * The QR is drawn HERE, on the server, as an SVG string. The key never has to
 * reach a client bundle as data to be encoded, and regenerating the key is just
 * a refresh: the page redraws the code from the new key.
 */

import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { verifyAdmin } from '@/lib/auth'
import { getConfig, getDriveConnection, photoStats } from '@/lib/data'
import { accessToken, checkFolder, folderUrl, isDriveConfigured } from '@/lib/google-drive'
import { buildAbsoluteUrl } from '@/lib/links'
import { strings } from '@/lib/strings'
import type { DriveStatus } from '@/lib/types'
import { PhotoControls } from '@/components/admin/photo-controls'

export const dynamic = 'force-dynamic'

export default async function PhotosPage() {
  // proxy.ts already gated this (lock #1); re-checking keeps the page safe even
  // if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const config = await getConfig()

  // Before migration 017 there is no key column. Every photo query would fail
  // too, so stop here with a notice rather than crash the whole tab.
  if (!config.photo_upload_key) {
    return (
      <div className="mx-auto max-w-6xl">
        <p role="alert" className="rounded-md border border-warning bg-surface px-3 py-2 text-sm text-warning">
          {strings.photos.notMigrated}
        </p>
      </div>
    )
  }

  const [stats, drive] = await Promise.all([photoStats(), driveStatus()])

  const uploadUrl = buildAbsoluteUrl(`/photos?k=${encodeURIComponent(config.photo_upload_key)}`)
  const qrSvg = await QRCode.toString(uploadUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{strings.photos.title}</h2>
          <p className="text-sm text-muted">{strings.photos.hint}</p>
        </div>
        <PhotoControls
          qrSvg={qrSvg}
          uploadUrl={uploadUrl}
          isOpen={config.photo_upload_open}
          count={stats.count}
          bytes={stats.bytes}
          drive={drive}
          driveConfigured={isDriveConfigured()}
        />
      </section>
    </div>
  )
}

/**
 * Whether Drive is connected AND still working — checked live on every visit
 * by reading the folder, so a revoked token shows as "reconnect" here long
 * before a guest hits it. Only the email and folder link leave the server;
 * the token never does.
 */
async function driveStatus(): Promise<DriveStatus> {
  const connection = await getDriveConnection()
  if (!connection) return { state: 'disconnected' }
  try {
    const token = await accessToken(connection.refresh_token)
    if (await checkFolder(token, connection.folder_id)) {
      return { state: 'connected', email: connection.account_email, folderUrl: folderUrl(connection.folder_id) }
    }
  } catch (thrown) {
    console.error('[admin/photos] drive check:', thrown instanceof Error ? thrown.message : thrown)
  }
  return { state: 'broken', email: connection.account_email }
}
