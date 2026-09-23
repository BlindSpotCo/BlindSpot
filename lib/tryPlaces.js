// lib/tryPlaces.js
// The one-tap example chips under the hero search, per covered city.
//
// Picked by the visitor's own city (see app/api/geo/route.js + the hero's
// effect) so someone in Bangalore sees Bangalore societies they might
// actually be shortlisting, not a Delhi neighbourhood. Anyone we can't
// place falls back to DEFAULT_TRY_PLACES -- one per city, same as before.
//
// Each entry is exactly the shape pick() in HeroLiveMapCanvas expects.
// Buildings carry a `q` too: tapping one re-resolves that query through
// geocode-suggest first (it lands on the real footprint), and only falls
// back to the lat/lon here if the geocoder is slow or finds nothing -- so
// a chip is never a dead click. Neighbourhood chips don't re-resolve; a
// plain area query often lands on a random street (see the note in
// HeroLiveMapCanvas), so their centroid here is the answer.
//
// Building coordinates are approximate (to the complex, not the tower) --
// the map step right after asks the user to tap their actual building.

export const CITY_CENTRES = {
  Bangalore: { lat: 12.9716, lon: 77.5946, label: 'Bengaluru' },
  Mumbai: { lat: 19.076, lon: 72.8777, label: 'Mumbai' },
  'Delhi NCR': { lat: 28.6139, lon: 77.209, label: 'Delhi NCR' },
  Hyderabad: { lat: 17.385, lon: 78.4867, label: 'Hyderabad' },
  Chennai: { lat: 13.0827, lon: 80.2707, label: 'Chennai' },
  Chandigarh: { lat: 30.7333, lon: 76.7794, label: 'Chandigarh' },
};

const b = (label, q, lat, lon, displayName, postcode = null) => ({ label, q, lat, lon, displayName, postcode, kind: 'address' });
const n = (label, lat, lon, displayName, postcode = null) => ({ label, lat, lon, displayName, postcode, kind: 'neighbourhood' });

export const TRY_PLACES_BY_CITY = {
  Bangalore: [
    b('Prestige Park Grove', null, 13.0157282, 77.7539999, 'Prestige Park Grove (u/c), Doddabanahalli, Karnataka'),
    b('Prestige Shantiniketan', 'Prestige Shantiniketan, Whitefield, Bengaluru', 12.9897, 77.7286, 'Prestige Shantiniketan, Whitefield, Bengaluru', '560048'),
    b('Sobha Dream Acres', 'Sobha Dream Acres, Panathur, Bengaluru', 12.9371, 77.705, 'Sobha Dream Acres, Panathur, Bengaluru', '560087'),
    n('Whitefield', 12.9698, 77.75, 'Whitefield, Bengaluru, Karnataka', '560066'),
    n('Koramangala', 12.9352, 77.6245, 'Koramangala, Bengaluru, Karnataka', '560034'),
  ],
  Mumbai: [
    b('Hiranandani Gardens', 'Hiranandani Gardens, Powai, Mumbai', 19.1172, 72.9077, 'Hiranandani Gardens, Powai, Mumbai', '400076'),
    b('Lodha The Park', 'Lodha The Park, Worli, Mumbai', 18.9985, 72.823, 'Lodha The Park, Worli, Mumbai', '400013'),
    b('Oberoi Splendor', 'Oberoi Splendor, Andheri East, Mumbai', 19.1296, 72.874, 'Oberoi Splendor, Andheri East, Mumbai', '400060'),
    n('Bandra West', 19.0583358, 72.8302669, 'Bandra West, Mumbai, Maharashtra'),
  ],
  'Delhi NCR': [
    b('DLF The Crest', 'DLF The Crest, Sector 54, Gurugram', 28.4425, 77.101, 'DLF The Crest, Sector 54, Gurugram', '122011'),
    b('DLF The Camellias', 'DLF The Camellias, Sector 42, Gurugram', 28.4575, 77.099, 'DLF The Camellias, Sector 42, Gurugram', '122002'),
    n('Hauz Khas', 28.5536023, 77.1948144, 'Hauz Khas, South Delhi, Delhi', '110016'),
    n('Vasant Kunj', 28.5293, 77.1543, 'Vasant Kunj, South West Delhi, Delhi', '110070'),
  ],
  Hyderabad: [
    b('My Home Avatar', 'My Home Avatar, Narsingi, Hyderabad', 17.389, 78.353, 'My Home Avatar, Narsingi, Hyderabad', '500075'),
    b('Aparna Sarovar', 'Aparna Sarovar, Nallagandla, Hyderabad', 17.47, 78.308, 'Aparna Sarovar, Nallagandla, Hyderabad', '500019'),
    n('Gachibowli', 17.4401, 78.3489, 'Gachibowli, Hyderabad, Telangana', '500032'),
    n('Jubilee Hills', 17.4326, 78.4071, 'Jubilee Hills, Hyderabad, Telangana', '500033'),
  ],
  Chennai: [
    b('Prestige Bella Vista', 'Prestige Bella Vista, Iyyappanthangal, Chennai', 13.0379, 80.1395, 'Prestige Bella Vista, Iyyappanthangal, Chennai', '600056'),
    n('Adyar', 13.0012, 80.2565, 'Adyar, Chennai, Tamil Nadu', '600020'),
    n('Anna Nagar', 13.085, 80.2101, 'Anna Nagar, Chennai, Tamil Nadu', '600040'),
  ],
  Chandigarh: [
    n('Sector 7', 30.7358664, 76.8042826, 'Sector 7, Chandigarh', '160007'),
    n('Sector 17', 30.7398, 76.7827, 'Sector 17, Chandigarh', '160017'),
    n('Sector 35', 30.7228, 76.7597, 'Sector 35, Chandigarh', '160022'),
  ],
};

// Nobody located: one per city, a real building first.
export const DEFAULT_TRY_PLACES = [
  TRY_PLACES_BY_CITY.Bangalore[0],
  TRY_PLACES_BY_CITY['Delhi NCR'][2],
  TRY_PLACES_BY_CITY.Chandigarh[0],
  TRY_PLACES_BY_CITY.Mumbai[3],
];

function km(a, b2) {
  const R = 6371;
  const dLat = ((b2.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b2.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest covered city to a point, or null if it's not within reach of
// any of them (a visitor in Pune shouldn't be told they're in Mumbai).
export function nearestCoveredCity(lat, lon, maxKm = 80) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null;
  for (const [city, c] of Object.entries(CITY_CENTRES)) {
    const d = km({ lat, lon }, c);
    if (d <= maxKm && (!best || d < best.d)) best = { city, d };
  }
  return best ? best.city : null;
}
