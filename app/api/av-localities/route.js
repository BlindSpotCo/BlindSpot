// app/api/av-localities/route.js
// Reads AsliVastu's actual scoring data DIRECTLY from BlindSpot's own copy
// (data/aslivastu/nqi_scores.json + lib/aslivastu/pinMeta.js + areaCoords.js)
// -- no live network call to aslivastu.com at all. Merges scores + locality
// names + map centroids into one payload for the searchable-by-name picker.
//
// The actual row-building lives in lib/aslivastu/localities.js now, shared
// with app/property-score/page.js's server-side "Continue to Sun Score"
// pin resolution -- this route is just that function over HTTP.

import { NextResponse } from 'next/server';
import { buildLocalitiesByCity } from '@/lib/aslivastu/localities';

export async function GET() {
  try {
    return NextResponse.json({ cities: buildLocalitiesByCity() });
  } catch (err) {
    console.error('[av-localities] Failed to read local AsliVastu data:', err?.message || err);
    return NextResponse.json({ error: 'Could not load neighbourhood data' }, { status: 500 });
  }
}
