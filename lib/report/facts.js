// lib/report/facts.js
//
// One plain sentence per report row, for that exact location, shared by the
// phone and laptop report: area rows from the pincode's own records (the
// same raw fields the detailed area report shows), flat rows from the sun
// model and the flat's own sub-score inputs. Facts only, no verdicts.

export const hrs = (h) => (typeof h === 'number' && Number.isFinite(h) ? `${Math.round(h * 10) / 10} h` : null);
export const none = (h) => typeof h === 'number' && h < 0.05;

export function sunStats(sunYear) {
  if (!Array.isArray(sunYear) || sunYear.length < 12) return null;
  const by = Object.fromEntries(sunYear.map((m) => [m.month, m]));
  const avg = sunYear.reduce((s, m) => s + (m.hours || 0), 0) / sunYear.length;
  const summer = ['April', 'May', 'June'].map((m) => by[m]?.hours || 0).reduce((a, b) => a + b, 0) / 3;
  const sorted = [...sunYear].sort((a, b) => b.hours - a.hours);
  return { by, avg, summer, best: sorted[0]?.month, worst: sorted[sorted.length - 1]?.month };
}

const num1 = (n) => (Math.round(n * 10) / 10).toString();

// One plain sentence per area item, from this pincode's own records.
// Facts only: counts, hours, percentages, official bands. Falls back to
// what the item covers when the record has no number for it.
export function areaFact(key, raw, facts) {
  const r = raw || {};
  switch (key) {
    case 'schools': {
      if (typeof facts?.count !== 'number') return null;
      const b = Object.entries(facts.boards || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ');
      return `${facts.count} schools listed in this pincode${b ? ` (${b})` : ''}.`;
    }
    case 'air':
      return typeof r.aqiAvg === 'number'
        ? `Average AQI around ${Math.round(r.aqiAvg)}${r.aqiCategory ? `, in the CPCB “${r.aqiCategory}” band` : ''}.`
        : null;
    case 'water': {
      if (typeof r.supplyHours !== 'number') return null;
      const h = r.supplyHours < 1 ? 'under 1 hour' : `about ${num1(r.supplyHours)} hours`;
      return `Piped water supply ${h} a day${typeof r.waterCoverage === 'number' ? `, ${r.waterCoverage}% of homes on piped supply` : ''}.`;
    }
    case 'power':
      return typeof r.outageHoursMonth === 'number'
        ? `Power cuts add up to about ${num1(r.outageHoursMonth)} hours a month${r.discom ? ` (${r.discom})` : ''}.`
        : null;
    case 'roads':
      return typeof r.potholesPerKm === 'number' ? `About ${num1(r.potholesPerKm)} potholes per km on roads here.` : null;
    case 'infrastructure': {
      if (typeof r.metroNearby !== 'number') return null;
      const metro = r.metroNearby === 0
        ? `No operating metro station nearby${r.metroPlanned ? `, ${r.metroPlanned} planned` : ''}`
        : `${r.metroNearby} metro station${r.metroNearby === 1 ? '' : 's'} nearby`;
      return r.highway ? `Highway access ${String(r.highway).toLowerCase()}; ${metro[0].toLowerCase()}${metro.slice(1)}.` : `${metro}.`;
    }
    case 'sewerage':
      return typeof r.sewerCoverage === 'number'
        ? `${r.sewerCoverage}% of homes on the sewer network${typeof r.floodsPerYear === 'number' ? `; about ${r.floodsPerYear} flooding incidents recorded a year` : ''}.`
        : null;
    case 'crime':
      return typeof r.crimes === 'number'
        ? `About ${r.crimes} recorded crimes a year for this police area${r.crimesModelled ? ' (estimated)' : ''}.`
        : null;
    default:
      return null;
  }
}

// One plain sentence per flat item, from our sun model and the flat's own
// sub-score inputs (floor, today's wind, mapped roads, monsoon rain).
const floorBand = (f) => (f <= 1 ? 0 : f <= 4 ? 1 : f <= 9 ? 2 : f <= 15 ? 3 : 4);
const VIEW_AT = [
  'Ground floor: mostly the compound wall or next building in view',
  'Low floor: a partly open view',
  'Mid floor: usually clears nearby rooftops',
  'High floor: open sky in most directions',
  'Very high floor: close to an unobstructed view',
];
const PRIVACY_AT = [
  'Ground floor: in view of the street',
  'Low floor: within sightline of nearby buildings',
  'Mid floor: above most street-level sightlines',
  'High floor: few buildings tall enough to look in',
  'Very high floor: very few buildings can look in',
];
export function flatFact(key, sub, { sun, floor, facing }) {
  const basis = sub?.basis || '';
  switch (key) {
    case 'sun': return sun ? `About ${hrs(sun.avg)} of direct sun a day, averaged over the year.` : null;
    case 'shadeHeat': return sun ? `About ${hrs(sun.summer)} of direct sun a day from April to June.` : null;
    case 'view': return sub?.source === 'buildings' && sub.fact ? sub.fact : `${VIEW_AT[floorBand(floor)]}, in our estimate.`;
    case 'privacy': return sub?.source === 'buildings' && sub.fact ? sub.fact : `${PRIVACY_AT[floorBand(floor)]}, in our estimate.`;
    case 'wind': {
      const m = basis.match(/avgWindSpeed=([\d.]+)km\/h/);
      return m ? `Wind around ${Math.round(Number(m[1]))} km/h today at this spot.` : null;
    }
    case 'dampness': {
      const mm = basis.match(/cityMonsoonRainfall=(\d+)mm/);
      const se = basis.match(/season=([A-Za-z]+-[A-Za-z]+)/);
      const MONTHS_FULL = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
      const span = se ? se[1].split('-').map((x) => MONTHS_FULL[x] || x).join(' to ') : null;
      return mm ? `About ${mm[1]} mm of monsoon rain here${span ? `, ${span}` : ''}.` : null;
    }
    case 'noise': {
      const m = basis.match(/nearestSource=([a-z_ ]+)@(\d+)m/);
      if (m) return `Nearest major ${m[1] === 'rail' ? 'rail line' : `${m[1]} road`} about ${m[2]} m away.`;
      const none_ = (sub?.summary || '').match(/within (\d+)m/);
      return none_ ? `No major road or rail line mapped within ${none_[1]} m.` : null;
    }
    default: return null;
  }
}

// The tag shown next to a row has to agree with the fact printed under it.
// Roads print potholes per km, so their tag uses the area report's own
// pothole bands (under 2 good, over 5 poor) instead of the blended score.
export function tagScore(key, score, raw) {
  if (key === 'roads' && typeof raw?.potholesPerKm === 'number') {
    return raw.potholesPerKm < 2 ? 70 : raw.potholesPerKm <= 5 ? 50 : 30;
  }
  return score;
}
