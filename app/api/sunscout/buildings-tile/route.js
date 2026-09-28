// app/api/sunscout/buildings-tile/route.js
//
// Server-side proxy for OSM Buildings 3D data tiles.
//
// data.osmbuildings.org only sends Access-Control-Allow-Origin for the
// domains registered against the API key, so fetching tiles straight from
// the browser breaks the moment BlindSpot is served from a new domain
// (this is what happened on blindspot.properties: the 2D map loaded via
// tile-proxy, but the buildings layer was CORS-blocked and the map went
// flat). Fetching server-side sidesteps CORS entirely, and the response is
// served from our own origin, so it works on every domain and on preview
// deployments.

const KEY = process.env.OSMB_DATA_KEY || '59fcc2e8';
const SUBDOMAINS = ['a', 'b', 'c', 'd'];
// Sent upstream in case the key is also checked by referrer. This is our
// own original domain, which the key was registered for.
const UPSTREAM_REFERER = process.env.OSMB_REFERER || 'https://blindspotco.net/';

const isInt = (v) => /^\d{1,7}$/.test(v || '');

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  if (!isInt(z) || !isInt(x) || !isInt(y) || Number(z) > 20) {
    return new Response('bad tile coords', { status: 400 });
  }

  // Same tile -> same subdomain, so the upstream cache stays warm.
  const s = SUBDOMAINS[(Number(x) + Number(y)) % SUBDOMAINS.length];
  const url = `https://${s}.data.osmbuildings.org/0.2/${KEY}/tile/${z}/${x}/${y}.json`;

  let res = null;
  for (let i = 0; i < 2 && !res; i++) {
    try {
      const r = await fetch(url, {
        headers: { Referer: UPSTREAM_REFERER, Origin: UPSTREAM_REFERER.replace(/\/$/, '') },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) res = r;
      else if (r.status === 404) {
        // No buildings in this tile -- an empty collection, not an error.
        return new Response('{"type":"FeatureCollection","features":[]}', {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
        });
      }
    } catch {}
  }
  if (!res) return new Response('upstream error', { status: 502 });

  const body = await res.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      // Building footprints barely change -- let Vercel's edge cache hold
      // tiles for a week so repeat views never hit OSM Buildings at all.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
