// lib/sunscout/estimateFacing.js
// Ported from SunScout's lib/estimateFacing.ts. Best-effort auto-detection
// of likely facing direction, used to pre-fill (not force) the facing
// selector before report/LiveScore generation.
import './networkFix';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 150;
const FETCH_TIMEOUT_MS = 8000;
const MIN_BUILDINGS_FOR_CONFIDENCE = 4;

const DIRECTIONS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function bucketOf(bearingDeg) {
  return Math.round(bearingDeg / 45) % 8;
}

export async function estimateFacing(lat, lon) {
  const query = `[out:json][timeout:8];way["building"](around:${RADIUS_M},${lat},${lon});out center;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BlindSpot/1.0 (+https://blindspotco.net; property intelligence platform)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[estimateFacing] Overpass returned', res.status);
      return null;
    }

    const data = await res.json();
    const elements = (data?.elements || []).filter(e => e.center);

    if (elements.length === 0) return null;

    const thinSample = elements.length < MIN_BUILDINGS_FOR_CONFIDENCE;

    const counts = new Array(8).fill(0);
    for (const el of elements) {
      const b = bearing(lat, lon, el.center.lat, el.center.lon);
      counts[bucketOf(b)]++;
    }

    const minCount = Math.min(...counts);
    const candidates = counts.reduce((acc, c, i) => (c === minCount ? [...acc, i] : acc), []);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const direction = DIRECTIONS[chosen];
    const avg = counts.reduce((a, b) => a + b, 0) / 8;
    const confidence = !thinSample && candidates.length === 1 && minCount < avg ? 'medium' : 'low';

    const sampleNote = thinSample
      ? ` (based on only ${elements.length} nearby buildings — a thin sample, treat this guess loosely)`
      : '';
    const sentence = `Facing assumed as ${direction} — the side with the fewest nearby building footprints (${minCount} within ${RADIUS_M}m) around this point${sampleNote}, used as a proxy for the most open/outward side of the building. This is an estimate from map data, not a confirmed unit orientation.`;

    return { direction, confidence, sentence };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[estimateFacing] errored:', err?.message || err);
    return null;
  }
}
