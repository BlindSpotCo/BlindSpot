// lib/sunscout/scoring/buildingSight.js
//
// View and privacy from the real buildings around the flat, instead of a
// guess from the floor number alone.
//
// What it does: pulls building outlines and heights within ~200 m from
// OSM Buildings (OpenStreetMap data), drops the flat's own building (the one the pin
// sits in), then looks out from the flat's window height across the side
// the balcony faces (±60°):
//   view    -- how much of that side is open above your eye level, and how
//              close the first building that rises above you is
//   privacy -- how close the nearest building with floors at or above
//              yours is on that side (people there can see in)
//
// Limits, said in the text it returns: OSM has no height for many Indian
// buildings (those are assumed ~4 floors and flagged), and towers that
// aren't mapped yet can't be seen at all. When too few nearby buildings
// have real heights, the score is blended with the floor-based estimate.

import { floorViewPrior, floorPrivacyPrior } from './floorPriors';
import { clamp } from './types';

// Building outlines + heights come from OSM Buildings' data tiles (the same
// source the 3D map draws), fetched server-side. The public Overpass server
// refuses or times out requests from Vercel, so it can't be used here.
const OSMB_KEY = process.env.OSMB_DATA_KEY || '59fcc2e8';
const OSMB_REFERER = process.env.OSMB_REFERER || 'https://blindspotco.net/';
const TILE_Z = 15;
const RADIUS_M = 200;
const CACHE_SECONDS = 60 * 60 * 24 * 7;        // a week: buildings change slowly
const FETCH_TIMEOUT_MS = 6000;

const FLOOR_M = 3.1;          // typical floor-to-floor height in Indian apartments
const EYE_M = 1.4;            // standing eye height above the floor slab
const ASSUMED_H_M = 12;       // no height in OSM -> about 4 floors
const OSMB_DEFAULT_H = 3;     // what OSM Buildings fills in when OSM has no height
const SECTOR_HALF = 60;       // look ±60° either side of the facing
const BIN_DEG = 5;

const FACING_BEARING = {
  North: 0, 'North-East': 45, East: 90, 'South-East': 135,
  South: 180, 'South-West': 225, West: 270, 'North-West': 315,
};

function tileXY(lat, lon, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
}

async function fetchTile(z, x, y) {
  const s = ['a', 'b', 'c', 'd'][(x + y) % 4];
  const url = `https://${s}.data.osmbuildings.org/0.2/${OSMB_KEY}/tile/${z}/${x}/${y}.json`;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, {
        headers: { Referer: OSMB_REFERER, Origin: OSMB_REFERER.replace(/\/$/, '') },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });
      if (r.status === 404) return { features: [] };
      if (r.ok) return await r.json();
    } catch {}
  }
  throw new Error(`tile ${z}/${x}/${y} failed`);
}

// Outlines + heights near (lat, lon), in metres relative to the pin.
export async function fetchNearbyBuildings(lat, lon) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const dLat = (RADIUS_M + 60) / ky, dLon = (RADIUS_M + 60) / kx;
  const [x0, y0] = tileXY(lat + dLat, lon - dLon, TILE_Z);
  const [x1, y1] = tileXY(lat - dLat, lon + dLon, TILE_Z);
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(fetchTile(TILE_Z, x, y));
  const tiles = await Promise.all(jobs).catch((e) => { console.error('[buildingSight]', e?.message || e); return null; });
  if (!tiles) return null;

  const seen = new Set();
  const buildings = [];
  for (const t of tiles) {
    for (const f of t?.features || []) {
      if (f.id && seen.has(f.id)) continue;
      if (f.id) seen.add(f.id);
      const g = f.geometry;
      const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
      const p = f.properties || {};
      const levels = Number(p.levels);
      const hRaw = Number(p.height);
      const known = Number.isFinite(levels) && levels > 0 ? true : Number.isFinite(hRaw) && hRaw !== OSMB_DEFAULT_H;
      const h = known ? (Number.isFinite(hRaw) && hRaw > 0 ? hRaw : levels * FLOOR_M) : ASSUMED_H_M;
      for (const poly of polys) {
        const outer = poly?.[0];
        if (!Array.isArray(outer) || outer.length < 3) continue;
        buildings.push({ id: f.id, name: p.name, ring: outer.map(([lo, la]) => [(lo - lon) * kx, (la - lat) * ky]), h, known });
      }
    }
  }
  return { buildings };
}

function inside([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Signed angle from the facing direction to bearing b, in -180..180.
function off(b, face) {
  let d = (b - face) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);

export function computeSightScores(data, floor, facing) {
  if (!data?.buildings) return null;
  const face = FACING_BEARING[facing];
  if (face == null) return null;
  const eye = Math.max(0, floor) * FLOOR_M + EYE_M;

  // The flat's own building: the outline the pin sits inside. A pin
  // dropped from the tilted 3D map can land just outside its tower, so
  // failing that, the building whose wall is within 15 m of the pin.
  let own = data.buildings.find((b) => inside([0, 0], b.ring));
  if (!own) {
    let best = 15;
    for (const b of data.buildings) {
      const r = b.ring;
      for (let i = 0; i < r.length - 1; i++) {
        const [x1, y1] = r[i], [x2, y2] = r[i + 1];
        const L = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
        const t = clamp(-(x1 * (x2 - x1) + y1 * (y2 - y1)) / L, 0, 1);
        const d = Math.hypot(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
        if (d < best) { best = d; own = b; }
      }
    }
  }
  const others = data.buildings.filter((b) => b !== own && !(own?.id && b.id === own.id) && !inside([0, 0], b.ring));
  const ownFound = Boolean(own);

  const nBins = (SECTOR_HALF * 2) / BIN_DEG + 1;
  const maxAlt = new Array(nBins).fill(0);          // highest angle above eye level, per direction
  let nearestAbove = Infinity;                      // first building rising above your eye level
  let nearestOverlook = Infinity;                   // nearest with floors at or above yours
  const near = new Set(); const nearKnown = new Set();

  others.forEach((b, idx) => {
    const r = b.ring;
    for (let i = 0; i < r.length - 1; i++) {
      const [x1, y1] = r[i], [x2, y2] = r[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(len / 3));
      for (let s = 0; s <= steps; s++) {
        const x = x1 + ((x2 - x1) * s) / steps, y = y1 + ((y2 - y1) * s) / steps;
        const d = Math.hypot(x, y);
        if (d < 3 || d > RADIUS_M) continue;
        const brg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
        const o = off(brg, face);
        if (Math.abs(o) > SECTOR_HALF) continue;
        if (d <= 120) { near.add(idx); if (b.known) nearKnown.add(idx); }
        const bin = Math.round((o + SECTOR_HALF) / BIN_DEG);
        const alt = (Math.atan2(b.h - eye, d) * 180) / Math.PI;
        if (alt > maxAlt[bin]) maxAlt[bin] = alt;
        if (b.h > eye + 3 && d < nearestAbove) nearestAbove = d;
        if (b.h >= eye - 1 && Math.abs(o) <= 45 && d < nearestOverlook) nearestOverlook = d;
      }
    }
  });

  // Each direction: open if nothing rises more than 5° above eye level,
  // shut if something rises 35° or more (a tower filling the window).
  const openness = maxAlt.reduce((a, alt) => a + clamp((35 - alt) / 30, 0, 1), 0) / nBins;
  let view = 15 + 80 * openness;
  if (Number.isFinite(nearestAbove) && nearestAbove < 20) view -= 10;

  const o = nearestOverlook;
  let privacy = !Number.isFinite(o) ? 92 : o <= 12 ? 18 : o <= 25 ? 32 : o <= 45 ? 50 : o <= 80 ? 66 : o <= 140 ? 80 : 90;

  // Too few nearby outlines with real heights: lean on the floor estimate.
  const knownShare = near.size ? nearKnown.size / near.size : 1;
  const blend = knownShare >= 0.5 ? 1 : 0.5;
  view = Math.round(clamp(blend * view + (1 - blend) * floorViewPrior(floor), 5, 98));
  privacy = Math.round(clamp(blend * privacy + (1 - blend) * floorPrivacyPrior(floor), 5, 98));

  const side = String(facing).toLowerCase();
  const pct = Math.round(openness * 100);
  const caveat = knownShare < 0.5
    ? ' Many buildings near you have no height in OpenStreetMap, so this is partly a floor-based estimate.'
    : '';
  const unmapped = ' New towers not yet on OpenStreetMap won’t show here.';

  const viewText = Number.isFinite(nearestAbove)
    ? `Looking ${side}: about ${pct}% of the view is open above your floor; the nearest building rising above you that way is about ${round5(nearestAbove)} m off.`
    : `Looking ${side}: no mapped building rises above your floor within ${RADIUS_M} m.`;
  const privText = Number.isFinite(o)
    ? `The nearest building with floors at your height on the ${side} side is about ${round5(o)} m away.`
    : `No mapped building at your height on the ${side} side within ${RADIUS_M} m.`;

  const basisCommon = `source=OSM Buildings (OpenStreetMap); within=${RADIUS_M}m; sector=±${SECTOR_HALF}°; eye=${eye.toFixed(1)}m; ownBuildingFound=${ownFound}; nearby=${near.size}; withHeight=${nearKnown.size}; floorBlend=${blend < 1}`;

  return {
    view: {
      key: 'view', label: 'View', score: view, source: 'buildings',
      fact: viewText,
      summary: viewText + caveat + unmapped,
      basis: `${basisCommon}; openShare=${pct}%; nearestAbove=${Number.isFinite(nearestAbove) ? Math.round(nearestAbove) + 'm' : 'none'}`,
    },
    privacy: {
      key: 'privacy', label: 'Privacy', score: privacy, source: 'buildings',
      fact: privText,
      summary: privText + caveat + unmapped,
      basis: `${basisCommon}; nearestAtYourHeight=${Number.isFinite(o) ? Math.round(o) + 'm' : 'none'}`,
    },
  };
}
