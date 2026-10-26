// lib/trends/series.js
//
// Pure helpers shared by the trends API (server) and the trend charts
// (client). No fetching here.
//
// The rule for every sentence this file writes: describe what the record
// shows, never what it will do. No "will", no "expected", no forecast line.

export const fmt = (v, decimals = 0) =>
  v == null || !Number.isFinite(v)
    ? '-'
    : v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const mean = (arr) => {
  const xs = arr.filter((v) => Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

// "2016-18" style span label for a run of year points.
const spanLabel = (pts) => {
  if (!pts.length) return '';
  const a = pts[0].x, b = pts[pts.length - 1].x;
  return a === b ? a : `${a}–${String(b).slice(-2)}`;
};

/**
 * Compare the first three points with the last three, in words.
 * @param {{x:string,v:number}[]} points
 * @param {{unit:string, decimals:number, flat:number, noun:string, up:string, down:string}} o
 *   flat: a change smaller than this reads as "about the same"
 */
export function describeChange(points, o) {
  const pts = points.filter((p) => Number.isFinite(p.v));
  if (pts.length < 6) return null;
  const head = pts.slice(0, 3), tail = pts.slice(-3);
  const a = mean(head.map((p) => p.v)), b = mean(tail.map((p) => p.v));
  const u = o.unit ? (o.unit.startsWith('%') || o.unit.startsWith('°') ? o.unit : ` ${o.unit}`) : '';
  const now = `${fmt(b, o.decimals)}${u}`, then = `${fmt(a, o.decimals)}${u}`;
  const d = b - a;
  if (Math.abs(d) < o.flat) {
    return `${o.noun} averaged ${now} over ${spanLabel(tail)}, about the same as ${spanLabel(head)} (${then}).`;
  }
  return `${o.noun} averaged ${now} over ${spanLabel(tail)}, ${d > 0 ? o.up : o.down} from ${then} over ${spanLabel(head)}.`;
}

// Highest and lowest point, for a second line under the chart.
export function extremes(points, { unit = '', decimals = 0, high = 'Highest', low = 'lowest' } = {}) {
  const pts = points.filter((p) => Number.isFinite(p.v));
  if (pts.length < 3) return null;
  let hi = pts[0], lo = pts[0];
  for (const p of pts) { if (p.v > hi.v) hi = p; if (p.v < lo.v) lo = p; }
  if (hi.v === lo.v) return null;
  const u = unit ? (unit.startsWith('%') || unit.startsWith('°') ? unit : ` ${unit}`) : '';
  return `${high}: ${hi.x} (${fmt(hi.v, decimals)}${u}); ${low}: ${lo.x} (${fmt(lo.v, decimals)}${u}).`;
}

// Which trend backs which weight score on the report screen.
export const TREND_FOR_FACTOR = { air: 'pm25', water: 'rain', sewerage: 'heavyRain' };
export const TREND_FOR_SUBSCORE = { sun: 'sunshine', shadeHeat: 'heat', dampness: 'humidity', wind: 'wind' };

// Order they appear in the report's "Past trends" section.
export const TREND_ORDER = ['heat', 'hotDays', 'rain', 'heavyRain', 'humidity', 'sunshine', 'wind', 'pm25'];
