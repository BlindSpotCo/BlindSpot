// app/api/sunscout/geocode/route.js
//
// One typed address -> [lat, lon].
//
// Two providers, not one. Photon first (it is the primary in the sibling
// geocode-suggest endpoint and tolerates partial input better), Nominatim
// second. Either can be unreachable from a given network -- a VPN exit
// node, a corporate egress rule, a rate limit -- and when the single
// provider we had went dark, every lookup returned {result:null}, which
// the UI could only report as "we couldn't find that address". A blocked
// service read as the person's typo.
//
// So the answer now carries a reason: 'not-found' means both providers
// answered and neither knew the place; 'unreachable' means neither
// answered at all. Those need different words in front of a person, and
// different actions from them.
import { NextResponse } from 'next/server';

const IN_BIAS = { lat: 20.5937, lon: 78.9629 }; // rough centre of India

async function viaPhoton(q) {
  const r = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=en&lat=${IN_BIAS.lat}&lon=${IN_BIAS.lon}`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!r.ok) throw new Error(`photon-${r.status}`);
  const data = await r.json();
  const f = data?.features?.[0];
  const c = f?.geometry?.coordinates; // [lon, lat]
  if (!Array.isArray(c) || c.length < 2) return null;
  return [parseFloat(c[1]), parseFloat(c[0])];
}

async function viaNominatim(q) {
  // countrycodes=in matters: without it a short query like "Sector 17"
  // resolves to whatever the top global match happens to be, not anywhere
  // BlindSpot covers.
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`,
    {
      headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://blindspotco.net)' },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!r.ok) throw new Error(`nominatim-${r.status}`);
  const data = await r.json();
  if (!data?.[0]) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ result: null, reason: 'empty' });

  let reachedSomeone = false;

  for (const [name, lookup] of [['photon', viaPhoton], ['nominatim', viaNominatim]]) {
    try {
      const hit = await lookup(q);
      reachedSomeone = true;
      if (hit && Number.isFinite(hit[0]) && Number.isFinite(hit[1])) {
        return NextResponse.json({ result: hit, source: name });
      }
    } catch (e) {
      console.error(`[geocode] ${name} failed:`, e?.message || e);
    }
  }

  return NextResponse.json({
    result: null,
    reason: reachedSomeone ? 'not-found' : 'unreachable',
  });
}
