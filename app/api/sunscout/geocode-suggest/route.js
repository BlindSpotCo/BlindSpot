// app/api/sunscout/geocode-suggest/route.js
// Live autocomplete for the address search box -- returns several
// candidates (not just the top one) so the user can pick as they type.
// Separate from /api/sunscout/geocode (which stays single-result, used
// elsewhere by SunScoutPanel) to avoid changing that response shape.
import { NextResponse } from 'next/server';
import { PIN_META } from '@/lib/aslivastu/pinMeta';

// Nominatim's raw relevance order for a short/ambiguous query (e.g. "MG
// Road", which is a real street name in a dozen Indian cities) mixes
// results from covered and uncovered cities with no regard for which
// ones BlindSpot can actually score -- which is what read as "random,
// a mix of places from different cities" even though nothing was
// technically broken. Real pincode prefixes are a much more reliable
// coverage signal than trying to string-match city names against
// Nominatim's address fields (which return "Gurugram"/"Noida"/etc, not
// "Delhi NCR", and don't cover every NCR satellite town by name anyway)
// -- every pincode BlindSpot actually has data for is already sitting
// right here in PIN_META. Only used to SORT (covered results first,
// Nominatim's own relevance order preserved within each group), never to
// drop a result -- an uncovered address is still a completely valid
// thing to search for a SunScout-only score.
const COVERED_PREFIXES = new Set(Object.keys(PIN_META).map(p => p.slice(0, 3)));

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
    // Stable sort (guaranteed by the JS spec since ES2019) -- this only
    // partitions covered-first vs not, it doesn't reorder within either
    // group, so Nominatim's own relevance ranking still decides which
    // covered result (or which uncovered one) comes first.
    results.sort((a, b) => {
      const aCovered = a.postcode && COVERED_PREFIXES.has(a.postcode.slice(0, 3)) ? 0 : 1;
      const bCovered = b.postcode && COVERED_PREFIXES.has(b.postcode.slice(0, 3)) ? 0 : 1;
      return aCovered - bCovered;
    });
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[geocode-suggest] fetch threw', e?.message);
    return NextResponse.json({ results: [] });
  }
}
