// app/api/sunscout/report/suggest-facing/route.js
// Ported from SunScout's app/api/report/suggest-facing/route.ts.
import { NextResponse } from 'next/server';
import { estimateFacing } from '@/lib/sunscout/estimateFacing';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lon = parseFloat(searchParams.get('lon') || '');

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ suggestion: null }, { status: 400 });
  }

  const suggestion = await estimateFacing(lat, lon).catch(() => null);
  return NextResponse.json({ suggestion });
}
