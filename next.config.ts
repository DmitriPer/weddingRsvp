import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * The floating dev-tools badge. It only ever renders in `next dev` — a
   * production build never includes it — but it sits in the bottom corner
   * exactly where the guest action bar is, which makes it useless for judging
   * the mobile layout or taking a screenshot.
   */
  devIndicators: false,

  /*
   * Lets a phone on the LAN load this dev server. Next blocks /_next/* dev
   * resources from non-localhost origins by default, and the failure is
   * misleading: the server HTML renders fine, so the page LOOKS right and
   * buttons even highlight on tap — but React never hydrates, so nothing is
   * interactive. It reads as "the modal is broken" rather than "the JS is
   * missing".
   *
   * Development only; production serves no such resources. Update the address
   * if the machine's LAN IP changes.
   */
  allowedDevOrigins: ['192.168.68.114'],

  turbopack: {
    /*
     * Pin the workspace root. A stray package-lock.json in the parent EXAMS/
     * directory makes Turbopack infer that folder as the root and warn on every
     * start; worse, it can resolve modules from the wrong tree.
     */
    root: __dirname,
  },
}

export default nextConfig
