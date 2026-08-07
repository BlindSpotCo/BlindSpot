// app/api/sunscout/score/route.js
// Ported from SunScout's app/api/score/route.ts -- computes the Home
// Comfort Score / LiveScore natively inside BlindSpot.
import { NextResponse } from 'next/server';
import { computeLiveScore } from '@/lib/sunscout/scoring/scoreAggregator';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat      = parseFloat(searchParams.get('lat') || '12.97');
  const lon      = parseFloat(searchParams.get('lon') || '77.59');
  const tzOffset = parseInt(searchParams.get('tzOffset') || '330', 10);
  const floor    = parseInt(searchParams.get('floor') || '5', 10);
  const facing   = searchParams.get('facing') || 'South';

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: 'Invalid lat/lon' }, { status: 400 });
  }

  const weightKeys = ['sun', 'shadeHeat', 'view', 'privacy', 'wind'];
  const weights = {};
  for (const key of weightKeys) {
    const raw = searchParams.get(`${key}Weight`);
    if (raw !== null) {
      const val = parseFloat(raw);
      if (!Number.isNaN(val)) weights[key] = val;
    }
  }

  try {
    const result = await computeLiveScore({
      lat, lon, floor, facing,
      tzOffsetMinutes: tzOffset,
      weights,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('LiveScore computation failed:', err);
    return NextResponse.json({ error: 'Score computation failed' }, { status: 500 });
  }
}
