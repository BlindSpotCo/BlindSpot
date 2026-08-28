// app/api/sunscout/geocode-suggest/route.js
// Live autocomplete for the address search box -- returns several
// candidates (not just the top one) so the user can pick as they type.
// Separate from /api/sunscout/geocode (which stays single-result, used
// elsewhere by SunScoutPanel) to avoid changing that response shape.
//
// Backed by Photon (photon.komoot.io), not Nominatim's /search. Nominatim's
// search index is built for near-complete address strings -- it tokenizes
// on whole words, so a half-typed word ("Indira" typed as "Indi") mostly
// falls through to nothing until you finish it, which read as "only gives
// me what I type fully." Photon is built on the same OSM data but indexes
// with edge n-grams specifically for type-ahead, so partial words match
// as you go. It's a free public API, no key required.
import { NextResponse } from 'next/server';
import { PIN_META } from '@/lib/aslivastu/pinMeta';

// Photon has no strict country-code filter param on the public instance;
// `lat`/`lon` only bias ranking, they don't exclude anything. Post-filter
// to India so a short/ambiguous query ("Indi...") doesn't surface a match
// in Indiana before Indirapuram. Falls back to the unfiltered list if
// filtering would empty the result set out entirely (e.g. a query that's
// genuinely outside India), so this never makes results *worse*.
const INDIA_BIAS = { lat: 20.5937, lon: 78.9629 };

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildLabel(props) {
  const line1parts = [];
  if (props.housenumber && props.street) line1parts.push(`${props.housenumber} ${props.street}`);
  else if (props.street) line1parts.push(props.street);
  if (props.name && !line1parts.includes(props.name)) line1parts.push(props.name);

  const line2parts = [props.city || props.district || props.county, props.state].filter(Boolean);

  const all = [...line1parts, ...line2parts];
  // Dedupe while preserving order -- Photon sometimes repeats the same
  // token across `name` and `street`/`city`.
  return Array.from(new Set(all)).join(', ');
}

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

// Tiny in-memory cache for repeated queries -- someone typing "Indira",
// backspacing to "Indir", then retyping "Indira" (a completely normal
// self-correction while typing) shouldn't refire an external fetch for a
// query this route already answered seconds ago. Serverless functions
// don't share memory across cold starts/instances, so this is a
// best-effort speedup, not a correctness guarantee -- fine for that role.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map(); // key -> { at, results }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.results;
}

function cacheSet(key, results) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { at: Date.now(), results });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  // Photon's edge-ngram index gives usable matches from 2 characters on --
  // no need to make the user type 3 before anything shows up.
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  // Bias toward wherever the user's map is actually centred right now
  // (their current pin -- auto-located, previously searched, or dragged),
  // not a fixed point in the middle of the country. That's what actually
  // fixes the "MG Road" problem: Photon's own India-wide relevance can't
  // tell a Bangalore MG Road from a Gurugram one, but "which MG Road is
  // near where this user already is" is a real, useful signal we have.
  const latParam = parseFloat(searchParams.get('lat'));
  const lonParam = parseFloat(searchParams.get('lon'));
  const hasRealBias = Number.isFinite(latParam) && Number.isFinite(lonParam);
  const bias = hasRealBias ? { lat: latParam, lon: lonParam } : INDIA_BIAS;

  const cacheKey = `${q.trim().toLowerCase()}|${hasRealBias ? `${bias.lat.toFixed(2)},${bias.lon.toFixed(2)}` : 'in'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ results: cached });

  try {
    const r = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${bias.lat}&lon=${bias.lon}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) {
      console.error('[geocode-suggest] Photon non-OK status', r.status, await r.text());
      return NextResponse.json({ results: [] });
    }
    const data = await r.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    if (!Array.isArray(data?.features)) {
      console.error('[geocode-suggest] Photon OK but no features array', JSON.stringify(data).slice(0, 200));
    }

    const mapped = features
      .filter(f => f?.geometry?.coordinates?.length === 2)
      .map(f => {
        const props = f.properties || {};
        return {
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          displayName: buildLabel(props) || props.name || q,
          postcode: props.postcode || null,
          city: props.city || props.district || props.county || props.state || null,
          countrycode: props.countrycode || null,
        };
      });

    // De-dupe -- Photon sometimes returns the same real-world place twice
    // (once as a node, once as the way/building it sits on), a few metres
    // apart. Round to ~11m and keep the first (best-ranked) occurrence.
    const seen = new Set();
    const deduped = [];
    for (const m of mapped) {
      const key = `${m.lat.toFixed(4)},${m.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(m);
    }

    // Prefer India results, but never return an empty dropdown just
    // because a query happens to also match somewhere else -- fall back
    // to the unfiltered set rather than filter it to nothing.
    const indiaOnly = deduped.filter(m => !m.countrycode || m.countrycode === 'IN');
    const results = (indiaOnly.length > 0 ? indiaOnly : deduped)
      .map(({ countrycode, ...rest }) => rest);

    // Stable sort (guaranteed by the JS spec since ES2019). Covered
    // pincodes still win first place, same as before. Within each group,
    // when we actually know where the user is (hasRealBias), the nearer
    // result wins ties instead of leaving Photon's country-wide relevance
    // score to decide -- that's the part that untangles same-named
    // streets in different cities. With no real bias point yet (nothing
    // typed/located so far), this falls back to Photon's own order.
    results.sort((a, b) => {
      const aCovered = a.postcode && COVERED_PREFIXES.has(a.postcode.slice(0, 3)) ? 0 : 1;
      const bCovered = b.postcode && COVERED_PREFIXES.has(b.postcode.slice(0, 3)) ? 0 : 1;
      if (aCovered !== bCovered) return aCovered - bCovered;
      if (hasRealBias) {
        return haversineKm(bias.lat, bias.lon, a.lat, a.lon) - haversineKm(bias.lat, bias.lon, b.lat, b.lon);
      }
      return 0;
    });

    cacheSet(cacheKey, results);
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[geocode-suggest] fetch threw', e?.message);
    return NextResponse.json({ results: [] });
  }
}
