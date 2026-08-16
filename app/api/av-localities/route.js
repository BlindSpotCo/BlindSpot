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

    // master_by_pin.json holds the granular per-category fields (discom,
    // AQI reading, water TDS/coverage, road condition, waterlogging risk,
    // etc.) that the AsliVastu detail cards need — same file AV's own
    // /api/report.js merges in (`{ ...score, ...master }`). Optional: if
    // it's ever missing, the detail cards just show em-dashes for the
    // fields they can't find instead of failing the whole route.
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
      const enriched = {
        ...master,
        pin_code: r.pin_code,
        name: meta?.name || r.pin_code,
        area: meta?.area || null,
        // Chandigarh pincodes cover several sectors each (160036 = Sectors
        // 36-43), so `name` shows a RANGE. These are the individual
        // sectors and landmarks inside it, so searching "Sector 40" or
        // "PEC" finds the pin that actually covers them -- otherwise a
        // resident of Sector 40 searches their own sector and gets
        // nothing back. Empty for Delhi/Bangalore, where one pincode
        // already reads as one named locality.
        sectors: meta?.sectors || [],
        aliases: meta?.aliases || [],
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
