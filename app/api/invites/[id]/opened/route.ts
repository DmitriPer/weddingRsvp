/**
 * Marks an invite as opened. Called from the GUEST's browser, so there is no
 * admin auth — the invite id came from a page that already proved possession of
 * the token.
 *
 * Why a client-side call at all (PRD §6.15): WhatsApp fetches both the invite
 * page and its OG image to build the preview card. Marking `opened` during
 * server rendering would flip every invite the moment it was SENT, destroying
 * the "who hasn't looked yet" filter the follow-up workflow depends on.
 * Crawlers fetch HTML but do not execute JavaScript.
 *
 * The User-Agent check is a backstop for a crawler that runs JS, not the
 * mechanism.
 */

import type { NextRequest } from 'next/server'
import { fromThrown, notFound, ok } from '@/lib/api'
import { markOpened } from '@/lib/data'
import { isCrawler } from '@/lib/bots'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params

    if (isCrawler(request.headers.get('user-agent'))) {
      return ok({ id, marked: false, reason: 'crawler' })
    }

    const invite = await markOpened(id)
    if (!invite) return notFound('Invite not found')

    return ok({ id, marked: true, status: invite.status })
  } catch (thrown) {
    return fromThrown(thrown)
  }
}
