// lib/sunscout/scoring/scoreAggregator.js
// Ported from SunScout's lib/scoring/scoreAggregator.ts. This is the
// "Home Comfort Score" / LiveScore composite -- per-flat, floor+facing
// specific.

import { computeSolarSummary } from '../solarReport';
import { computeSunScore } from './sunScore';
import { computeShadeHeatScore } from './shadeHeatScore';
import { computeViewScore } from './viewScore';
import { computePrivacyScore } from './privacyScore';
import { computeWindScore, fetchWindReading } from './windScore';
import { DEFAULT_WEIGHTS, scoreToGrade, clamp } from './types';

function normalizeWeights(w) {
  const merged = { ...DEFAULT_WEIGHTS, ...w };
  const total = merged.sun + merged.shadeHeat + merged.view + merged.privacy + merged.wind;
  if (total <= 0) return DEFAULT_WEIGHTS;
  return {
    sun: merged.sun / total,
    shadeHeat: merged.shadeHeat / total,
    view: merged.view / total,
    privacy: merged.privacy / total,
    wind: merged.wind / total,
  };
}

export async function computeLiveScore(input) {
  const { lat, lon, floor, facing, tzOffsetMinutes } = input;
  const weights = normalizeWeights(input.weights);

  const [solarSummary, windReading] = await Promise.all([
    computeSolarSummary(lat, lon, floor, facing, tzOffsetMinutes),
    fetchWindReading(lat, lon),
  ]);

  const sunScore = computeSunScore(solarSummary);
  const shadeHeatScore = computeShadeHeatScore(solarSummary, facing);
  const viewScore = computeViewScore(floor, facing);
  const privacyScore = computePrivacyScore(floor, facing);
  const windScore = computeWindScore(windReading, floor);

  const subScores = [sunScore, shadeHeatScore, viewScore, privacyScore, windScore];

  const weighted =
    sunScore.score * weights.sun +
    shadeHeatScore.score * weights.shadeHeat +
    viewScore.score * weights.view +
    privacyScore.score * weights.privacy +
    windScore.score * weights.wind;
  const liveScore = Math.round(clamp(weighted));

  const dataNotes = [
    'View and Privacy are deterministic floor-based estimates, not live building lookups.',
  ];
  if (!windReading) {
    dataNotes.push('Live wind data unavailable — Wind score fell back to a neutral baseline.');
  } else {
    dataNotes.push('Wind score reflects current-day forecast conditions, not a year-round average.');
  }

  return {
    liveScore,
    grade: scoreToGrade(liveScore),
    subScores,
    weights,
    unit: { floor, facing },
    dataNotes,
    generatedAt: new Date().toISOString(),
  };
}
