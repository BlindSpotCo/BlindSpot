// scripts/fetch-lifestyle-scores-osm.mjs
//
// Same output as fetch-lifestyle-scores.mjs, but pulls venue density from
// OpenStreetMap's Overpass API instead of Google Places. No API key, no
// billing, no daily quota -- Overpass is a free public service with a
// fair-use rate limit (we self-throttle to stay well under it).
//
// Trade-off vs Google Places: OSM coverage depends entirely on community
// mapping. Central, well-known Bangalore areas (Indiranagar, Koramangala,
// MG Road, Jayanagar) are well-mapped and give real numbers. Newer/outer
// suburbs may undercount -- a low OSM count there could mean "genuinely
// few venues" OR "not mapped yet," and this script can't tell you which.
// Worth spot-checking a few pincodes you know well before trusting the
// full output.
//
// Usage:
//   node scripts/fetch-lifestyle-scores-osm.mjs
//   node scripts/fetch-lifestyle-scores-osm.mjs --pin=560038
//   node scripts/fetch-lifestyle-scores-osm.mjs --limit=10
//   node scripts/fetch-lifestyle-scores-osm.mjs --radius=1200 --out=data/aslivastu/lifestyle_scores.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const CITY = args.city || 'Bangalore';
const RADIUS_M = Number(args.radius || 1200);
const OUT_PATH = path.join(ROOT, args.out || 'data/aslivastu/lifestyle_scores.json');

// Overpass amenity tags. bar/pub/nightclub = nightlife, restaurant/fast_food
// = dining, cafe = cafes. This mirrors the Google-Places-script's category
// split so both scripts produce interchangeable output shapes.
const CATEGORIES = {
  nightlife: ['bar', 'pub', 'nightclub', 'biergarten'],
  dining: ['restaurant', 'fast_food'],
  cafes: ['cafe'],
};

// Overpass has several independently-run public mirrors. Ordered here with
// the less commonly used ones FIRST -- overpass-api.de is the default
// everyone hits, so it's the most likely to be rate-limited/overloaded
// (which is exactly what happened: 429 then 504 on the first two tries).
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function overpassFetchArea(lat, lng) {
  // Single combined query for ALL amenity types at once, instead of 3
  // separate queries (nightlife/dining/cafes) per pincode. This cuts
  // total Overpass requests by 3x (66 instead of 198 for a full run),
  // which directly reduces both the rate-limit (429) and timeout (504/
  // aborted) failures you were hitting -- fewer round trips, less load
  // per pincode.
  const allTags = [...CATEGORIES.nightlife, ...CATEGORIES.dining, ...CATEGORIES.cafes];
  const amenityRegex = allTags.join('|');
  // Craft breweries/brewpubs (Toit, Big Pitcher, etc.) are frequently
  // tagged microbrewery=yes rather than amenity=bar/pub in OSM -- this is
  // very likely why nightlife came back 0 for a real cluster of them.
  // Added as a second clause, merged into the "nightlife" bucket below.
  const query = `
    [out:json][timeout:40];
    (
      node["amenity"~"^(${amenityRegex})$"](around:${RADIUS_M},${lat},${lng});
      way["amenity"~"^(${amenityRegex})$"](around:${RADIUS_M},${lat},${lng});
      node["microbrewery"="yes"](around:${RADIUS_M},${lat},${lng});
      way["microbrewery"="yes"](around:${RADIUS_M},${lat},${lng});
    );
    out center 80;
  `.trim();

  let lastErr;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Accept': 'application/json',
          'User-Agent': 'BlindSpot-LifestyleScore/1.0 (blindspotco.net)',
        },
        body: query,
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${url} -> ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const elements = data.elements || [];

      // Split the single result set back into categories by amenity tag.
      const byCategory = { nightlife: [], dining: [], cafes: [] };
      for (const el of elements) {
        const amenity = el.tags?.amenity;
        const isMicrobrewery = el.tags?.microbrewery === 'yes';
        if (isMicrobrewery) {
          byCategory.nightlife.push(el);
          continue; // don't also double-count it under dining if it's tagged amenity=restaurant
        }
        if (!amenity) continue;
        for (const [key, tags] of Object.entries(CATEGORIES)) {
          if (tags.includes(amenity)) byCategory[key].push(el);
        }
      }
      const toResult = arr => ({
        count: arr.length,
        top: arr.filter(e => e.tags?.name).slice(0, 5).map(e => ({ name: e.tags.name, amenity: e.tags.amenity })),
      });
      return {
        nightlife: toResult(byCategory.nightlife),
        dining: toResult(byCategory.dining),
        cafes: toResult(byCategory.cafes),
      };
    } catch (err) {
      lastErr = err;
      console.log(`\n    (${url} failed: ${err.message.slice(0, 100)} -- trying next mirror)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error(`All Overpass mirrors failed. Last error: ${lastErr.message}`);
}

function scoreFromCount(count, saturateAt) {
  return Math.round(100 * Math.min(1, count / saturateAt));
}

async function main() {
  const { AREA_COORDS } = await import(path.join(ROOT, 'lib/aslivastu/areaCoords.js'));
  const { PIN_META } = await import(path.join(ROOT, 'lib/aslivastu/pinMeta.js'));

  const nqiPath = path.join(ROOT, 'data/aslivastu/nqi_scores.json');
  const nqi = JSON.parse(fs.readFileSync(nqiPath, 'utf8'));
  let pins = [...new Set(nqi.filter(r => r.city === CITY).map(r => r.pin_code))].sort();

  if (args.pin) {
    const wanted = new Set(String(args.pin).split(',').map(s => s.trim()));
    pins = pins.filter(p => wanted.has(p));
  } else if (args.limit) {
    pins = pins.slice(0, Number(args.limit));
  }

  console.log(`Fetching OSM lifestyle density for ${pins.length} ${CITY} pincodes, radius ${RADIUS_M}m...`);
  console.log(`Free/no-key -- self-throttled to ~1 request/sec per Overpass's fair-use policy.`);

  // Merge with any existing output file instead of overwriting -- lets you
  // run this in batches across sessions without losing earlier pincodes.
  let existing = [];
  if (fs.existsSync(OUT_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    } catch {
      console.warn('Could not parse existing output file, starting fresh.');
    }
  }
  const byPin = new Map(existing.map(r => [r.pin_code, r]));

  for (const [i, pin] of pins.entries()) {
    const coords = AREA_COORDS[pin];
    if (!coords) {
      console.warn(`  [${i + 1}/${pins.length}] ${pin}: no centroid, skipping`);
      continue;
    }
    const [lat, lng] = coords;
    process.stdout.write(`  [${i + 1}/${pins.length}] ${pin} (${PIN_META[pin]?.name || '?'})... `);

    try {
      const results = await overpassFetchArea(lat, lng);
      // One request per pincode now (was 3) -- still pause briefly between
      // pincodes to stay well under the mirrors' rate limits.
      await new Promise(r => setTimeout(r, 2500));

      const nightlife_count = results.nightlife.count;
      const dining_count = results.dining.count;
      const cafes_count = results.cafes.count;

      const scores = {
        nightlife: scoreFromCount(nightlife_count, 12),
        dining: scoreFromCount(dining_count, 20),
        cafes: scoreFromCount(cafes_count, 10),
      };
      const lifestyle_composite = Math.round(
        scores.nightlife * 0.5 + scores.dining * 0.3 + scores.cafes * 0.2
      );

      byPin.set(pin, {
        pin_code: pin,
        city: CITY,
        source: 'osm',
        scores,
        nightlife_count,
        dining_count,
        cafes_count,
        top_nightlife: results.nightlife.top,
        top_dining: results.dining.top,
        lifestyle_composite,
        radius_m: RADIUS_M,
        fetched_at: new Date().toISOString(),
      });
      console.log(`nightlife=${nightlife_count} dining=${dining_count} cafes=${cafes_count}`);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      byPin.set(pin, { pin_code: pin, city: CITY, source: 'osm', error: err.message, fetched_at: new Date().toISOString() });
    }
  }

  const merged = [...byPin.values()];
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));
  console.log(`\nWrote ${merged.length} total pincodes to ${path.relative(ROOT, OUT_PATH)} (${pins.length} fetched this run)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
