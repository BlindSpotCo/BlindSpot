// app/api/trends/route.js
//
// GET /api/trends?lat=&lon=
//
// Past data behind the weight scores, for the trend charts on the report
// screen and the "Past trends" section of the written report. It shows what
// HAS happened at this spot -- never a forecast.
//
//   heat, hotDays, rain, heavyRain, humidity, sunshine, wind
//       ten full years of daily climate, NASA POWER (free, no key)
//   pm25 (the air row)
//       years of monthly PM2.5 from Open-Meteo, if OPEN_METEO_API_KEY or
//       OPEN_METEO_FREE=1 is set; otherwise the last 30 days of CPCB AQI from
//       Google, if GOOGLE_AIR_QUALITY_KEY is set; otherwise left out.
//
// Climate data is regional (~50 km cells), so coordinates are snapped to
// 0.1° before fetching: every pin in the same cell shares one cached
// answer instead of each costing a fresh upstream call.
//
// Each part fails on its own: if NASA is slow the air chart still comes
// back, and the other way round. Whatever is missing is simply absent.

import { NextResponse } from 'next/server';
import { buildClimateTrends, climateYears, fetchPower } from '@/lib/trends/climate';
import { airTrendsEnabled, buildAirTrend, fetchAir } from '@/lib/trends/air';
import { buildGoogleAirTrend, fetchGoogleAirHistory, googleAirEnabled } from '@/lib/trends/airGoogle';

export const maxDuration = 30;

const snap = (v, step) => Math.round(v / step) * step;

// Warm-instance memo on top of the fetch cache; keeps a run of reports for
// the same city from re-parsing ten years of daily data each time.
const memo = new Map();
const MEMO_MAX = 200;
function remember(key, value) {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(key, { at: Date.now(), value });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'bad-coords' }, { status: 400 });
  }

  const cLat = Number(snap(lat, 0.1).toFixed(1));
  const cLon = Number(snap(lon, 0.1).toFixed(1));
  const aLat = Number(snap(lat, 0.01).toFixed(2));
  const aLon = Number(snap(lon, 0.01).toFixed(2));
  const years = climateYears();
  const key = `${cLat},${cLon}|${aLat},${aLon}|${years.last}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 12 * 3600 * 1000) return respond(hit.value);

  const climateP = fetchPower(cLat, cLon, years)
    .then((json) => buildClimateTrends(json, years))
    .catch((e) => { console.warn('[trends] climate failed:', e?.message || e); return {}; });

  const airP = airTrendsEnabled()
    ? fetchAir(aLat, aLon).then(buildAirTrend).catch((e) => { console.warn('[trends] air failed:', e?.message || e); return null; })
    : googleAirEnabled()
      ? fetchGoogleAirHistory(aLat, aLon).then(buildGoogleAirTrend).catch((e) => { console.warn('[trends] google air failed:', e?.message || e); return null; })
      : Promise.resolve(null);

  const [climate, air] = await Promise.all([climateP, airP]);
  const series = { ...climate, ...(air ? { pm25: air } : {}) };
  const value = {
    series,
    period: { from: years.first, to: years.last },
    disclaimer: 'Past records only. These charts show what has happened here, not a prediction of what will.',
  };
  // Don't hold on to an empty answer: it is most likely an upstream
  // hiccup, and the next request should try again.
  if (Object.keys(series).length) remember(key, value);
  return respond(value);
}

function respond(value) {
  const empty = !Object.keys(value.series || {}).length;
  return NextResponse.json(value, {
    headers: {
      // The record behind these charts changes once a year (climate) or
      // once a day (air). A day at the edge is plenty; an empty answer is
      // never cached.
      'Cache-Control': empty ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
