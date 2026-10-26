// lib/trends/airGoogle.js  (server only)
//
// The last 30 days of air quality, day by day, on India's own CPCB AQI
// scale -- from Google's Air Quality history endpoint, with the same key
// /api/aqi already uses (GOOGLE_AIR_QUALITY_KEY). Google keeps 30 days of
// history, so this is a month, not years; the chart says so.
//
// Cost: 720 hours come back in pages of 168, so five requests per spot.
// /api/trends caches the result for a day per ~1 km cell.

const ENDPOINT = 'https://airquality.googleapis.com/v1/history:lookup';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const CPCB_BANDS = [
  [50, 'Good'], [100, 'Satisfactory'], [200, 'Moderate'], [300, 'Poor'], [400, 'Very poor'], [Infinity, 'Severe'],
];
export const cpcbWord = (aqi) => CPCB_BANDS.find(([max]) => aqi <= max)?.[1] || '-';

export function googleAirEnabled() {
  return Boolean(process.env.GOOGLE_AIR_QUALITY_KEY);
}

export async function fetchGoogleAirHistory(lat, lon, { timeoutMs = 15_000 } = {}) {
  const key = process.env.GOOGLE_AIR_QUALITY_KEY;
  const hours = [];
  let pageToken;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (let page = 0; page < 6; page++) {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        next: { revalidate: 86400 },
        body: JSON.stringify({
          location: { latitude: lat, longitude: lon },
          hours: 720,
          pageSize: 168,
          ...(pageToken ? { pageToken } : {}),
          // LOCAL_AQI is what adds the ind_cpcb index (see /api/aqi).
          extraComputations: ['LOCAL_AQI'],
          languageCode: 'en',
        }),
      });
      if (!res.ok) throw new Error(`google-air-${res.status}`);
      const json = await res.json();
      hours.push(...(json.hoursInfo || []));
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
  } finally {
    clearTimeout(t);
  }
  return hours;
}

export function buildGoogleAirTrend(hoursInfo) {
  const byDay = new Map();
  for (const h of hoursInfo || []) {
    const cpcb = (h.indexes || []).find((i) => i.code === 'ind_cpcb');
    if (!cpcb || typeof cpcb.aqi !== 'number' || !h.dateTime) continue;
    // Days in India time, not UTC.
    const d = new Date(new Date(h.dateTime).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(cpcb.aqi);
  }
  const points = [...byDay.entries()]
    .filter(([, xs]) => xs.length >= 12) // part-days at either end are dropped
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, xs]) => ({ x: `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`, v: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) }));
  if (points.length < 10) return null;

  const avg = Math.round(points.reduce((a, p) => a + p.v, 0) / points.length);
  const bad = points.filter((p) => p.v > 200).length;
  const good = points.filter((p) => p.v <= 100).length;
  let worst = points[0], best = points[0];
  for (const p of points) { if (p.v > worst.v) worst = p; if (p.v < best.v) best = p; }

  return {
    key: 'pm25', label: 'Air quality, last 30 days', unit: 'AQI', decimals: 0,
    caption: 'Daily average air quality (India CPCB AQI)',
    points,
    reference: { v: 100, label: 'Satisfactory or better below 100' },
    summary: `AQI averaged ${avg} (${cpcbWord(avg).toLowerCase()}) over the last ${points.length} days. ${good} of those days were satisfactory or better${bad ? `, ${bad} were poor or worse` : ''}.`,
    detail: worst.v !== best.v ? `Worst day: ${worst.x} (${worst.v}); cleanest: ${best.x} (${best.v}).` : null,
    source: 'Google Air Quality (CPCB index)',
    note: 'A month of history, not years: air in most Indian cities is much worse in winter, so one month is not the whole picture.',
  };
}
