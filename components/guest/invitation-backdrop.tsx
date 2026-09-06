/**
 * The invitation artwork, filling the viewport behind everything.
 *
 * The image URL is admin-managed (PRD §6.16, /admin/settings) — this component
 * only lays it out. `lib/invitation-image.ts` resolves which URL a given
 * language sees (Russian falls back to Hebrew when unset); callers pass the
 * already-resolved URL down rather than a language, the same way `venue` and
 * `venueForNav` are passed pre-resolved rather than the whole config.
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

export function InvitationBackdrop({ backdropImage }: { backdropImage: string }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-paper">
      <div
        className="absolute inset-x-0 bottom-0 top-20 bg-contain bg-top bg-no-repeat"
        style={{ backgroundImage: `url(${backdropImage})` }}
      />
      {/*
       * A scrim behind the greeting only. The bottom no longer needs one: the
       * artwork ends above the action bar rather than running under it.
       */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/70 to-transparent" />
    </div>
  )
}
