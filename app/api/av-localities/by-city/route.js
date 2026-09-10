// app/api/av-localities/by-city/route.js
// GET ?city=<one of the 5 canonical city keys> -> a trimmed list of that
// city's covered neighbourhoods, for the hero search box's "you searched
// a city, here's every neighbourhood we score in it" panel.
//
// Deliberately its own route rather than reusing plain /api/av-localities
// (no query param, returns ALL 5 cities' full rows -- schools_list,
// crime_percentile, price_context, the works, ~900KB total): this is a
// homepage widget that only ever needs one city at a time and only ever
// renders a name + score + grade per row, so it filters server-side and
// strips every field the list view doesn't use before it goes out.
import { NextResponse } from 'next/server';
import { buildLocalitiesByCity } from '@/lib/aslivastu/localities';
import { COVERED_CITIES } from '@/lib/aslivastu/cityAliases';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city = (searchParams.get('city') || '').trim();

  if (!COVERED_CITIES.includes(city)) {
    return NextResponse.json({ found: false, reason: 'unknown-city' }, { status: 400 });
  }

  try {
    const byCity = buildLocalitiesByCity();
    const rows = byCity[city] || [];
    const neighbourhoods = rows.map((r) => ({
      pin_code: r.pin_code,
      name: r.name,
      area: r.area,
      sectorNum: r.sectorNum,
      nqi_composite: r.nqi_composite,
      grade: r.grade,
    }));
    return NextResponse.json({ found: true, city, neighbourhoods });
  } catch (err) {
    console.error('[av-localities/by-city] Failed to read local data:', err?.message || err);
    return NextResponse.json({ found: false, reason: 'error' }, { status: 500 });
  }
}
