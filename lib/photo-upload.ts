/**
 * The network half of a guest upload (docs/wedding-photos-PRD.md §5).
 * Browser-only. The component holds the state; this holds the protocol.
 *
 * One request per photo: the shrunk JPEG, the QR key and the optional name go
 * to POST /api/photos/upload, which puts the photo into Google Drive. The
 * Drive token never reaches the phone.
 */

/** Why an upload was refused, so the page can say the right thing. */
export type UploadRefusal = 'invalid' | 'closed' | 'busy' | 'notReady' | 'error'

export class UploadError extends Error {
  constructor(public readonly reason: UploadRefusal) {
    super(reason)
  }
}

/** HTTP status → what the guest should be told. */
function refusalFor(status: number): UploadRefusal {
  if (status === 400) return 'invalid'
  if (status === 410) return 'closed'
  if (status === 429) return 'busy'
  if (status === 503) return 'notReady'
  return 'error'
}

/**
 * XMLHttpRequest rather than fetch: fetch still can't report upload progress,
 * and on venue Wi-Fi a bar that moves is the difference between waiting and
 * giving up.
 */
export function uploadPhoto(
  key: string,
  name: string,
  photo: Blob,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const form = new FormData()
  form.append('k', key)
  form.append('name', name)
  form.append('file', photo, 'photo.jpg')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/photos/upload')
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      }
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(refusalFor(xhr.status)))
    xhr.onerror = () => reject(new UploadError('error'))
    xhr.send(form)
  })
}

/** Runs `worker` over `items`, at most `limit` at a time. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  async function lane(): Promise<void> {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}
