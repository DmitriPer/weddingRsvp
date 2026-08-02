'use client'

/**
 * One WhatsApp message template, with a live preview (PRD §6.5).
 *
 * Collapsed by default. Six open editors put the one being worked on off the
 * bottom of the screen; collapsed, all six fit and any of them is one click
 * away. A collapsed editor with unsaved changes says so in its header — hiding
 * work behind a closed panel is the obvious way this could lose someone's text.
 *
 * Each of the six templates saves on its own, so editing the invite wording
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
import type { Language, WeddingConfig } from '@/lib/types'

type TemplateField = Extract<
  keyof WeddingConfig,
  | 'invite_message_template_he'
  | 'invite_message_template_ru'
  | 'day_of_message_template_he'
  | 'day_of_message_template_ru'
  | 'thank_you_message_template_he'
  | 'thank_you_message_template_ru'
>

export function TemplateEditor({
  label,
  field,
  initial,
  language,
}: {
  label: string
  field: TemplateField
  initial: string
  /** Which language this template is for — the preview's sample name follows it. */
  language: Language
}) {
  const [text, setText] = useState(initial)
  const [saving, setSaving] = useState(false)
  /**
   * What is known to be in the database. It cannot be `initial`: this screen
   * deliberately never calls router.refresh(), so that prop keeps its
   * page-load value forever and every saved template would still read as
   * unsaved — which the collapsed summary now says out loud.
   */
  const [saved, setSaved] = useState(initial)

  const unknown = unknownVariables(text)
  const dirty = text !== saved

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
    setSaved(text)
    toast.success(strings.settings.saved)
    // Deliberately no router.refresh(): it would remount the other two editors
    // and discard anything half-typed in them.
  }

  return (
    // <details> rather than a useState toggle: the browser keeps the open state,
    // the summary is focusable and keyboard-operable for free, and — the reason
    // it matters here — the content stays MOUNTED when collapsed, so half-typed
    // text is still there when it reopens.
    <details className="group rounded-lg border border-border open:pb-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 hover:bg-surface">
        {/* Rotates to point down when open. aria-hidden: the summary already
            announces its own expanded state. */}
        <span aria-hidden className="text-muted transition-transform group-open:-rotate-90">
          ◀
        </span>
        <h3 className="font-medium">{label}</h3>
        {dirty ? (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
            {strings.settings.unsaved}
          </span>
        ) : null}
      </summary>

      <div className="px-4">
        <p className="text-xs text-muted">
          {strings.settings.variablesHint} <code>{strings.settings.variableName}</code>
          {' · '}
          <code>{strings.settings.variableLink}</code>
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
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
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{renderPreview(text, language)}</p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? strings.app.saving : strings.app.save}
        </button>
      </div>
    </details>
  )
}
