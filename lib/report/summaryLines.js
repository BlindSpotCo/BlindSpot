// lib/report/summaryLines.js
//
// The two plain lines at the top of the report, shared by the phone and
// laptop layouts so both always say the same thing:
//   sun  -- direct sun on this side in December and June, from the sun model
//   area -- only what the area holds strong in; nothing is called out as weak
//
// Wording rule: no verdicts about the property, only what our data or model
// shows, attributed as such.

const AREA_ORDER = ['crime', 'schools', 'air', 'water', 'power', 'roads', 'infrastructure', 'sewerage'];
const FULL = {
  crime: 'safety', schools: 'schools', air: 'air quality', water: 'water supply',
  power: 'power supply', roads: 'roads', infrastructure: 'transport links', sewerage: 'drainage',
};

const none = (h) => typeof h === 'number' && h < 0.05;
const hoursWords = (h) => {
  const n = Math.round(h);
  return n === 1 ? 'about 1 hour' : `about ${n} hours`;
};
const joinAnd = (xs) => (xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// Higher than at least 60% of the city's pincodes we cover.
export function rankBand(rank) {
  if (!rank || !rank.total) return null;
  if (rank.higher / rank.total >= 0.6) return 'low';
  if (rank.lower / rank.total >= 0.6) return 'high';
  return 'mid';
}

// sunYear: [{ month: 'January', hours, ... }] from the unit score.
export function sunLine(sunYear) {
  if (!Array.isArray(sunYear) || sunYear.length < 12) return null;
  const by = Object.fromEntries(sunYear.map((m) => [m.month, m.hours]));
  const dec = by.December;
  const jun = by.June;
  if (typeof dec !== 'number' || typeof jun !== 'number') return null;
  if (none(dec) && none(jun)) return 'Little or no direct sun on this side in December or June, in our sun model.';
  const first = none(dec) ? 'No direct sun' : `${hoursWords(dec)[0].toUpperCase()}${hoursWords(dec).slice(1)} of direct sun a day`;
  return `${first} in December, and ${none(jun) ? 'none' : hoursWords(jun)} in June.`;
}

// Area items that score 75+ on our scale and higher than most of the city.
export function strongAreaKeys(area) {
  if (!area?.factors) return [];
  return AREA_ORDER.filter((k) => {
    const s = area.factors[k];
    return typeof s === 'number' && s >= 75 && rankBand(area.cityRank?.[k]) === 'high';
  });
}

// `fallback` is what to say when nothing stands out (it differs by layout:
// the phone lists every item right below, the laptop shows them alongside).
export function areaLine(area, fallback) {
  if (!area) return null;
  const strong = strongAreaKeys(area).map((k) => FULL[k]).slice(0, 3);
  if (strong.length) return `This area holds strong in ${joinAnd(strong)}, in our data.`;
  const n = AREA_ORDER.filter((k) => typeof area.factors?.[k] === 'number').length;
  return fallback || `We looked at ${n} things for pin ${area.pinCode} from public data.`;
}
