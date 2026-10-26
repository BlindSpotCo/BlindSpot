// lib/trends/air.js  (server only)
//
// Monthly PM2.5 for one spot, from the Open-Meteo air-quality API (CAMS
// global model, modelled not measured, about a 40 km grid, back to 2022).
//
// OFF unless configured. Open-Meteo's free API is for non-commercial use
// only, and BlindSpot sells reports. Turn it on with ONE of:
//   OPEN_METEO_API_KEY=...   a paid Open-Meteo key (customer endpoint)
//   OPEN_METEO_FREE=1        the free endpoint, only while non-commercial
// With neither, the air row simply has no trend chart.

import { extremes } from './series';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// CAMS global history in this API starts here.
const START = '2022-08-01';
// India's National Ambient Air Quality Standard, PM2.5 annual average.
const NAAQS_ANNUAL = 40;

export function airTrendsEnabled() {
  return Boolean(process.env.OPEN_METEO_API_KEY || process.env.OPEN_METEO_FREE === '1');
}

export async function fetchAir(lat, lon, { timeoutMs = 20_000, now = new Date() } = {}) {
  const key = process.env.OPEN_METEO_API_KEY;
  const host = key ? 'https://customer-air-quality-api.open-meteo.com' : 'https://air-quality-api.open-meteo.com';
  // Up to the end of last month, so every month on the chart is complete.
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const url = `${host}/v1/air-quality?latitude=${lat}&longitude=${lon}`
    + `&hourly=pm2_5&start_date=${START}&end_date=${end}&timezone=Asia%2FKolkata`
    + (key ? `&apikey=${encodeURIComponent(key)}` : '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) throw new Error(`air-${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export function buildAirTrend(json) {
  const time = json?.hourly?.time || [];
  const vals = json?.hourly?.pm2_5 || [];
  const byMonth = new Map();
  for (let i = 0; i < time.length; i++) {
    const v = vals[i];
    if (!Number.isFinite(v)) continue;
    const k = String(time[i]).slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, { sum: 0, n: 0 });
    const b = byMonth.get(k); b.sum += v; b.n += 1;
  }
  // A month with under ~3 weeks of hours is left off rather than guessed.
  const points = [...byMonth.entries()]
    .filter(([, b]) => b.n >= 500)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, b]) => ({ x: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, v: Math.round(b.sum / b.n) }));
  if (points.length < 12) return null;

  const last12 = points.slice(-12);
  const yearAvg = Math.round(last12.reduce((a, p) => a + p.v, 0) / 12);
  const overLimit = last12.filter((p) => p.v > NAAQS_ANNUAL).length;
  return {
    key: 'pm25', label: 'Air (PM2.5)', unit: 'µg/m³', decimals: 0,
    caption: 'Monthly average fine-particle pollution (PM2.5)',
    points,
    reference: { v: NAAQS_ANNUAL, label: `India's annual limit (${NAAQS_ANNUAL})` },
    summary: `Over the last 12 months PM2.5 averaged ${yearAvg} µg/m³, and ${overLimit} of those months were above India's annual limit of ${NAAQS_ANNUAL}.`,
    detail: extremes(points, { unit: 'µg/m³', decimals: 0, high: 'Worst month', low: 'cleanest' }),
    source: 'CAMS air-quality model via Open-Meteo',
    note: 'Modelled for the area (about a 40 km grid), not a monitoring station. Winter months are usually the worst.',
  };
}
