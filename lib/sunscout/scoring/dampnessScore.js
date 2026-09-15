// lib/sunscout/scoring/dampnessScore.js
// Dampness / orientation risk -- a real 6th sub-score (unlike
// thermalCostEstimate.js's satellite ₹ stat), estimating monsoon-season
// seepage/mould risk from three real, sourced signals:
//
//  1. Facing -> wind-driven rain exposure. India's SW monsoon (Jun-Sep)
//     is a well-documented wind pattern: South/South-West-facing walls
//     take direct wind-driven rain, North/North-East walls are largely
//     sheltered by the building's own mass. Same category of fact as
//     shadeHeatScore.js's FACING_HEAT_MULTIPLIER, re-centered on
//     South-West (the monsoon's own direction) rather than West (the
//     sun's), because these are two different physical mechanisms that
//     happen to share a facing axis, not the same number twice.
//  2. This unit's own monsoon-season sun hours (reusing the same solar
//     summary shadeHeatScore.js reads, just Jun-Sep instead of Apr-Jun)
//     -- less sun after rain means slower drying, independent of city
//     climate.
//  3. City-level monsoon rainfall (real Jun-Sep normals, see
//     cityMeta.js's monsoonRainfall field) -- Mumbai's baseline risk is
//     categorically higher than Delhi's regardless of facing or floor.
//
// What this deliberately leaves out: floor level. "Ground floor is
// damper" is common belief, but there's no credible source tying floor
// height to dampness risk the way there is for view/privacy (sightline
// geometry) or heat (solar angle) -- so it's left out rather than baked
// in because it sounds plausible.
//
// Same honesty rule as shadeHeatScore.js: no building age, waterproofing
// or drainage data exists anywhere in this app, so this is a climate +
// orientation estimate, not a claim about this specific flat's walls.

import { clamp } from './types';

const MONSOON_MONTHS = ['June', 'July', 'August', 'September'];

// Wind-driven monsoon rain exposure by facing, not solar heat exposure --
// peaks at South-West (India's monsoon flow direction), not West (the
// sun's). North stays the most sheltered on both scales, but for a
// different physical reason here (wind shadow, not shade).
const FACING_RAIN_MULTIPLIER = {
  'South-West': 1.3, West: 1.2, South: 1.15, 'North-West': 1.0,
  'South-East': 0.95, East: 0.85, 'North-East': 0.75, North: 0.7,
};

// Jun-Sep sun hours at/above which a unit's own exposure is treated as
// "dries out fine regardless of city" -- same shape as sunScore.js's
// CEILING_HOURS, independently set since monsoon-month sun is inherently
// lower than the annual average this app otherwise scores against.
const CEILING_MONSOON_SUN_HOURS = 4;

// City monsoon rainfall (mm, Jun-Sep) at/above which city climate alone
// is treated as maximum risk -- set at Mumbai's own figure (1907mm, see
// cityMeta.js), the wettest of the five cities this app covers, so no
// city currently saturates the scale past 1.0.
const CEILING_RAINFALL_MM = 1900;

export function computeDampnessScore(summary, facing, monsoonRainfallMm) {
  const monsoonRows = summary.monthlySummary.filter(m => MONSOON_MONTHS.includes(m.month));
  const monsoonAvgHours = monsoonRows.length
    ? monsoonRows.reduce((s, m) => s + m.usableHours, 0) / monsoonRows.length
    : 0;

  const facingMultiplier = FACING_RAIN_MULTIPLIER[facing] ?? 1.0;
  const dryingDeficit = 1 - clamp(monsoonAvgHours / CEILING_MONSOON_SUN_HOURS, 0, 1);
  const rainfallRatio = clamp(monsoonRainfallMm / CEILING_RAINFALL_MM, 0, 1);

  // All three signals matter, but city rainfall is the floor under
  // everything -- a well-shaded North-facing unit in Mumbai still sits
  // in a genuinely wetter climate than a badly-exposed unit in Delhi.
  // Blended rather than multiplied so no single low factor can zero out
  // a real risk from the other two.
  const riskRatio = clamp(
    0.45 * rainfallRatio + 0.35 * (facingMultiplier - 0.7) / (1.3 - 0.7) + 0.2 * dryingDeficit,
    0, 1
  );

  const score = Math.round((1 - riskRatio) * 100);

  const summaryLine =
    riskRatio < 0.3
      ? `Low monsoon dampness risk, ${facing}-facing stays relatively sheltered and dry.`
      : riskRatio < 0.6
      ? `Moderate monsoon dampness risk (${facing}-facing, ${monsoonRainfallMm}mm Jun-Sep local rainfall).`
      : `Higher monsoon dampness risk, expect to check walls/paint on this facing after monsoon (${facing}-facing, ${monsoonRainfallMm}mm Jun-Sep local rainfall).`;

  return {
    key: 'dampness',
    label: 'Dampness Risk',
    score,
    summary: summaryLine,
    basis:
      `cityMonsoonRainfall=${monsoonRainfallMm}mm (Jun-Sep), facingMultiplier(${facing})=${facingMultiplier}, ` +
      `monsoonAvgUsableHours=${monsoonAvgHours.toFixed(1)}h → riskRatio=${riskRatio.toFixed(2)} ` +
      `(estimate from climate + orientation, not a building inspection)`,
  };
}
