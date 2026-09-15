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
import { computeDampnessScore } from './dampnessScore';
import { fetchNearbyNoiseSources, computeNoiseScore } from './noiseScore';
import { DEFAULT_WEIGHTS, scoreToGrade, clamp } from './types';
import { estimateAcCost } from './thermalCostEstimate';
import { tariffFor, monsoonRainfallFor } from '@/lib/aslivastu/cityMeta';

function normalizeWeights(w) {
  const merged = { ...DEFAULT_WEIGHTS, ...w };
  const total = merged.sun + merged.shadeHeat + merged.view + merged.privacy + merged.wind + merged.dampness + merged.noise;
  if (total <= 0) return DEFAULT_WEIGHTS;
  return {
    sun: merged.sun / total,
    shadeHeat: merged.shadeHeat / total,
    view: merged.view / total,
    privacy: merged.privacy / total,
    wind: merged.wind / total,
    dampness: merged.dampness / total,
    noise: merged.noise / total,
  };
}

export async function computeLiveScore(input) {
  // `city` is optional -- callers that don't know it (the pincode-less
  // fallback path, e.g. /api/sunscout/score with no AsliVastu coverage)
  // just get tariffFor(undefined)'s neutral GENERIC rate instead of a
  // wrong city's tariff.
  const { lat, lon, floor, facing, tzOffsetMinutes, city } = input;
  const weights = normalizeWeights(input.weights);

  const [solarSummary, windReading, noiseData] = await Promise.all([
    computeSolarSummary(lat, lon, floor, facing, tzOffsetMinutes),
    fetchWindReading(lat, lon),
    fetchNearbyNoiseSources(lat, lon),
  ]);

  const sunScore = computeSunScore(solarSummary);
  const shadeHeatScore = computeShadeHeatScore(solarSummary, facing);
  // A satellite stat, not a sixth sub-score -- see thermalCostEstimate.js
  // for why a ₹ figure doesn't belong in the weighted 0-100 average.
  const thermalCost = estimateAcCost({
    heatLoad: shadeHeatScore.heatLoad,
    tariffPerKwh: tariffFor(city).perKwh,
  });
  const viewScore = computeViewScore(floor, facing);
  const privacyScore = computePrivacyScore(floor, facing);
  const windScore = computeWindScore(windReading, floor);
  const dampnessScore = computeDampnessScore(solarSummary, facing, monsoonRainfallFor(city).mm);
  const noiseScore = computeNoiseScore(noiseData, floor, facing);

  const subScores = [sunScore, shadeHeatScore, viewScore, privacyScore, windScore, dampnessScore, noiseScore];

  const weighted =
    sunScore.score * weights.sun +
    shadeHeatScore.score * weights.shadeHeat +
    viewScore.score * weights.view +
    privacyScore.score * weights.privacy +
    windScore.score * weights.wind +
    dampnessScore.score * weights.dampness +
    noiseScore.score * weights.noise;
  const liveScore = Math.round(clamp(weighted));

  const dataNotes = [
    'View and Privacy are deterministic floor-based estimates, not live building lookups.',
  ];
  if (!windReading) {
    dataNotes.push('Live wind data unavailable, Wind score fell back to a neutral baseline.');
  } else {
    dataNotes.push('Wind score reflects current-day forecast conditions, not a year-round average.');
  }

  return {
    liveScore,
    grade: scoreToGrade(liveScore),
    subScores,
    thermalCost,
    weights,
    unit: { floor, facing },
    dataNotes,
    generatedAt: new Date().toISOString(),
  };
}
