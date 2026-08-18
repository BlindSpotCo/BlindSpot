// app/api/aqi/route.js
// Live air quality for a coordinate, via Google's Air Quality API.
//
// ── Why this provider ────────────────────────────────────────────────
// This started on WAQI, which resolves the nearest physical monitoring
// station. That works until it doesn't: station networks are dense in
// city cores and thin everywhere else, so coverage is a lottery decided
// by how close a given pincode happens to sit to a government sensor.
// That is not a WAQI limitation, it is inherent to every station-based
// source, and it is the actual root cause of the bug this replaced --
// 27 of 268 pins (all of Gurugram, Noida, Ghaziabad, Faridabad) had no
// air reading at all, so those areas were scored on 7 of 8 dimensions
// with air's 15% redistributed to the survivors. The pipeline was
// quietly flattering exactly the places with the worst air.
//
// Google's Air Quality API is modelled rather than station-bound: it
// fuses station data, satellite observation, traffic and meteorology
// into a 500m x 500m grid over 100+ countries, so EVERY coordinate
// returns a value. There is no coverage list to maintain, no city that
// can be silently missed, and no per-city onboarding when the product
// expands -- a new tier-1 city gets air quality on day one with no data
// work at all. (Worth being clear-eyed that the other seven dimensions
// do NOT scale this way: crime, water, power, roads and schools are all
// sourced per-city from state bodies. Air is the one dimension that
// comes for free with a new city.)
//
// India's default local index here is `ind_cpcb` -- Google returns the
// genuine Indian CPCB AQI on its native 0-500 scale, not a US EPA or
// European number converted across. That matters because every band
// label, health sentence and score threshold in this product is written
// against CPCB's scale.
//
// Considered and rejected: Open-Meteo/CAMS, which is free and needs no
// key at all, but is a ~11km model grid. Delhi NCR would collapse into
// a handful of cells, so adjacent pincodes would return identical air
// scores -- which defeats the purpose of a per-area score.
//
// ── Cost ─────────────────────────────────────────────────────────────
// 10,000 requests/month free, then USD 5 per 1,000. The 24h cache below
// is what keeps this inside the free tier: one refresh per pin per day
// over 268 pins is ~8,040 calls/month. It also makes the "updated daily"
// wording in the UI literally true rather than aspirational. Scaling to
// all 8 tier-1 cities at ~100 pins each (~800 pins) would be ~24,000
// calls/month, i.e. ~USD 70/month -- worth knowing before that expansion,
// and the reason this must never be moved to a per-request fetch.

import { NextResponse } from 'next/server';

// 24h. Deliberately matched to the product's "updated daily" claim and to
// the free-tier arithmetic above -- shortening this is the single easiest
// way to turn a free integration into a billed one.
export const revalidate = 86400;

const UPSTREAM_TIMEOUT_MS = 4000;
const ENDPOINT = 'https://airquality.googleapis.com/v1/currentConditions:lookup';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ aqi: null, reason: 'bad-coords' }, { status: 400 });
  }

  const key = process.env.GOOGLE_AIR_QUALITY_KEY;
  if (!key) {
    // Not an error: the site is expected to run without this key (local
    // dev, forks, CI). Callers treat a null reading as "keep the stored
    // snapshot", so the pages degrade to their previous behaviour rather
    // than breaking.
    return NextResponse.json({ aqi: null, reason: 'no-key' });
  }

  try {
    // Explicit abort rather than fetch's default: an upstream that hangs
    // would hold the request open long enough to stall the score page,
    // and a stale-but-instant reading beats a correct-but-late one here.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      // Next only caches GETs by default; POST upstreams need the cache
      // opted into explicitly, and without this every page view would be
      // a billed call.
      next: { revalidate },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lon },
        // LOCAL_AQI is what returns ind_cpcb for Indian coordinates.
        // Without it the response carries only the "uaqi" universal index,
        // which is a different 0-100 scale running the opposite direction
        // (higher = cleaner) and would silently score everything wrong.
        extraComputations: ['LOCAL_AQI'],
        languageCode: 'en',
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return NextResponse.json({ aqi: null, reason: `upstream-${res.status}` });

    const json = await res.json();
    const indexes = Array.isArray(json.indexes) ? json.indexes : [];

    // Take CPCB specifically. Never fall back to `uaqi` if it's missing:
    // its scale is inverted relative to CPCB, so a fallback would turn
    // clean air into a near-zero score rather than just being imprecise.
    const cpcb = indexes.find(i => i.code === 'ind_cpcb');
    if (!cpcb || typeof cpcb.aqi !== 'number') {
      return NextResponse.json({ aqi: null, reason: 'no-cpcb-index' });
    }

    return NextResponse.json({
      aqi: cpcb.aqi,
      // Modelled grid cell, not a named station -- said plainly so the UI
      // doesn't imply a sensor sitting in the neighbourhood.
      station: 'Google Air Quality · CPCB index',
      observedAt: json.dateTime || null,
      dominantPollutant: cpcb.dominantPollutant || null,
      source: 'google-air-quality',
    });
  } catch (err) {
    return NextResponse.json({ aqi: null, reason: err.name === 'AbortError' ? 'timeout' : 'fetch-failed' });
  }
}
