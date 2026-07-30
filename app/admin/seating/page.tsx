/** Placeholder. Built in a later phase — see docs/wedding-rsvp-PRD.md. */

import { redirect } from 'next/navigation'
import { verifyAdmin } from '@/lib/auth'
import { EmptyState } from '@/components/ui/states'
import { strings } from '@/lib/strings'

export default async function Page() {
  if (!(await verifyAdmin())) redirect('/admin/login')
  return <EmptyState title={strings.admin.tabs.seating} hint={strings.admin.comingSoon} />
}
