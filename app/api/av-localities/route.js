// app/api/av-localities/route.js
// Reads AsliVastu's actual scoring data DIRECTLY from BlindSpot's own copy
// (data/aslivastu/nqi_scores.json + lib/aslivastu/pinMeta.js + areaCoords.js)
// -- no live network call to aslivastu.com at all. Merges scores + locality
// names + map centroids into one payload for the searchable-by-name picker.

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { PIN_META } from '@/lib/aslivastu/pinMeta';
import { AREA_COORDS } from '@/lib/aslivastu/areaCoords';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
    const scores = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const byCity = {};
    for (const r of scores) {
      const meta = PIN_META[r.pin_code];
      const coords = AREA_COORDS[r.pin_code];
      const enriched = {
        pin_code: r.pin_code,
        name: meta?.name || r.pin_code,
        area: meta?.area || null,
        city: r.city,
        lat: coords ? coords[0] : null,
        lon: coords ? coords[1] : null,
        nqi_composite: r.nqi_composite,
        grade: r.grade,
        scores: r.scores,
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
      byCity[r.city].push(enriched);
    }
    for (const city of Object.keys(byCity)) {
      byCity[city].sort((a, b) => b.nqi_composite - a.nqi_composite);
    }

    return NextResponse.json({ cities: byCity });
  } catch (err) {
    console.error('[av-localities] Failed to read local AsliVastu data:', err?.message || err);
    return NextResponse.json({ error: 'Could not load AsliVastu data' }, { status: 500 });
  }
}
