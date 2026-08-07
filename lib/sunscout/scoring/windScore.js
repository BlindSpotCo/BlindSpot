// lib/sunscout/scoring/windScore.js
// Ported from SunScout's lib/scoring/windScore.ts.
import { clamp } from './types';
import { floorViewPrior } from './floorPriors';
import '../networkFix';

const FETCH_TIMEOUT_MS = 6000;
const COMFORT_CEILING_KMH = 20;

export async function fetchWindReading(lat, lon) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=windspeed_10m&forecast_days=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BlindSpot/1.0 (+https://blindspotco.net; property intelligence platform)' },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[windScore] Open-Meteo returned HTTP ${res.status} for (${lat},${lon})`);
      return null;
    }

    const d = await res.json();
    const hourly = d?.hourly?.windspeed_10m || [];
    const current = d?.current_weather?.windspeed ?? (hourly.length ? hourly[0] : 0);
    if (!hourly.length && !current) return null;

    const avg = hourly.length ? hourly.reduce((s, v) => s + v, 0) / hourly.length : current;
    return { avgSpeedKmh: avg, currentSpeedKmh: current };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export function computeWindScore(wind, floor) {
  if (!wind) {
    return {
      key: 'wind',
      label: 'Wind & Ventilation',
      score: 50,
      summary: 'Live wind data unavailable for this location — showing a neutral score.',
      basis: 'Open-Meteo request failed or timed out.',
    };
  }

  const windComponent = clamp((wind.avgSpeedKmh / COMFORT_CEILING_KMH) * 100);
  const openComponent = floorViewPrior(floor);

  const score = Math.round(clamp(openComponent * 0.6 + windComponent * 0.4));

  const summary =
    score >= 70
      ? `Good ventilation potential — floor level supports airflow and wind is steady (avg ${wind.avgSpeedKmh.toFixed(1)} km/h today).`
      : score >= 40
      ? `Moderate ventilation potential (avg ${wind.avgSpeedKmh.toFixed(1)} km/h today, floor ${floor}).`
      : `Limited ventilation potential — lower floor and/or light wind (avg ${wind.avgSpeedKmh.toFixed(1)} km/h today).`;

  return {
    key: 'wind',
    label: 'Wind & Ventilation',
    score,
    summary: summary + ' (Live forecast + floor-based openness estimate, not a year-round average.)',
    basis: `avgWindSpeed=${wind.avgSpeedKmh.toFixed(1)}km/h (live), floorOpenness=${openComponent} (deterministic cutoff, floor=${floor})`,
  };
}
