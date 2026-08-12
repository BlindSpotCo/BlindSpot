/** @type {import('next').NextConfig} */
const nextConfig = {
  // @napi-rs/canvas ships native .node binaries per-platform — bundlers
  // that try to statically analyse/inline it break the build. Keeping it
  // (and unpdf, which requires it as an optional peer for PDF rendering)
  // un-bundled and required at runtime like a normal Node dependency
  // avoids that. This replaced pdf-to-img, which built fine but threw
  // "DOMMatrix is not defined" specifically on Vercel's serverless
  // runtime — see the comment in lib/floorplan/toImage.js for why.
  serverExternalPackages: ['@napi-rs/canvas', 'unpdf'],

  // Next.js's dev server only trusts requests from localhost/127.0.0.1 by
  // default -- a request coming in via a LAN IP (e.g. testing on a phone on
  // the same WiFi) gets silently blocked otherwise, which looks like a hung
  // fetch/HMR connection rather than a clean error. This only affects
  // `next dev`, never a production build.
  //
  // If your machine's LAN IP changes (different network, DHCP renewal),
  // update this to match and restart the dev server.
  allowedDevOrigins: ['192.168.68.59'],

  async headers() {
    return [
      {
        // Allow popups (BlindSpot login opened from SunScout/AsliVastu)
        // to keep a window.opener reference and postMessage back --
        // the default/stricter COOP value silently breaks that handoff.
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};

export default nextConfig;
