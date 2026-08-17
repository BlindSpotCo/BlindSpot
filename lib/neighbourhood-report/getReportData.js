// lib/neighbourhood-report/getReportData.js
// Server-side loader for the standalone neighbourhood-report page. Reads the
// SAME local files av-localities/route.js reads (data/aslivastu/nqi_scores.json
// + data/aslivastu/master_by_pin.json + lib/aslivastu/pinMeta.js +
// areaCoords.js) — no live call to aslivastu.com. Kept separate from
// av-localities so this route doesn't depend on an HTTP round-trip to
// itself; it hits the filesystem directly like that route does.
//
// master_by_pin.json is only merged into the MAIN record (the granular
// per-category fields AVDetailedReadout needs) — the nearby-comparison list
// only shows composite/dimension scores, so it stays on the lighter
// nqi_scores.json-only shape to keep that section cheap.

import fs from 'node:fs';
import path from 'node:path';
import { PIN_META } from '@/lib/aslivastu/pinMeta';
import { AREA_COORDS } from '@/lib/aslivastu/areaCoords';

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function enrich(r) {
  const meta = PIN_META[r.pin_code];
  const coords = AREA_COORDS[r.pin_code];
  return {
    ...r,
    name: meta?.name || r.pin_code,
    area: meta?.area || null,
    lat: coords ? coords[0] : null,
    lon: coords ? coords[1] : null,
  };
}

function loadMasterByPin() {
  try {
    const masterPath = path.join(process.cwd(), 'data', 'aslivastu', 'master_by_pin.json');
    const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    return Object.fromEntries(master.map(m => [m.pin_code, m]));
  } catch {
    return {}; // optional — detail cards fall back to em-dashes for missing fields
  }
}

// Returns { record, nearby } or null if the pin isn't in our data.
//
// `sector`, when given, is the sector NUMBER the report was opened for
// (see AVAreaCard.js's link, which passes ?sector=N for Chandigarh rows).
// /api/av-localities already expands a multi-sector pincode like 160001
// into one row per sector ("Sector 1" .. "Sector 5") because that's how
// people actually search -- but this page reads PIN_META directly and,
// without this, would fall back to the pincode's own raw compressed name
// ("Sectors 1-5 · Capitol Complex") no matter which sector you clicked
// through from. Validated against that pincode's real `sectors` list
// rather than trusted blindly, since it arrives as a URL param.
export function getReportData(pin, nearbyCount = 4, sector = null) {
  const filePath = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const match = raw.find(r => r.pin_code === pin);
  if (!match) return null;

  const masterByPin = loadMasterByPin();
  const record = { ...(masterByPin[pin] || {}), ...enrich(match) };

  const meta = PIN_META[pin];
  const sectorNum = sector != null ? Number(sector) : null;
  if (sectorNum != null && Number.isFinite(sectorNum) && meta?.sectors?.includes(sectorNum)) {
    record.name = `Sector ${sectorNum}`;
    record.sectorNum = sectorNum;
  }

  let nearby = [];
  if (record.lat != null && record.lon != null) {
    nearby = raw
      .filter(r => r.pin_code !== pin && r.city === record.city)
      .map(enrich)
      .filter(r => r.lat != null && r.lon != null)
      .map(r => ({ ...r, _distKm: haversineKm([record.lat, record.lon], [r.lat, r.lon]) }))
      .sort((a, b) => a._distKm - b._distKm)
      .slice(0, nearbyCount);
  }

  return { record, nearby };
}
