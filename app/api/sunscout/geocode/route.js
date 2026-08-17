// app/api/sunscout/geocode/route.js
// Ported from SunScout's app/api/geocode/route.ts.
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q) return NextResponse.json({ result: null });

  try {
    // Was missing &countrycodes=in -- the sibling geocode-suggest endpoint
    // already has it. Without it, a short query like "Sector 17" (a name
    // that exists in dozens of Indian cities plus, per Nominatim's global
    // index, wholly unrelated places) resolves to whatever the single top
    // global match is, not anything BlindSpot actually covers. That's what
    // "search a Chandigarh area, a random map came up" looks like: this is
    // the endpoint hit whenever someone presses Search/Enter directly
    // instead of clicking one of the (already India-scoped) autocomplete
    // suggestions first.
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`,
      { headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://blindspotco.net)' } }
    );
    // TEMP DIAGNOSTIC — remove once we've confirmed the cause.
    if (!r.ok) {
      console.error('[geocode] Nominatim non-OK status', r.status, await r.text());
      return NextResponse.json({ result: null });
    }
    const data = await r.json();
    if (data && data[0]) {
      return NextResponse.json({ result: [parseFloat(data[0].lat), parseFloat(data[0].lon)] });
    }
    console.error('[geocode] Nominatim OK but empty/unexpected body', JSON.stringify(data).slice(0, 200));
  } catch (e) {
    console.error('[geocode] fetch threw', e?.message);
  }
  return NextResponse.json({ result: null });
}
