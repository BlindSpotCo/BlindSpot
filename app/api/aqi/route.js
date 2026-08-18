// app/api/aqi/route.js
// Live nearest-station AQI for a coordinate, via the WAQI feed (the
// public aggregator that redistributes CPCB's own CAAQMS station data,
// among others).
//
// Why this exists: air quality was the only dimension claiming to be
// "LIVE · updated daily" in the UI while actually being a static field in
// master_by_pin.json -- and 27 of 268 pins never got that field at all,
// every one of them in the NCR satellite cities (Gurugram, Noida,
// Ghaziabad, Faridabad) that fall outside whatever Delhi-only station
// mapping produced the snapshot. Those areas were scored on 7 of 8
// dimensions with air's weight redistributed to the survivors, which
// quietly inflated exactly the places with the worst air (Cyber City
// scored 78 with no air penalty at all).
//
// Resolving by coordinate instead of by pincode fixes both at once: every
// pin in the dataset has coordinates, so there is no coverage list to
// maintain and no city that can be missed the way the satellite cities
// were. Gurugram resolves to its own CPCB stations (Vikas Sadan,
// Sector 51, Teri Gram, Gwal Pahari) rather than to nothing.
//
// Requires WAQI_TOKEN in .env.local (free, from aqicn.org/data-platform/token/).
// Without it this route returns 200 with { aqi: null, reason: ... } rather
// than an error: callers treat a null reading as "keep the stored
// snapshot", so a missing token degrades the site to exactly its previous
// behaviour instead of breaking the score pages.

import { NextResponse } from 'next/server';

// Cache upstream responses for 30 min. Station data updates hourly at
// best, the score only moves a point or two between refreshes, and this
// keeps a page that renders several areas from spending a request each.
export const revalidate = 1800;

const UPSTREAM_TIMEOUT_MS = 4000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ aqi: null, reason: 'bad-coords' }, { status: 400 });
  }

  const token = process.env.WAQI_TOKEN;
  if (!token) {
    // Not an error condition -- the site is expected to run without this
    // key (local dev, forks, CI). Callers fall back to the stored value.
    return NextResponse.json({ aqi: null, reason: 'no-token' });
  }

  try {
    // AbortController rather than relying on fetch's default: an upstream
    // that hangs would otherwise hold the request open long enough to
    // stall the whole score page, and a stale-but-instant stored reading
    // is far better here than a correct-but-late one.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const res = await fetch(
      `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${encodeURIComponent(token)}`,
      { signal: controller.signal, next: { revalidate } },
    );
    clearTimeout(timer);

    if (!res.ok) return NextResponse.json({ aqi: null, reason: `upstream-${res.status}` });

    const json = await res.json();
    // WAQI returns HTTP 200 with status:"error" for bad tokens, unknown
    // stations and over-quota alike, so the body has to be checked too.
    if (json.status !== 'ok' || !json.data) {
      return NextResponse.json({ aqi: null, reason: json.data || 'upstream-error' });
    }

    // A station with no current PM reading reports aqi as "-" rather than
    // a number; Number("-") is NaN, which would otherwise flow through as
    // a real reading and score as 100.
    const aqi = typeof json.data.aqi === 'number' ? json.data.aqi : Number(json.data.aqi);
    if (!Number.isFinite(aqi)) return NextResponse.json({ aqi: null, reason: 'no-reading' });

    return NextResponse.json({
      aqi,
      station: json.data.city?.name || null,
      observedAt: json.data.time?.iso || null,
      // Distance isn't returned by the geo feed; the station name is what
      // lets the UI say which station the reading came from, which matters
      // because a "nearest station" can still be some km away.
      source: 'waqi',
    });
  } catch (err) {
    return NextResponse.json({ aqi: null, reason: err.name === 'AbortError' ? 'timeout' : 'fetch-failed' });
  }
}
