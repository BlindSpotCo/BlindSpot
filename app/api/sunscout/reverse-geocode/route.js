// app/api/sunscout/reverse-geocode/route.js
// Given lat/lon, resolves the postcode + a display address via Nominatim.
// Used by the "direct address" entry flow to figure out which (if any)
// AsliVastu-covered pincode a searched/dragged pin falls inside.
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  if (!lat || !lon) return NextResponse.json({ result: null });

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://blindspotco.net)' } }
    );
    const data = await r.json();
    if (data && !data.error) {
      const a = data.address || {};
      const postcode = a.postcode || null;
      return NextResponse.json({
        result: {
          postcode,
          displayName: data.display_name || null,
          locality: a.suburb || a.neighbourhood || a.city_district || a.town || a.village || null,
          city: a.city || a.state_district || a.state || null,
        },
      });
    }
  } catch {}
  return NextResponse.json({ result: null });
}
