// app/api/geo/route.js
// Which covered city the visitor is probably in -- from the IP geolocation
// headers Vercel already attaches to every request, so no permission
// prompt and no third-party lookup. Only used to pick which example chips
// the hero shows (lib/tryPlaces.js); a wrong or missing answer just means
// the default chips, so this never errors.
import { NextResponse } from 'next/server';
import { resolveCoveredCity } from '@/lib/aslivastu/cityAliases';
import { nearestCoveredCity } from '@/lib/tryPlaces';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const h = request.headers;
  let cityName = h.get('x-vercel-ip-city') || '';
  try { cityName = decodeURIComponent(cityName); } catch {}
  const lat = parseFloat(h.get('x-vercel-ip-latitude'));
  const lon = parseFloat(h.get('x-vercel-ip-longitude'));

  const city = resolveCoveredCity(cityName) || nearestCoveredCity(lat, lon);
  return NextResponse.json(
    { city: city || null },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
