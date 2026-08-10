// app/api/sunscout/geocode-suggest/route.js
// Live autocomplete for the address search box -- returns several
// candidates (not just the top one) so the user can pick as they type.
// Separate from /api/sunscout/geocode (which stays single-result, used
// elsewhere by SunScoutPanel) to avoid changing that response shape.
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (q.trim().length < 3) return NextResponse.json({ results: [] });

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`,
      { headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://blindspotco.net)' } }
    );
    // TEMP DIAGNOSTIC — remove once we've confirmed the cause.
    if (!r.ok) {
      console.error('[geocode-suggest] Nominatim non-OK status', r.status, await r.text());
      return NextResponse.json({ results: [] });
    }
    const data = await r.json();
    if (!Array.isArray(data)) {
      console.error('[geocode-suggest] Nominatim OK but not an array', JSON.stringify(data).slice(0, 200));
    }
    const results = Array.isArray(data)
      ? data.map(d => ({
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
          displayName: d.display_name,
          postcode: d.address?.postcode || null,
          city: d.address?.city || d.address?.state_district || d.address?.state || null,
        }))
      : [];
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[geocode-suggest] fetch threw', e?.message);
    return NextResponse.json({ results: [] });
  }
}
