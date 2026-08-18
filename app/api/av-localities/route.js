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
        // Dropped previously -- this route hand-picks fields from `r`
        // instead of spreading it, and these two were left off the list.
        // nqi_scores.json already carries both correctly (e.g. PIN 122002
        // is dimensions_scored:7, dimensions_total:8 -- one of the 8
        // canonical dimensions genuinely isn't scored for that pin), and
        // AVAreaCard.js already reads them -- it was just always falling
        // back to Object.keys(scores).length (making "7/8" read as "7/7")
        // because this API never forwarded the real total. The full
        // report page never had this bug: its data path (getReportData.js)
        // spreads the raw record instead of listing fields by hand.
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
        // Real-estate portals (99acres, MagicBricks, Housing) all organise
        // Chandigarh browsing by INDIVIDUAL sector -- "Sector 22", "Sector
        // 44" -- never by the compressed pincode ranges we used to show
        // ("Sectors 21-22, 32-35"). Nobody searches for a range; they
        // search for their own sector number and expect to land directly
        // on it. So one pincode with N sectors becomes N rows here, each
        // its own sector, all correctly sharing the one real score that
        // pincode actually has (that sharing is real, not fabricated --
        // AsliVastu only has pincode-level data, this just presents it the
        // way people actually look for it).
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
        // Village/colony pincodes with no sector numbers at all (Manimajra,
        // Ram Darbar, Mauli Jagran, Air Force Station...) -- keep as one
        // named row, same as Delhi/Bangalore.
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
          // Numeric sector order (1, 2, 3...) reads like an actual sector
          // list; sorting this by score would scatter "Sector 5, Sector
          // 41, Sector 12..." in a way nobody browsing sectors expects.
          // Non-sector village rows sort after, alphabetically.
          const an = a.sectorNum ?? 9999, bn = b.sectorNum ?? 9999;
          if (an !== bn) return an - bn;
          return a.name.localeCompare(b.name);
        }
        return b.nqi_composite - a.nqi_composite;
      });
    }

    return NextResponse.json({ cities: byCity });
  } catch (err) {
    console.error('[av-localities] Failed to read local AsliVastu data:', err?.message || err);
    return NextResponse.json({ error: 'Could not load neighbourhood data' }, { status: 500 });
  }
}
