/**
 * The invitation artwork, filling the viewport behind everything.
 *
 * THE IMAGE PATH APPEARS ONLY HERE. The final 1080×1920 asset from the designer
 * replaces this one constant and nothing else.
 *
 * `contain`, centred — NOT `cover`.
 *
 * The demo card is 597×843 (aspect 0.708) and a phone is ~0.462. `cover` scales
 * to full height and throws away about a third of the width, which is exactly
 * where the floral arch lives: the arch gets sliced down both sides. `contain`
 * fits the full width instead, so the arch stays whole.
 *
 * Anchored to the top, dropped 80px. That 80px is the breathing room the
 * greeting pill sits in: the artwork starts just below it rather than running
 * under it, and the leftover height collects at the bottom where the action bar
 * already is. The white it leaves is the same white as the card's interior, so
 * it reads as margin rather than a gap.
 *
 * The offset is `top-20` on the absolutely-positioned layer rather than a margin
 * on the utility class — nudging `.bg-center` globally would move every other
 * element that happens to use it.
 *
 * WHEN THE TALL ASSET ARRIVES (1290×2796, aspect ≈0.461, i.e. the phone's own
 * shape) switch `bg-contain` to `bg-cover`: at that aspect there is nothing left
 * to crop, and `cover` handles oddly-shaped phones without white bars.
 *
 * A plain <div> with a background image rather than next/image: this is
 * decoration that must bleed to the edges and stay put while content scrolls.
 */

import type { Language } from '@/lib/types'

/**
 * One entry per language (PRD §6.7b). Russian points at the Hebrew file until
 * the designer delivers a Russian version — the code path is already correct,
 * so swapping it is this one line plus `npm run og-card` to rebuild the
 * matching preview card. Forgetting the second leaves the WhatsApp preview
 * showing the wrong invitation, which nothing in a build will tell you.
 */
const ARTWORK: Record<Language, string> = {
  he: '/assets/demo-invitation.jpeg',
  ru: '/assets/demo-invitation.jpeg',
}

export function InvitationBackdrop({ lang }: { lang: Language }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-paper">
      <div
        className="absolute inset-x-0 bottom-0 top-20 bg-contain bg-top bg-no-repeat"
        style={{ backgroundImage: `url(${ARTWORK[lang]})` }}
      />
      {/*
       * A scrim behind the greeting only. The bottom no longer needs one: the
       * artwork ends above the action bar rather than running under it.
       */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/70 to-transparent" />
    </div>
  )
}
