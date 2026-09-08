// lib/aslivastu/localities.js
// The row-building logic behind /api/av-localities, pulled out so it can
// also run in-process (no HTTP round trip) from a server component --
// specifically app/property-score/page.js resolving a "Continue to Sun
// Score" pin server-side, before the client ever paints. The route below
// is now a thin wrapper so its existing behaviour/shape is unchanged.

import fs from 'node:fs';
import path from 'node:path';
import { PIN_META } from './pinMeta';
import { AREA_COORDS } from './areaCoords';

export function buildLocalitiesByCity() {
  const filePath = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
  const scores = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const masterPath = path.join(process.cwd(), 'data', 'aslivastu', 'master_by_pin.json');
  let masterByPin = {};
  try {
    const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    masterByPin = Object.fromEntries(master.map(m => [m.pin_code, m]));
  } catch { /* master file optional */ }

  const byCity = {};
  for (const r of scores) {
    const meta = PIN_META[r.pin_code];
    const coords = AREA_COORDS[r.pin_code];
    const master = masterByPin[r.pin_code] || {};
    const sectors = meta?.sectors || [];
    const aliases = meta?.aliases || [];
    const base = {
      ...master,
      pin_code: r.pin_code,
      area: meta?.area || null,
      aliases,
      city: r.city,
      lat: coords ? coords[0] : null,
      lon: coords ? coords[1] : null,
      nqi_composite: r.nqi_composite,
      grade: r.grade,
      scores: r.scores,
      dimensions_scored: r.dimensions_scored,
      dimensions_total: r.dimensions_total,
      weights_applied: r.weights_applied,
      schools_count: r.schools_count,
      schools_list: r.schools_list || [],
      crime_tier: r.crime_tier,
      crime_percentile: r.crime_percentile,
      total_cognizable_crimes: r.total_cognizable_crimes,
      price_tier: r.price_tier,
      price_context: r.price_context,
      scored_at: r.scored_at,
    };

    if (!byCity[r.city]) byCity[r.city] = [];

    if (sectors.length > 0) {
      const sorted = [...sectors].sort((a, b) => a - b);
      for (const n of sorted) {
        byCity[r.city].push({
          ...base,
          name: `Sector ${n}`,
          sectorNum: n,
          sectors: sorted,
        });
      }
    } else {
      byCity[r.city].push({
        ...base,
        name: meta?.name || r.pin_code,
        sectorNum: null,
        sectors: [],
      });
    }
  }
  for (const city of Object.keys(byCity)) {
    const hasSectors = byCity[city].some(row => row.sectorNum != null);
    byCity[city].sort((a, b) => {
      if (hasSectors) {
        const an = a.sectorNum ?? 9999, bn = b.sectorNum ?? 9999;
        if (an !== bn) return an - bn;
        return a.name.localeCompare(b.name);
      }
      return b.nqi_composite - a.nqi_composite;
    });
  }
  return byCity;
}

// Used by the property-score page's server-side "Continue to Sun Score"
// hand-off: find the one row a pin[/city][/sector] resolves to, without
// the client having to fetch the whole locality set first.
export function findLocality(byCity, { pin, city, sector }) {
  const lists = city ? [byCity[city] || []] : Object.values(byCity);
  for (const list of lists) {
    const bySector = sector != null ? list.find(r => r.pin_code === pin && r.sectorNum === sector) : null;
    if (bySector) return bySector;
    const byPin = list.find(r => r.pin_code === pin);
    if (byPin) return byPin;
  }
  return null;
}

// Single-record lookup by exact PIN code -- used by the homepage hero's
// live insight chips, which need one real record for whatever address
// was just searched, not the whole by-city dataset (avoids shipping
// every schools_list array in the app just to read one composite score).
// Same field shape as buildLocalitiesByCity()'s per-row `base` object,
// minus the sector expansion (a hero search result is one point, not a
// sector picker) -- deliberately reads the same two JSON files rather
// than routing through buildLocalitiesByCity(), so this stays a cheap
// single lookup instead of building all 309 rows to use one.
export function getLocalityByPin(pin) {
  if (!pin) return null;
  const filePath = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
  const scores = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const r = scores.find(row => row.pin_code === pin);
  if (!r) return null;

  const masterPath = path.join(process.cwd(), 'data', 'aslivastu', 'master_by_pin.json');
  let master = {};
  try {
    const all = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    master = all.find(m => m.pin_code === pin) || {};
  } catch { /* master file optional */ }

  const meta = PIN_META[pin];
  const coords = AREA_COORDS[pin];

  return {
    ...master,
    pin_code: pin,
    area: meta?.area || null,
    name: meta?.name || pin,
    city: r.city,
    lat: coords ? coords[0] : null,
    lon: coords ? coords[1] : null,
    nqi_composite: r.nqi_composite,
    grade: r.grade,
    scores: r.scores,
    crime_tier: r.crime_tier,
    crime_percentile: r.crime_percentile,
    schools_count: r.schools_count,
    scored_at: r.scored_at,
  };
}
