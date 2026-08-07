// lib/sunscout/buildingHeights.js
// Ported from SunScout's lib/buildingHeights.ts. Best-effort, fail-soft
// check of how many nearby buildings have real OSM height data vs an
// assumed height -- surfaced as an honesty note in the AI report.
import './networkFix';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 150;
const FETCH_TIMEOUT_MS = 8000;

export const ASSUMED_HEIGHT_M = 12;

function hasHeightData(tags) {
  if (!tags) return false;
  return Boolean(tags.height || tags['building:levels']);
}

export async function checkBuildingHeights(lat, lon) {
  const query = `[out:json][timeout:8];way["building"](around:${RADIUS_M},${lat},${lon});out tags;`;

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
      console.error('[buildingHeights] Overpass returned', res.status);
      return null;
    }

    const data = await res.json();
    const elements = data?.elements || [];
    if (elements.length === 0) return null;

    const total = elements.length;
    const missing = elements.filter(el => !hasHeightData(el.tags)).length;

    const sentence =
      missing === 0
        ? `All ${total} nearby buildings had OSM height data — no assumptions were needed for building heights in this report.`
        : `${missing} of ${total} nearby buildings had no height data in OpenStreetMap; where that happened, we assumed ${ASSUMED_HEIGHT_M}m (a typical low-rise estimate) rather than leaving it blank.`;

    return { totalBuildings: total, missingHeightCount: missing, assumedHeightM: ASSUMED_HEIGHT_M, sentence };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[buildingHeights] Overpass errored:', err?.message || err);
    return null;
  }
}
