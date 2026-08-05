// app/api/sunscout/timezone/route.js
// Ported from SunScout's app/api/timezone/route.ts. Needs the `geo-tz` npm
// package added to BlindSpot's own package.json.
import { NextResponse } from 'next/server';
import { find } from 'geo-tz';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || '0');

  try {
    const zones = find(lat, lon);
    const tz = zones[0];
    const now = new Date();
    const utcStr   = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const localStr = now.toLocaleString('en-US', { timeZone: tz });
    const offsetMinutes = Math.round(
      (new Date(localStr).getTime() - new Date(utcStr).getTime()) / 60000
    );
    return NextResponse.json({ tz, offsetMinutes });
  } catch {
    return NextResponse.json({ offsetMinutes: Math.round(lon / 15) * 60 });
  }
}
