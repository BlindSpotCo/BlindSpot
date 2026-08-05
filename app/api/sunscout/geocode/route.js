// app/api/sunscout/geocode/route.js
// Ported from SunScout's app/api/geocode/route.ts.
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  if (!q) return NextResponse.json({ result: null });

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://blindspotco.net)' } }
    );
    const data = await r.json();
    if (data && data[0]) {
      return NextResponse.json({ result: [parseFloat(data[0].lat), parseFloat(data[0].lon)] });
    }
  } catch {}
  return NextResponse.json({ result: null });
}
