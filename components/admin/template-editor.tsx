'use client'

/**
 * One WhatsApp message template, with a live preview (PRD §6.5).
 *
 * Each of the three templates saves on its own, so editing the invite wording
 * can never overwrite the thank-you message someone spent time on.
 *
 * The preview matters more than it looks: a template is never seen rendered
 * until it reaches a guest, and by then it has been sent. renderPreview()
 * substitutes a sample name and link so the admin reads what the guest will.
 *
 * The unknown-variable warning catches the failure this design invites — a
 * typo like {{nmae}} is left verbatim by the renderer, so without the warning
 * it ships silently into a real message.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { renderPreview, unknownVariables } from '@/lib/templates'
import { strings } from '@/lib/strings'
import type { WeddingConfig } from '@/lib/types'

type TemplateField = Extract<
  keyof WeddingConfig,
  'invite_message_template' | 'day_of_message_template' | 'thank_you_message_template'
>

export function TemplateEditor({
  label,
  field,
  initial,
}: {
  label: string
  field: TemplateField
  initial: string
}) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)

  const unknown = unknownVariables(text)
  const dirty = text !== initial

  async function save() {
    setSaving(true)
    const response = await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: text }),
    })
    const body = await response.json()
    setSaving(false)

    if (!body.success) {
      toast.error(body.error || strings.settings.saveFailed)
      return
    }
    toast.success(strings.settings.saved)
    // Deliberately no router.refresh(): it would remount the other two editors
    // and discard anything half-typed in them.
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="font-medium">{label}</h3>

      <p className="mt-1 text-xs text-muted">
        {strings.settings.variablesHint} <code>{strings.settings.variableName}</code>
        {' · '}
        <code>{strings.settings.variableLink}</code>
      </p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
      />

      {unknown.length > 0 ? (
        <p className="mt-1 text-xs text-warning" role="alert">
          {strings.settings.unknownVariable(unknown)}
        </p>
      ) : null}

      <div className="mt-3 rounded-md bg-surface p-3">
        <p className="text-xs text-muted">{strings.settings.preview}</p>
        {/* whitespace-pre-wrap: line breaks in a template survive into WhatsApp,
            so the preview has to show them too. */}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{renderPreview(text)}</p>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {saving ? strings.app.saving : strings.app.save}
      </button>
    </section>
  )
}
