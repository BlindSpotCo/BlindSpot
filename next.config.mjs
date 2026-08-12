/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-to-img (used by the floor-plan furnishing advisor to render a PDF's
  // first page to an image) wraps pdfjs-dist, which loads worker/wasm
  // assets in a way Turbopack's server bundler can't statically analyse --
  // without this it fails at build time with a bogus "path argument must
  // be of type string" error. Keeping it un-bundled and required at
  // runtime like a normal Node dependency avoids that.
  serverExternalPackages: ['pdf-to-img'],

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
