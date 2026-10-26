// lib/trends/climate.js  (server only)
//
// Ten full years of daily climate for one spot, from NASA POWER
// (power.larc.nasa.gov) -- free, no key, and US-government data, so it is
// fine to use in a paid product. Resolution is coarse (about 50 km for
// temperature, rain, humidity and wind; about 100 km for sunshine), which
// the charts say plainly: this is what the region around the flat has
// been like, not a reading taken at the building.
//
// Every number here is the past, aggregated. Nothing is projected.

import { describeChange, extremes } from './series';

const PARAMS = ['T2M_MAX', 'PRECTOTCORR', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// IMD's own threshold for "heavy rain" in a day.
const HEAVY_RAIN_MM = 64.5;
const HOT_DAY_C = 40;

const SOURCE = 'NASA POWER daily climate record';

export function climateYears(now = new Date()) {
  const last = now.getUTCFullYear() - 1; // last complete year
  return { first: last - 9, last };
}

export async function fetchPower(lat, lon, { first, last }, { timeoutMs = 25_000 } = {}) {
  const url = 'https://power.larc.nasa.gov/api/temporal/daily/point'
    + `?parameters=${PARAMS.join(',')}&community=RE`
    + `&latitude=${lat}&longitude=${lon}`
    + `&start=${first}0101&end=${last}1231&format=JSON`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) throw new Error(`power-${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// { YYYYMMDD: value } -> per-year, per-month buckets, fill values dropped.
function bucket(daily, fill) {
  const byYear = new Map();
  for (const [day, v] of Object.entries(daily || {})) {
    if (!Number.isFinite(v) || v === fill || v <= -990) continue;
    const y = day.slice(0, 4), m = Number(day.slice(4, 6)) - 1;
    if (!byYear.has(y)) byYear.set(y, Array.from({ length: 12 }, () => []));
    byYear.get(y)[m]?.push(v);
  }
  return byYear;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
// A year with less than ~90% of its days present would skew any total or
// average built from it, so it's left off the chart instead.
const enoughDays = (months) => months.reduce((n, m) => n + m.length, 0) >= 330;

/**
 * Turn a NASA POWER daily response into the trend series the app shows.
 * Exported separately from the fetch so it can be checked on its own.
 */
export function buildClimateTrends(json, { first, last }) {
  const p = json?.properties?.parameter || {};
  const fill = json?.header?.fill_value ?? -999;
  const years = [];
  for (let y = first; y <= last; y++) years.push(String(y));

  const T = bucket(p.T2M_MAX, fill);
  const R = bucket(p.PRECTOTCORR, fill);
  const H = bucket(p.RH2M, fill);
  const W = bucket(p.WS2M, fill);
  const S = bucket(p.ALLSKY_SFC_SW_DWN, fill);

  const out = {};
  const note = 'Regional climate around this address (about a 50 km grid), not a reading at the building.';

  // ---- Heat: the three hottest months of a typical year here. Fixed
  // Apr-Jun would be wrong for Bangalore (Mar-May) and Chennai (May-Jul).
  const clim = Array.from({ length: 12 }, (_, m) => avg(years.flatMap((y) => T.get(y)?.[m] || [])));
  if (clim.every((v) => v != null)) {
    const hot = clim.map((v, m) => [v, m]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, m]) => m).sort((a, b) => a - b);
    const label = hot.map((m) => MONTHS[m]).join(', ');
    const points = years
      .filter((y) => T.has(y) && hot.every((m) => (T.get(y)[m] || []).length >= 25))
      .map((y) => ({ x: y, v: round(avg(hot.flatMap((m) => T.get(y)[m])), 1) }));
    if (points.length >= 6) {
      out.heat = {
        key: 'heat', label: 'Hot-season afternoons', unit: '°C', decimals: 1,
        caption: `Average daily high in the hottest months here (${label}), by year`,
        points,
        summary: describeChange(points, { unit: '°C', decimals: 1, flat: 0.3, noun: 'Daytime highs in the hot season', up: 'up', down: 'down' }),
        detail: extremes(points, { unit: '°C', decimals: 1, high: 'Hottest', low: 'coolest' }),
        source: SOURCE, note,
      };
    }
    const hotDays = years
      .filter((y) => T.has(y) && enoughDays(T.get(y)))
      .map((y) => ({ x: y, v: T.get(y).flat().filter((v) => v >= HOT_DAY_C).length }));
    // Only worth a chart where 40°C actually happens. Bangalore would be a
    // row of zeros.
    if (hotDays.length >= 6 && hotDays.some((pt) => pt.v >= 3)) {
      out.hotDays = {
        key: 'hotDays', label: 'Days at 40°C or more', unit: 'days', decimals: 0,
        caption: 'Days a year when the daily high reached 40°C',
        points: hotDays,
        summary: describeChange(hotDays, { unit: 'days a year', decimals: 0, flat: 2, noun: 'Days at 40°C or more', up: 'up', down: 'down' }),
        detail: extremes(hotDays, { unit: 'days', decimals: 0, high: 'Most', low: 'fewest' }),
        source: SOURCE, note,
      };
    }
  }

  // ---- Rain: yearly total, and heavy-rain days (IMD threshold).
  const rainYears = years.filter((y) => R.has(y) && enoughDays(R.get(y)));
  if (rainYears.length >= 6) {
    const rain = rainYears.map((y) => ({ x: y, v: Math.round(R.get(y).flat().reduce((a, b) => a + b, 0)) }));
    const first3 = avg(rain.slice(0, 3).map((pt) => pt.v)) || 1;
    out.rain = {
      key: 'rain', label: 'Rainfall', unit: 'mm', decimals: 0,
      caption: 'Total rainfall in the year',
      points: rain,
      // "about the same" inside 5% of the early average, rain varies a lot
      summary: describeChange(rain, { unit: 'mm a year', decimals: 0, flat: first3 * 0.05, noun: 'Rainfall', up: 'up', down: 'down' }),
      detail: extremes(rain, { unit: 'mm', decimals: 0, high: 'Wettest', low: 'driest' }),
      source: SOURCE, note,
    };
    const heavy = rainYears.map((y) => ({ x: y, v: R.get(y).flat().filter((v) => v >= HEAVY_RAIN_MM).length }));
    if (heavy.some((pt) => pt.v > 0)) {
      out.heavyRain = {
        key: 'heavyRain', label: 'Heavy-rain days', unit: 'days', decimals: 0,
        caption: `Days a year with ${HEAVY_RAIN_MM} mm of rain or more (IMD's "heavy rain")`,
        points: heavy,
        summary: describeChange(heavy, { unit: 'days a year', decimals: 0, flat: 1, noun: 'Heavy-rain days', up: 'up', down: 'down' }),
        detail: extremes(heavy, { unit: 'days', decimals: 0, high: 'Most', low: 'fewest' }),
        source: SOURCE,
        note: `${note} Grid averages smooth out local cloudbursts, so the real count at street level is usually higher.`,
      };
    }
  }

  // ---- Monsoon humidity (Jun-Sep), what drives damp walls.
  const humid = years
    .filter((y) => H.has(y) && [5, 6, 7, 8].every((m) => (H.get(y)[m] || []).length >= 25))
    .map((y) => ({ x: y, v: round(avg([5, 6, 7, 8].flatMap((m) => H.get(y)[m])), 0) }));
  if (humid.length >= 6) {
    out.humidity = {
      key: 'humidity', label: 'Monsoon humidity', unit: '%', decimals: 0,
      caption: 'Average relative humidity, June to September',
      points: humid,
      summary: describeChange(humid, { unit: '%', decimals: 0, flat: 1.5, noun: 'Monsoon humidity', up: 'up', down: 'down' }),
      detail: extremes(humid, { unit: '%', decimals: 0, high: 'Most humid', low: 'least' }),
      source: SOURCE, note,
    };
  }

  // ---- Sunshine reaching the ground (cloud and haze cut it).
  const sun = years
    .filter((y) => S.has(y) && enoughDays(S.get(y)))
    .map((y) => ({ x: y, v: round(avg(S.get(y).flat()), 2) }));
  if (sun.length >= 6) {
    out.sunshine = {
      key: 'sunshine', label: 'Sunshine', unit: 'kWh/m² a day', decimals: 2,
      caption: 'Average sunlight reaching the ground per day (after cloud and haze)',
      points: sun,
      summary: describeChange(sun, { unit: 'kWh/m² a day', decimals: 2, flat: 0.08, noun: 'Daily sunshine', up: 'up', down: 'down' }),
      detail: extremes(sun, { unit: 'kWh/m²', decimals: 2, high: 'Sunniest', low: 'dullest' }),
      source: SOURCE,
      note: 'Regional figure (about a 100 km grid). Your own floor and the buildings around it decide how much of it reaches the flat.',
    };
  }

  // ---- Wind near the ground.
  const wind = years
    .filter((y) => W.has(y) && enoughDays(W.get(y)))
    .map((y) => ({ x: y, v: round(avg(W.get(y).flat()), 1) }));
  if (wind.length >= 6) {
    out.wind = {
      key: 'wind', label: 'Breeze', unit: 'm/s', decimals: 1,
      caption: 'Average wind speed 2 m above ground',
      points: wind,
      summary: describeChange(wind, { unit: 'm/s', decimals: 1, flat: 0.15, noun: 'Wind speed', up: 'up', down: 'down' }),
      detail: extremes(wind, { unit: 'm/s', decimals: 1, high: 'Breeziest', low: 'stillest' }),
      source: SOURCE, note,
    };
  }

  return out;
}
