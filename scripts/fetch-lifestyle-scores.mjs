// scripts/fetch-lifestyle-scores.mjs
//
// Fetches restaurant/pub/nightlife density around every existing AsliVastu
// pincode centroid (lib/aslivastu/areaCoords.js) using the Google Places API
// (Nearby Search, "New" v1 endpoint), and writes a scored JSON file shaped
// like data/aslivastu/nqi_scores.json so it drops straight into the same
// combined-score pipeline as crime/schools/infra.
//
// Usage:
//   GOOGLE_PLACES_API_KEY=xxxx node scripts/fetch-lifestyle-scores.mjs
//
// Optional flags:
//   --city=Bangalore        (default: Bangalore -- only city with real
//                             lifestyle-scoring value right now; Delhi NCR's
//                             AREA_COORDS entries work the same way if you
//                             want to extend later)
//   --radius=1200            search radius in metres around each pincode
//                             centroid (default 1200 -- roughly a 10-15 min
//                             walk, matches "is this pin walkable to
//                             nightlife" rather than "is it in the same zip")
//   --out=data/aslivastu/lifestyle_scores.json
//
// Cost note: this makes 1 Nearby Search call PER CATEGORY PER PINCODE.
// With 4 categories (restaurant, bar, night_club, cafe) x 66 Bangalore
// pincodes = 264 calls per run. Nearby Search (New) is billed per request
// under Google's "Places API (New)" SKU -- check current pricing before
// running this on a schedule. Re-running daily is almost certainly overkill;
// venue density doesn't meaningfully change week to week. A monthly or
// quarterly cron is more than enough -- see the note at the bottom of this
// file for wiring that up.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY env var. Aborting.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const CITY = args.city || 'Bangalore';
const RADIUS_M = Number(args.radius || 1200);
const OUT_PATH = path.join(ROOT, args.out || 'data/aslivastu/lifestyle_scores.json');

// Categories we count per pincode. Google Places "New" uses includedTypes
// from a fixed taxonomy -- these four give a clean nightlife/dining split
// without double-counting (a place can have multiple types, Places API
// dedupes within one Nearby Search call by primary type match).
const CATEGORIES = [
  { key: 'nightlife', types: ['bar', 'night_club'] },
  { key: 'dining', types: ['restaurant'] },
  { key: 'cafes', types: ['cafe'] },
];

async function nearbyCount(lat, lng, includedTypes) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      // We only need the count + a couple of fields for the sample list --
      // requesting a narrow fieldMask keeps this call in the cheapest
      // Places API (New) pricing tier instead of the "Pro"/full-detail one.
      'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.types',
    },
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20, // API max per call; we only need density, not every venue
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Places API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const places = data.places || [];
  return {
    count: places.length, // capped at maxResultCount=20 -- see note below
    top: places
      .slice()
      .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.displayName?.text || null,
        rating: p.rating ?? null,
        rating_count: p.userRatingCount ?? null,
      })),
  };
}

// Normalizes a raw venue count to a 0-100 score using a simple saturating
// curve: 0 venues -> 0, and the score approaches 100 as count approaches
// `saturateAt`. This is deliberately simple -- swap for percentile-across-
// pincodes ranking later if raw counts turn out skewed once you see the
// real distribution across all 66.
function scoreFromCount(count, saturateAt) {
  return Math.round(100 * Math.min(1, count / saturateAt));
}

async function main() {
  const { AREA_COORDS } = await import(path.join(ROOT, 'lib/aslivastu/areaCoords.js'));
  const { PIN_META } = await import(path.join(ROOT, 'lib/aslivastu/pinMeta.js'));

  const nqiPath = path.join(ROOT, 'data/aslivastu/nqi_scores.json');
  const nqi = JSON.parse(fs.readFileSync(nqiPath, 'utf8'));
  let pins = [...new Set(nqi.filter(r => r.city === CITY).map(r => r.pin_code))].sort();

  // --pin=560038 (or comma-separated --pin=560038,560008) targets specific
  // pincode(s) directly -- takes priority over --limit. Use this to test a
  // named area (e.g. Indiranagar) instead of whatever's alphabetically
  // first.
  if (args.pin) {
    const wanted = new Set(String(args.pin).split(',').map(s => s.trim()));
    const missing = [...wanted].filter(p => !pins.includes(p));
    if (missing.length) {
      console.warn(`Warning: ${missing.join(', ')} not found in nqi_scores.json for ${CITY}, skipping.`);
    }
    pins = pins.filter(p => wanted.has(p));
    console.log(`--pin: fetching ${pins.length} specified pincode(s) (${pins.join(', ')})`);
  } else if (args.limit) {
    const n = Number(args.limit);
    pins = pins.slice(0, n);
    console.log(`--limit=${n}: only fetching first ${pins.length} pincode(s) (${pins.join(', ')})`);
  }

  console.log(`Fetching lifestyle density for ${pins.length} ${CITY} pincodes, radius ${RADIUS_M}m...`);
  console.log(`This will make ${pins.length * CATEGORIES.length} API calls total.`);

  const results = [];
  for (const [i, pin] of pins.entries()) {
    const coords = AREA_COORDS[pin];
    if (!coords) {
      console.warn(`  [${i + 1}/${pins.length}] ${pin}: no centroid in AREA_COORDS, skipping`);
      continue;
    }
    const [lat, lng] = coords;
    process.stdout.write(`  [${i + 1}/${pins.length}] ${pin} (${PIN_META[pin]?.name || '?'})... `);

    try {
      const byCategory = {};
      for (const cat of CATEGORIES) {
        // Simple sequential + delay to stay well under rate limits --
        // 264 calls at ~150ms apart is under a minute total, no need to
        // parallelize and risk 429s.
        byCategory[cat.key] = await nearbyCount(lat, lng, cat.types);
        await new Promise(r => setTimeout(r, 150));
      }

      const nightlife_count = byCategory.nightlife.count;
      const dining_count = byCategory.dining.count;
      const cafes_count = byCategory.cafes.count;

      // Nearby Search caps at 20 results/call, so raw counts here are
      // "density up to 20" not true totals -- fine for relative
      // scoring/ranking pincodes against each other, NOT a real venue
      // census. If you need true counts later, switch to Text Search with
      // pagination instead of Nearby Search.
      results.push({
        pin_code: pin,
        city: CITY,
        scores: {
          nightlife: scoreFromCount(nightlife_count, 12), // 12+ bars/clubs in radius = max score
          dining: scoreFromCount(dining_count, 20), // likely to hit the 20-cap often -- see note above
          cafes: scoreFromCount(cafes_count, 10),
        },
        nightlife_count,
        dining_count,
        cafes_count,
        top_nightlife: byCategory.nightlife.top,
        top_dining: byCategory.dining.top,
        radius_m: RADIUS_M,
        fetched_at: new Date().toISOString(),
      });
      console.log(`nightlife=${nightlife_count} dining=${dining_count} cafes=${cafes_count}`);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      results.push({ pin_code: pin, city: CITY, error: err.message, fetched_at: new Date().toISOString() });
    }
  }

  // Composite lifestyle score -- weighted toward nightlife since that's the
  // "young audience" signal this was built for; dining/cafes count as a
  // softer social-density signal. Tune these weights once you see real
  // numbers across all 66 pincodes.
  for (const r of results) {
    if (r.error) continue;
    r.lifestyle_composite = Math.round(
      r.scores.nightlife * 0.5 + r.scores.dining * 0.3 + r.scores.cafes * 0.2
    );
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} pincodes to ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// ---------------------------------------------------------------------
// Scheduling note: this is a plain Node script, not a Next.js route, on
// purpose -- it writes a committed data file (like nqi_scores.json already
// is) rather than hitting Google on every user request. Run it locally or
// in CI on a schedule (monthly cron / GitHub Action) and commit the
// resulting lifestyle_scores.json, the same way nqi_scores.json is
// presumably refreshed. Do NOT call the Places API live from the
// app/api/property-score route per user request -- that's 264 calls'
// worth of cost repeated on every single page load for no reason, since
// this data doesn't change per-request.
// ---------------------------------------------------------------------
