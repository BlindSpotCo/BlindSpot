/** @type {import('next').NextConfig} */
const nextConfig = {
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
