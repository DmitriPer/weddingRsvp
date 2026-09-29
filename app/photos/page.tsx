/**
 * The guest photo upload page, opened from the QR code on the tables
 * (docs/wedding-photos-PRD.md §3). PUBLIC: not behind proxy.ts. The QR key in
 * `?k=` is the only gate, re-checked by every API call the page makes.
 *
 * The gate is decided here first so a wrong key or a closed switch never even
 * shows the upload button. Both messages are bilingual and reveal nothing:
 * not whether uploads exist, not how many photos there are.
 */

import type { Metadata } from 'next'
import { getConfig } from '@/lib/data'
import { uploadGate } from '@/lib/photos'
import { guestText } from '@/lib/strings'
import { PhotoGateMessage, PhotoUploader } from '@/components/guest/photo-uploader'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: guestText('he').photos.title,
  // A private upload page: never in a search index, never followed.
  robots: { index: false, follow: false },
}

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>
}): Promise<React.JSX.Element> {
  const { k } = await searchParams
  const gate = uploadGate(await getConfig(), k)

  if (gate !== 'ok') return <PhotoGateMessage reason={gate} />
  // `k` is defined here: uploadGate only returns 'ok' for a matching key.
  return <PhotoUploader uploadKey={k as string} />
}
