// app/api/sunscout/tile-proxy/route.js
// Ported from SunScout's app/api/tile-proxy/route.ts. Proxies map tiles
// through BlindSpot's own origin so the Map3DShadow canvas never touches a
// cross-origin image (avoids tainted-canvas SecurityError on screenshot
// capture).

const ALLOWED_HOSTS = [
  'tile-a.openstreetmap.fr',
  'server.arcgisonline.com',
  'basemaps.cartocdn.com',
];

async function tryFetch(url, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return res;
    } catch {}
  }
  return null;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return new Response('missing url', { status: 400 });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return new Response('invalid url', { status: 400 });
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response('host not allowed', { status: 403 });
  }

  let res = await tryFetch(url);

  if (!res && parsed.hostname === 'tile-a.openstreetmap.fr') {
    const m = parsed.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (m) {
      const [, z, x, y] = m;
      const fallbackUrl = `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`;
      res = await tryFetch(fallbackUrl, 1);
    }
  }

  if (!res) return new Response('upstream error', { status: 502 });

  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
