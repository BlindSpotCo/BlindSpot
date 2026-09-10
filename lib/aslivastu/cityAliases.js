// lib/aslivastu/cityAliases.js
// The hero search box's geocoder speaks free-text place names ("Bengaluru",
// "Gurugram", "New Delhi") -- BlindSpot's own scored dataset
// (data/aslivastu/nqi_scores.json) groups everything under 5 fixed city
// keys ("Bangalore", "Delhi NCR", ...), because Delhi NCR alone is a dozen
// different satellite-town names for one metro region. This is the one
// place that reconciles the two, so nothing else has to re-guess it.
const COVERED_CITY_ALIASES = {
  'Bangalore': ['bangalore', 'bengaluru'],
  'Chandigarh': ['chandigarh'],
  'Delhi NCR': [
    'delhi', 'new delhi', 'ncr', 'national capital region', 'delhi ncr',
    'gurugram', 'gurgaon', 'noida', 'greater noida', 'ghaziabad',
    'faridabad', 'sonipat', 'panipat', 'rohtak', 'bahadurgarh',
    'yamuna nagar', 'fatehabad', 'sirsa',
  ],
  'Hyderabad': ['hyderabad', 'secunderabad', 'cyberabad'],
  'Mumbai': ['mumbai', 'bombay', 'navi mumbai', 'thane'],
};

// Ordered longest-alias-first within each entry so "national capital
// region" wins over a shorter accidental substring match before "ncr"
// gets a chance to.
const ENTRIES = Object.entries(COVERED_CITY_ALIASES).map(([city, aliases]) => [
  city,
  [...aliases].sort((a, b) => b.length - a.length),
]);

// Matches a free-text place name against the 5 covered cities. Returns
// the canonical city key nqi_scores.json uses, or null when it's
// genuinely somewhere BlindSpot doesn't have neighbourhood data for yet
// (Chennai, Pune, Kolkata, ...) -- a real, expected outcome, not an
// error, since the search box now surfaces city-level results everywhere
// in India, not just the 5 covered metros.
export function resolveCoveredCity(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  for (const [city, aliases] of ENTRIES) {
    if (aliases.some((a) => n === a || n.includes(a))) return city;
  }
  return null;
}

export const COVERED_CITIES = Object.keys(COVERED_CITY_ALIASES);
