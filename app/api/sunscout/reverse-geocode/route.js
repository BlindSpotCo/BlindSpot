// app/api/sunscout/reverse-geocode/route.js
//
// lat/lon -> postcode + a display address. The postcode is the important
// half: it is what decides whether a moved pin has neighbourhood data at
// all, so when this comes back empty the area side of the report goes
// blank and the person is told their locality isn't covered -- when in
// truth we simply couldn't ask.
//
// Two providers for that reason, same as the forward lookup. Nominatim
// first (its address breakdown is richer and gives a postcode more often),
// Photon second. A `reason` of 'unreachable' distinguishes "neither
// service answered" from "answered, and this pin has no postcode".
import { NextResponse } from 'next/server';

// Nominatim's display_name is a flat comma-join of its whole address
// hierarchy, and Indian admin boundaries routinely repeat a name (or a
// word of it) across two adjacent levels -- "Hauz Khas Village Road,
// Hauz Khas Village, Hauz Khas, South, Delhi, South Delhi, Delhi" is the
// raw shape it hands back for a real Hauz Khas pin, not a bug in what
// we're asking for. One mechanical, order-preserving pass: a segment
// that adds no word the nearest still-kept segment doesn't already have
// is dropped, and a segment that says an earlier one more fully replaces
// it. Never a fuzzy similarity guess -- only a real word-for-word subset
// gets touched, so two genuinely different places sharing one word (say,
// two colonies both named "... Vihar") are never merged into each other.
function cleanAddressLabel(name) {
  if (!name) return name;
  const parts = name.split(',').map((s) => s.trim()).filter(Boolean);
  const wordsOf = (s) => new Set(s.toLowerCase().split(/\s+/).filter(Boolean));
  const isSubset = (a, b) => a.size > 0 && [...a].every((w) => b.has(w));

  const out = [];
  const outWords = [];
  for (const part of parts) {
    const partWords = wordsOf(part);
    let absorbed = false;
    for (let i = 0; i < out.length; i++) {
      if (isSubset(partWords, outWords[i])) { absorbed = true; break; }
      if (isSubset(outWords[i], partWords)) { out[i] = part; outWords[i] = partWords; absorbed = true; break; }
    }
    if (!absorbed) { out.push(part); outWords.push(partWords); }
  }
  return out.join(', ');
}

// The label shown as the report's title. Nominatim's display_name leads
// with whatever named thing the pin landed on -- tapping a building in
// Indiranagar titled the report "Sri Manjunatha Luxury Ladies PG", the
// paying-guest next door, followed by "Bengaluru Central City Corporation,
// Bangalore North, Bengaluru Urban, Karnataka, India". A business, clinic
// or shop is somebody else's name, not the flat's, so it's dropped. A
// named residential building or society ("Prestige Shantiniketan") IS what
// people call their home, so that's kept.
const RESIDENTIAL_NAME = new Set(['building', 'place', 'landuse']);
// building=yes is left out on purpose: it's how most shops, clinics and PGs
// are tagged too, so its name tells us nothing about whose home it is.
const RESIDENTIAL_TYPES = new Set(['residential', 'apartments', 'house', 'neighbourhood', 'suburb', 'quarter']);
function addressLabel(data) {
  const a = data.address || {};
  const isHome = RESIDENTIAL_NAME.has(data.class) && RESIDENTIAL_TYPES.has(data.type);
  const name = isHome && data.name ? data.name : null;
  const street = [a.house_number, a.road].filter(Boolean).join(' ') || null;
  // Both, when there are both: "Subedar Garden" alone means little; with
  // "Indiranagar" after it, anyone in Bengaluru knows where that is.
  const area = [...new Set([a.neighbourhood || a.quarter, a.suburb || a.city_district].filter(Boolean))].join(', ') || null;
  const city = a.city || a.town || a.village || a.state_district || null;
  const parts = [name, street, area, city, a.postcode].filter(Boolean);
  return parts.length >= 2 ? parts.join(', ') : data.display_name;
}

async function viaNominatim(lat, lon) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&zoom=18`,
    {
      headers: { 'User-Agent': 'BlindSpot_NextJS/1.0 (+https://www.blindspot.properties)' },
      signal: AbortSignal.timeout(6000),
      // A day's cache per exact spot: tapping the same tower again (or the
      // map step handing over to the report) shouldn't hit Nominatim twice
      // -- its usage policy is one request a second for the whole site.
      next: { revalidate: 86400 },
    },
  );
  if (!r.ok) throw new Error(`nominatim-${r.status}`);
  const data = await r.json();
  if (!data || data.error) return null;
  const a = data.address || {};
  return {
    postcode: a.postcode || null,
    displayName: cleanAddressLabel(addressLabel(data)) || null,
    locality: a.suburb || a.neighbourhood || a.city_district || a.town || a.village || null,
    city: a.city || a.state_district || a.state || null,
  };
}

async function viaPhoton(lat, lon) {
  const r = await fetch(
    `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&limit=1&lang=en`,
    { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } },
  );
  if (!r.ok) throw new Error(`photon-${r.status}`);
  const data = await r.json();
  const p = data?.features?.[0]?.properties;
  if (!p) return null;
  // Same rule as addressLabel above: a business's name isn't the flat's.
  const homeName = ['building', 'place', 'landuse'].includes(p.osm_key)
    && ['residential', 'apartments', 'house', 'neighbourhood', 'suburb', 'quarter'].includes(p.osm_value) ? p.name : null;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ') || null;
  const name = [homeName, street, p.district || p.locality, p.city, p.postcode]
    .filter(Boolean).join(', ');
  return {
    postcode: p.postcode || null,
    displayName: cleanAddressLabel(name) || null,
    locality: p.district || p.city || null,
    city: p.city || p.state || null,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  if (!lat || !lon) return NextResponse.json({ result: null, reason: 'empty' });

  let reachedSomeone = false;
  let partial = null; // an answer without a postcode: a label, but no area data

  for (const [name, lookup] of [['nominatim', viaNominatim], ['photon', viaPhoton]]) {
    try {
      const hit = await lookup(lat, lon);
      reachedSomeone = true;
      // Only a postcode ends the search -- without one the area half has
      // nothing to look up, so it is worth asking the other provider.
      if (hit?.postcode) return NextResponse.json({ result: hit, source: name });
      if (hit && !partial) partial = hit;
    } catch (e) {
      console.error(`[reverse-geocode] ${name} failed:`, e?.message || e);
    }
  }

  if (partial) return NextResponse.json({ result: partial, reason: 'no-postcode' });
  return NextResponse.json({
    result: null,
    reason: reachedSomeone ? 'not-found' : 'unreachable',
  });
}
