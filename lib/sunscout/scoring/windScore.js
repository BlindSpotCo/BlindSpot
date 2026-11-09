// lib/sunscout/scoring/windScore.js
// Ported from SunScout's lib/scoring/windScore.ts.
//
// Wind comes from NASA POWER's climatology (power.larc.nasa.gov): the
// 25-year average wind speed 10 m above ground, per month and for the
// year, at this location. Free, no key, US-government data, so it's fine
// in a paid product (credit: "NASA POWER"). It replaced Open-Meteo's live
// forecast, whose free API is non-commercial -- and a year-round average
// is the better input anyway: a buyer lives with the typical breeze, not
// the one blowing on the day they ran the report.
//
// Resolution is coarse (about 50 km), so this describes the area's wind,
// not airflow at the building; the floor-based openness term below is
// what makes it flat-specific.
import { clamp } from './types';
import { floorViewPrior } from './floorPriors';
import '../networkFix';

const FETCH_TIMEOUT_MS = 6000;
// Same 10 m reference height Open-Meteo's windspeed_10m used, so the
// ceiling carries over unchanged.
const COMFORT_CEILING_KMH = 20;
const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_TO_KMH = 3.6;

/**
 * Turn a NASA POWER climatology response into the wind reading the score
 * uses. Exported separately from the fetch so it can be checked on its own.
 * Returns null when the annual figure is missing or a fill value.
 */
export function parsePowerWind(json) {
  const ws = json?.properties?.parameter?.WS10M;
  const fill = json?.header?.fill_value ?? -999;
  const ok = (v) => Number.isFinite(v) && v !== fill && v > -990;
  if (!ws || !ok(ws.ANN)) return null;

  const monthly = MONTH_KEYS.map((k, i) => ({ month: MONTH_NAMES[i], kmh: ok(ws[k]) ? ws[k] * MS_TO_KMH : null }))
    .filter((m) => m.kmh != null);
  const sorted = [...monthly].sort((a, b) => b.kmh - a.kmh);

  return {
    avgSpeedKmh: ws.ANN * MS_TO_KMH,
    breeziest: sorted[0] || null,
    calmest: sorted.at(-1) || null,
    monthly,
    source: 'NASA POWER',
  };
}

export async function fetchWindReading(lat, lon) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
      + `?parameters=WS10M&community=RE&latitude=${lat}&longitude=${lon}&format=JSON`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BlindSpot/1.0 (+https://blindspot.properties; property intelligence platform)' },
      // A 25-year average doesn't move; cache it for a month.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[windScore] NASA POWER returned HTTP ${res.status} for (${lat},${lon})`);
      return null;
    }
    return parsePowerWind(await res.json());
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export function computeWindScore(wind, floor) {
  if (!wind) {
    return {
      key: 'wind',
      // Was "Wind & Ventilation" -- same "sounds like two things" issue
      // as Shade & Heat. Wind is the input signal, ventilation is what's
      // actually being scored, so name it after the output.
      label: 'Ventilation',
      score: 50,
      summary: 'Wind data unavailable for this location, showing a neutral score.',
      basis: 'NASA POWER request failed or timed out.',
    };
  }

  const windComponent = clamp((wind.avgSpeedKmh / COMFORT_CEILING_KMH) * 100);
  const openComponent = floorViewPrior(floor);

  const score = Math.round(clamp(openComponent * 0.6 + windComponent * 0.4));

  const avg = wind.avgSpeedKmh.toFixed(1);
  const range = wind.breeziest && wind.calmest && wind.breeziest.month !== wind.calmest.month
    ? ` Breeziest in ${wind.breeziest.month} (${wind.breeziest.kmh.toFixed(1)} km/h), calmest in ${wind.calmest.month} (${wind.calmest.kmh.toFixed(1)} km/h).`
    : '';

  const summary =
    score >= 70
      ? `Good ventilation potential, floor level supports airflow and the area's wind is steady (year-round avg ${avg} km/h).`
      : score >= 40
      ? `Moderate ventilation potential (year-round avg ${avg} km/h, floor ${floor}).`
      : `Limited ventilation potential, lower floor and/or light wind in this area (year-round avg ${avg} km/h).`;

  return {
    key: 'wind',
    label: 'Ventilation',
    score,
    summary: summary + range + ' (Long-term area wind average from NASA POWER + floor-based openness estimate.)',
    basis: `avgWindSpeed=${avg}km/h (NASA POWER long-term climatology, 10 m), floorOpenness=${openComponent} (deterministic cutoff, floor=${floor})`,
  };
}
