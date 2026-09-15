// lib/sunscout/scoring/noiseScore.js
// Noise Risk -- a real 7th sub-score, following windScore.js's own
// pattern: fetch (live external data) + compute (pure) live in one file,
// fail-soft to a neutral score if the fetch fails.
//
// Unlike dampnessScore.js (which leans on city-level climate averages
// because no per-property signal exists for monsoon rain), noise has a
// genuinely per-property signal already available in this app: the same
// Overpass/OSM API buildingHeights.js and estimateFacing.js already
// query for this exact lat/lon, extended to major roads and rail lines
// instead of building footprints. So this is real geospatial data about
// THIS property, not a city-wide proxy.
//
// Three real signals combine:
//  1. Distance to the nearest major road (motorway/trunk/primary/
//     secondary) or rail line, live from OpenStreetMap -- closer and a
//     bigger road class means more exposure.
//  2. Floor. Documented in traffic-noise/high-rise acoustics: street
//     noise drops off fastest over the first several floors as the
//     building's own mass screens the source, then levels off -- it
//     never fully disappears (residual ambient hum), so this floors at
//     0.15, not 0.
//  3. Facing, relative to which direction the loudest nearby source
//     actually sits from this point -- a unit facing toward the road
//     takes more direct noise than one facing away, same physical logic
//     as shadeHeatScore's facing multiplier, just for sound instead of
//     sun.
//
// Same honesty rule as the rest of scoring/: OSM's major-road/rail
// tagging can be incomplete in a given area, and this has no live
// decibel reading -- an empty result means "nothing tagged nearby",
// not "confirmed quiet", and the summary says so.

import './../networkFix';
import { clamp } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 300;
// Longer than buildingHeights.js/estimateFacing.js's 8s -- this query is
// heavier (two combined road/rail lookups over a wider 300m radius vs.
// their single-type 150m queries), so it's more likely to still be
// running on Overpass's public server past 8s under normal load. The
// Overpass-side [timeout:] is set a couple seconds under this so the
// server gives up and responds before our own AbortController would.
const OVERPASS_TIMEOUT_S = 12;
const FETCH_TIMEOUT_MS = 14000;

// Relative noise-source strength by class, not a claimed dB value --
// ranked in the order any acoustics guide would rank them (motorway
// traffic loudest and most constant, secondary roads and rail lines
// intermittently loud but far less than a motorway).
const SOURCE_SEVERITY = {
  motorway: 1.0,
  trunk: 0.9,
  primary: 0.75,
  secondary: 0.55,
  rail: 0.7,
};

const FACING_BEARING = {
  North: 0, 'North-East': 45, East: 90, 'South-East': 135,
  South: 180, 'South-West': 225, West: 270, 'North-West': 315,
};

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Fetches nearby major roads/rail from OSM and reduces each to its
// closest vertex to (lat, lon) -- an approximation of nearest-point-on-
// way (vertices only, not the true perpendicular distance to a segment),
// same order of precision as estimateFacing.js's building-bearing proxy.
export async function fetchNearbyNoiseSources(lat, lon) {
  const query =
    `[out:json][timeout:${OVERPASS_TIMEOUT_S}];` +
    `(way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${RADIUS_M},${lat},${lon});` +
    `way["railway"="rail"](around:${RADIUS_M},${lat},${lon}););` +
    `out geom;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BlindSpot/1.0 (+https://blindspotco.net; property intelligence platform)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('[noiseScore] Overpass returned', res.status);
      return null;
    }

    const data = await res.json();
    const elements = (data?.elements || []).filter(el => Array.isArray(el.geometry) && el.geometry.length);

    const sources = elements.map(el => {
      const cls = el.tags?.highway || el.tags?.railway;
      let nearest = null, nearestDist = Infinity;
      for (const pt of el.geometry) {
        const d = haversineM(lat, lon, pt.lat, pt.lon);
        if (d < nearestDist) { nearestDist = d; nearest = pt; }
      }
      return {
        class: cls,
        severity: SOURCE_SEVERITY[cls] ?? 0.5,
        distanceM: nearestDist,
        bearingFromProperty: nearest ? bearing(lat, lon, nearest.lat, nearest.lon) : null,
      };
    }).filter(s => Number.isFinite(s.distanceM));

    return { sources, radiusM: RADIUS_M };
  } catch (err) {
    clearTimeout(timeout);
    console.error('[noiseScore] Overpass errored:', err?.message || err);
    return null;
  }
}

export function computeNoiseScore(noiseData, floor, facing) {
  if (!noiseData) {
    return {
      key: 'noise',
      label: 'Noise Risk',
      score: 50,
      summary: 'Live road/rail proximity data unavailable for this location, showing a neutral score.',
      basis: 'Overpass request failed or timed out.',
    };
  }

  const { sources, radiusM } = noiseData;

  if (!sources.length) {
    return {
      key: 'noise',
      label: 'Noise Risk',
      score: 80,
      summary: `No major road or rail line tagged within ${radiusM}m in OpenStreetMap -- likely a quiet interior location, though this reflects map data, not a sound-level reading.`,
      basis: `sourcesFound=0 within radius=${radiusM}m`,
    };
  }

  const floorAttenuation = clamp(1 - floor / 8, 0.15, 1);

  const scored = sources.map(s => {
    const proximityFactor = clamp(1 - s.distanceM / radiusM, 0, 1);
    const facingBearing = FACING_BEARING[facing];
    let facingMultiplier = 1.0;
    if (facingBearing != null && s.bearingFromProperty != null) {
      const diff = angleDiff(facingBearing, s.bearingFromProperty);
      facingMultiplier = diff <= 60 ? 1.15 : diff >= 120 ? 0.8 : 1.0;
    }
    const exposure = s.severity * proximityFactor * facingMultiplier * floorAttenuation;
    return { ...s, exposure, proximityFactor, facingMultiplier };
  });

  const dominant = scored.reduce((max, s) => (s.exposure > max.exposure ? s : max), scored[0]);
  const riskRatio = clamp(dominant.exposure, 0, 1);
  const score = Math.round((1 - riskRatio) * 100);

  const classLabel = dominant.class === 'rail' ? 'a rail line' : `a ${dominant.class} road`;
  const summaryLine =
    riskRatio < 0.3
      ? `Low noise risk -- nearest major road/rail is ${classLabel}, ${Math.round(dominant.distanceM)}m away, with floor/facing helping shield this unit.`
      : riskRatio < 0.6
      ? `Moderate noise risk from ${classLabel} ${Math.round(dominant.distanceM)}m away (floor ${floor}, ${facing}-facing).`
      : `Higher noise risk, ${classLabel} only ${Math.round(dominant.distanceM)}m away and this unit's floor/facing don't offer much shielding.`;

  return {
    key: 'noise',
    label: 'Noise Risk',
    score,
    summary: summaryLine,
    basis:
      `nearestSource=${dominant.class}@${Math.round(dominant.distanceM)}m (severity=${dominant.severity}), ` +
      `floorAttenuation(floor=${floor})=${floorAttenuation.toFixed(2)}, facingMultiplier(${facing})=${dominant.facingMultiplier} ` +
      `→ riskRatio=${riskRatio.toFixed(2)} (OSM road/rail proximity estimate, not a measured decibel reading)`,
  };
}
