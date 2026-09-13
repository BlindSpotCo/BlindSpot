// app/api/compare/property/route.js
//
// Everything the comparison board needs about one property, in one call:
// the neighbourhood score for its pincode, the Home Comfort Score for that
// specific floor and facing, and the month-by-month sun the facade actually
// receives.
//
// It exists so the comparison can be a standalone tool. The buyer picks
// three addresses and sees the answer -- no account, no generating three
// full reports first, no saving them into folders. Those are steps that
// made sense for producing a document and make no sense at all for
// answering "which of these three".
//
// Both halves degrade independently. An address outside our neighbourhood
// coverage still gets its unit measured, because sun and shadow are
// computed from geometry and work anywhere on earth; a pincode we cover
// still answers if the wind service is down. A property that half-answers
// is far more useful here than an error, because the comparison only needs
// the rows the buyer can actually see.

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { computeLiveScore } from '@/lib/sunscout/scoring/scoreAggregator';
import { computeSolarSummary } from '@/lib/sunscout/solarReport';

const FACINGS = new Set(['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']);

let avCache = null;
function areaRecord(pin) {
  if (!pin) return null;
  try {
    if (!avCache) {
      const p = path.join(process.cwd(), 'data', 'aslivastu', 'nqi_scores.json');
      avCache = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    return avCache.find((r) => r.pin_code === pin) || null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const lat = parseFloat(q.get('lat'));
  const lon = parseFloat(q.get('lon'));
  const pin = (q.get('pin') || '').trim();
  const floorRaw = parseInt(q.get('floor') ?? '', 10);
  const facingRaw = q.get('facing') || 'South';
  const tz = Number.isFinite(parseInt(q.get('tzOffset'), 10)) ? parseInt(q.get('tzOffset'), 10) : 330;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }
  // A floor typed as "G" or left blank is ground, not a crash.
  const floor = Number.isFinite(floorRaw) ? Math.max(0, Math.min(120, floorRaw)) : 0;
  const facing = FACINGS.has(facingRaw) ? facingRaw : 'South';

  // Run both halves concurrently and let either fail on its own. Promise.all
  // would throw the whole property away because the wind API was slow.
  const [unitRes, solarRes] = await Promise.allSettled([
    computeLiveScore({ lat, lon, floor, facing, tzOffsetMinutes: tz }),
    computeSolarSummary(lat, lon, floor, facing, tz),
  ]);

  const unit = unitRes.status === 'fulfilled' ? unitRes.value : null;
  const solar = solarRes.status === 'fulfilled' ? solarRes.value : null;
  if (!unit && !solar) {
    return NextResponse.json({ error: 'could not measure this location' }, { status: 502 });
  }

  const av = areaRecord(pin);
  let areaName = null;
  if (av) {
    try {
      const { PIN_META } = await import('@/lib/aslivastu/pinMeta');
      areaName = PIN_META[pin]?.name || null;
    } catch {}
  }

  return NextResponse.json({
    unit: unit && {
      score: unit.liveScore,
      grade: unit.grade,
      floor: unit.unit.floor,
      facing: unit.unit.facing,
      subScores: unit.subScores.map(({ key, label, score, summary }) => ({ key, label, score, summary })),
    },
    area: av && {
      pin: av.pin_code,
      name: areaName || av.pin_code,
      city: av.city,
      score: av.nqi_composite,
      grade: av.grade,
      factors: av.scores,
    },
    // Null rather than absent, so the client can say "we don't cover this
    // pincode" instead of silently showing a blank where a score belongs.
    areaCovered: !!av,
    solar: solar && {
      monthlySummary: solar.monthlySummary,
      feasibility: solar.solarFeasibility,
    },
  }, {
    // Same address, floor and facing gives the same answer all day. Only
    // the wind input moves, and it is one of five sub-scores.
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
