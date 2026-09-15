// app/api/sunscout/score/route.js
// Ported from SunScout's app/api/score/route.ts -- computes the Home
// Comfort Score / LiveScore natively inside BlindSpot.
import { NextResponse } from 'next/server';
import { computeLiveScore } from '@/lib/sunscout/scoring/scoreAggregator';

// See the matching comment in app/api/property-score/route.js -- same
// reasoning, computeLiveScore's live noise call needs headroom past the
// platform's unconfigured default.
export const maxDuration = 30;

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

  const weightKeys = ['sun', 'shadeHeat', 'view', 'privacy', 'wind', 'dampness', 'noise'];
  const weights = {};
  for (const key of weightKeys) {
    const raw = searchParams.get(`${key}Weight`);
    if (raw !== null) {
      const val = parseFloat(raw);
      if (!Number.isNaN(val)) weights[key] = val;
    }
  }
  // See the matching comment in scoreAggregator.js -- ReportScreen.js
  // calls this route twice: once with skipLiveNoise=1 to render the
  // report immediately, then again without it in the background so the
  // real noise score can be patched in once Overpass actually answers.
  const skipLiveNoise = searchParams.get('skipLiveNoise') === '1';

  try {
    const result = await computeLiveScore({
      lat, lon, floor, facing,
      tzOffsetMinutes: tzOffset,
      weights,
      skipLiveNoise,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('LiveScore computation failed:', err);
    return NextResponse.json({ error: 'Score computation failed' }, { status: 500 });
  }
}
