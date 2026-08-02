'use client'

/**
 * Download a template, fill it, upload it back (PRD §6.7).
 *
 * The file is sent TWICE — once to preview, once to confirm — and that is the
 * design, not an oversight. Sending the parsed rows back instead would let what
 * is confirmed differ from what was previewed. Uploading the same small file
 * again makes "what you saw is what was written" a property rather than a
 * promise.
 *
 * Row numbers in the report are SPREADSHEET row numbers, so fixing a problem is
 * "go to row 12" rather than "find the household called…".
 */

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'

interface RowProblem {
  row: number
  name: string
  message: string
}

interface ImportReport {
  ready: { row: number; name: string; people: unknown[] }[]
  errors: RowProblem[]
  warnings: RowProblem[]
  totalRows: number
  totalPeople: number
  written: boolean
  invitesCreated?: number
  peopleCreated?: number
}

export function ImportPanel() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setReport(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function send(chosen: File, confirm: boolean): Promise<ImportReport | null> {
    const form = new FormData()
    form.append('file', chosen)
    if (confirm) form.append('confirm', 'true')

    const response = await fetch('/api/invites/import', { method: 'POST', body: form })
    const body = await response.json()
    if (!body.success) {
      toast.error(body.error || strings.importer.failed)
      return null
    }
    return body.data as ImportReport
  }

  async function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    if (!chosen) return

    setFile(chosen)
    setBusy(true)
    setReport(await send(chosen, false)) // preview: writes nothing
    setBusy(false)
  }

  async function handleConfirm() {
    if (!file) return
    setBusy(true)
    const result = await send(file, true)
    setBusy(false)

    if (result?.written) {
      toast.success(
        strings.importer.imported(result.invitesCreated ?? 0, result.peopleCreated ?? 0)
      )
      reset()
      router.refresh()
    }
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="mb-1 font-semibold">{strings.importer.title}</h2>
      <p className="mb-3 text-sm text-muted">{strings.importer.downloadTemplateHint}</p>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          * Plain <a download>, not next/link. These are FILE DOWNLOADS: Link
          * performs a client-side navigation, which for a route returning
          * Content-Disposition would either do nothing or leave the router in a
          * confused state. `download` is also what tells the linter this is not
          * a page link.
          */}
        <a
          href="/api/invites/template"
          download
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {strings.importer.downloadTemplate}
        </a>

        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
          {strings.importer.chooseFile}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx"
            onChange={handleChoose}
            disabled={busy}
            className="hidden"
          />
        </label>

        <a
          href="/api/invites/export"
          download
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
        >
          {strings.importer.export}
        </a>

        {busy ? <span className="text-sm text-muted">{strings.importer.checking}</span> : null}
      </div>

      {report ? (
        <div className="mt-4 space-y-3 border-t border-border pt-3 text-sm">
          <p className="text-muted">{strings.importer.previewOnly}</p>

          <p className="font-medium">
            {strings.importer.ready(report.ready.length, report.totalPeople)}
          </p>

          {report.warnings.length > 0 ? (
            <details className="rounded-md border border-border px-3 py-2">
              <summary className="cursor-pointer text-warning">
                {strings.importer.warnings(report.warnings.length)}
              </summary>
              <ul className="mt-2 space-y-1 text-muted">
                {report.warnings.map((problem, index) => (
                  <li key={`${problem.row}-${index}`}>
                    {strings.importer.rowLabel(problem.row)} · {problem.name} — {problem.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {report.errors.length > 0 ? (
            <details open className="rounded-md border border-danger px-3 py-2">
              <summary className="cursor-pointer text-danger">
                {strings.importer.errors(report.errors.length)}
              </summary>
              <ul className="mt-2 space-y-1 text-muted">
                {report.errors.map((problem, index) => (
                  <li key={`${problem.row}-${index}`}>
                    {strings.importer.rowLabel(problem.row)} · {problem.name} — {problem.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || report.ready.length === 0}
              className="rounded-md bg-accent px-4 py-2 text-white disabled:opacity-60"
            >
              {report.ready.length === 0
                ? strings.importer.nothingReady
                : busy
                  ? strings.importer.importing
                  : strings.importer.confirm(report.ready.length)}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-md border border-border px-4 py-2 hover:bg-surface"
            >
              {strings.importer.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
