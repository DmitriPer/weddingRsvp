/**
 * Settings (PRD §6.5): the wedding details and the three WhatsApp templates.
 *
 * The point of this screen is that nothing about the wedding is hardcoded — the
 * date, venue and wording change here, with no redeploy and no trip to the
 * database. Until it existed, every one of those values could only be edited in
 * the Supabase table editor.
 */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { getConfig, listInvites } from '@/lib/data'
import { ConfigForm } from '@/components/admin/config-form'
import { TemplateEditor } from '@/components/admin/template-editor'
import { strings } from '@/lib/strings'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  // proxy.ts already gated this (lock #1); re-checking costs nothing and keeps
  // the page safe even if the matcher is ever misconfigured.
  if (!(await verifyAdmin())) redirect('/admin/login')

  const [config, invites] = await Promise.all([getConfig(), listInvites()])

  // A Russian household with a blank Russian template would otherwise receive a
  // Hebrew invitation and nothing would say so — the exact failure PRD §6.7b
  // exists to prevent. So it is surfaced here rather than silently falling back.
  const russianHouseholds = invites.filter((invite) => invite.language === 'ru').length
  const russianTemplatesMissing =
    russianHouseholds > 0 && !config.invite_message_template_ru.trim()

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{strings.settings.detailsTitle}</h2>
          <p className="text-sm text-muted">{strings.settings.detailsHint}</p>
        </div>
        <ConfigForm config={config} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{strings.settings.templatesTitle}</h2>
          <p className="text-sm text-muted">{strings.settings.templatesHint}</p>
        </div>

        {russianTemplatesMissing ? (
          <p
            role="alert"
            className="rounded-md border border-warning bg-surface px-3 py-2 text-sm text-warning"
          >
            {strings.settings.missingRussian(russianHouseholds)}
          </p>
        ) : null}

        {/* Six independent editors, each saving on its own (PRD §6.5, §6.7b). */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted">{strings.settings.hebrewGroup}</h3>
            <TemplateEditor
              label={strings.settings.inviteTemplate}
              field="invite_message_template_he"
              initial={config.invite_message_template_he}
            />
            <TemplateEditor
              label={strings.settings.dayOfTemplate}
              field="day_of_message_template_he"
              initial={config.day_of_message_template_he}
            />
            <TemplateEditor
              label={strings.settings.thankYouTemplate}
              field="thank_you_message_template_he"
              initial={config.thank_you_message_template_he}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted">{strings.settings.russianGroup}</h3>
              <p className="text-xs text-muted">{strings.settings.russianGroupHint}</p>
            </div>
            <TemplateEditor
              label={strings.settings.inviteTemplate}
              field="invite_message_template_ru"
              initial={config.invite_message_template_ru}
            />
            <TemplateEditor
              label={strings.settings.dayOfTemplate}
              field="day_of_message_template_ru"
              initial={config.day_of_message_template_ru}
            />
            <TemplateEditor
              label={strings.settings.thankYouTemplate}
              field="thank_you_message_template_ru"
              initial={config.thank_you_message_template_ru}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
