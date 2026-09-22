// lib/sunscout/scoring/dampnessScore.js
// Dampness / orientation risk -- a real 6th sub-score (unlike
// thermalCostEstimate.js's satellite ₹ stat), estimating monsoon-season
// seepage/mould risk from three real, sourced signals:
//
//  1. Facing -> wind-driven rain exposure. Most covered cities peak in
//     India's SW monsoon (Jun-Sep), a well-documented wind pattern:
//     South/South-West-facing walls take direct wind-driven rain,
//     North/North-East walls are largely sheltered by the building's own
//     mass. Same category of fact as shadeHeatScore.js's
//     FACING_HEAT_MULTIPLIER, re-centered on the monsoon's own wind
//     direction rather than West (the sun's), because these are two
//     different physical mechanisms that happen to share a facing axis,
//     not the same number twice. Chennai's dominant rain season is the
//     Oct-Dec Northeast (retreating) monsoon instead -- wind approaches
//     from NE/E there, not SW, so the facing exposure is genuinely
//     different, not just the calendar window. See SEASON_FACING_TABLES
//     below: the NE table is a reasoned physical mirror (SW table rotated
//     180°) rather than independently sourced per-facing data, and is
//     flagged as such in code.
//  2. This unit's own monsoon-season sun hours (reusing the same solar
//     summary shadeHeatScore.js reads, just the city's real monsoon
//     months instead of Apr-Jun) -- less sun after rain means slower
//     drying, independent of city climate.
//  3. City-level monsoon rainfall (real normals for the city's actual
//     monsoon season, see cityMeta.js's monsoonRainfall/monsoonSeason
//     fields) -- Mumbai's baseline risk is categorically higher than
//     Delhi's regardless of facing or floor.
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

const MONTH_ABBR_TO_NAME = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
  May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
  Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};
const MONTH_ORDER = Object.values(MONTH_ABBR_TO_NAME);

// Turns a "Jun-Sep" / "Oct-Dec" style range (as stored on cityMeta.js's
// monsoonSeason.months) into the full month names summary.monthlySummary
// keys by. Handles wraparound (e.g. "Nov-Feb") in case a future city's
// season crosses the calendar year, though none currently does.
function monthsInRange(rangeStr) {
  const [startAbbr, endAbbr] = rangeStr.split('-').map(s => s.trim());
  const startName = MONTH_ABBR_TO_NAME[startAbbr];
  const endName = MONTH_ABBR_TO_NAME[endAbbr];
  const startIdx = MONTH_ORDER.indexOf(startName);
  const endIdx = MONTH_ORDER.indexOf(endName);
  if (startIdx === -1 || endIdx === -1) return ['June', 'July', 'August', 'September'];
  if (startIdx <= endIdx) return MONTH_ORDER.slice(startIdx, endIdx + 1);
  return [...MONTH_ORDER.slice(startIdx), ...MONTH_ORDER.slice(0, endIdx + 1)];
}

// Default season for every covered city except Chennai: all genuinely
// SW-monsoon-dominant (Jun-Sep), matching cityMeta.js's own
// DEFAULT_MONSOON_SEASON fallback.
const DEFAULT_SEASON = { months: 'Jun-Sep', label: 'the Southwest monsoon', windFrom: 'South-West' };

// Wind-driven monsoon rain exposure by facing, not solar heat exposure --
// peaks at South-West (India's SW-monsoon flow direction), not West (the
// sun's). North stays the most sheltered on both scales, but for a
// different physical reason here (wind shadow, not shade).
const FACING_RAIN_MULTIPLIER_SW = {
  'South-West': 1.3, West: 1.2, South: 1.15, 'North-West': 1.0,
  'South-East': 0.95, East: 0.85, 'North-East': 0.75, North: 0.7,
};

// Chennai (and any future NE-monsoon city): the SW table above rotated
// 180°, so North-East-facing walls now take the direct wind-driven rain
// and South-West is the sheltered side. This is a reasoned physical
// mirror, not independently sourced per-facing data for Chennai -- flagged
// here and in the docstring above.
const FACING_RAIN_MULTIPLIER_NE = {
  'North-East': 1.3, East: 1.2, North: 1.15, 'South-East': 1.0,
  'North-West': 0.95, West: 0.85, 'South-West': 0.75, South: 0.7,
};

function facingTableFor(windFrom) {
  return windFrom === 'North-East' ? FACING_RAIN_MULTIPLIER_NE : FACING_RAIN_MULTIPLIER_SW;
}

// Monsoon-season sun hours at/above which a unit's own exposure is treated
// as "dries out fine regardless of city" -- same shape as sunScore.js's
// CEILING_HOURS, independently set since monsoon-month sun is inherently
// lower than the annual average this app otherwise scores against.
const CEILING_MONSOON_SUN_HOURS = 4;

// City monsoon rainfall (mm, over that city's own real monsoon season) at/
// above which city climate alone is treated as maximum risk -- set at
// Mumbai's own figure (1907mm Jun-Sep, see cityMeta.js), the wettest
// season total of the covered cities, so no city currently saturates the
// scale past 1.0.
const CEILING_RAINFALL_MM = 1900;

export function computeDampnessScore(summary, facing, monsoonRainfallMm, season = DEFAULT_SEASON) {
  const monsoonMonthNames = monthsInRange(season.months);
  const monsoonRows = summary.monthlySummary.filter(m => monsoonMonthNames.includes(m.month));
  const monsoonAvgHours = monsoonRows.length
    ? monsoonRows.reduce((s, m) => s + m.usableHours, 0) / monsoonRows.length
    : 0;

  const facingMultiplier = facingTableFor(season.windFrom)[facing] ?? 1.0;
  const dryingDeficit = 1 - clamp(monsoonAvgHours / CEILING_MONSOON_SUN_HOURS, 0, 1);
  const rainfallRatio = clamp(monsoonRainfallMm / CEILING_RAINFALL_MM, 0, 1);

  // All three signals matter, but city rainfall is the floor under
  // everything -- a well-shaded sheltered-facing unit in Mumbai still sits
  // in a genuinely wetter climate than a badly-exposed unit in Delhi.
  // Blended rather than multiplied so no single low factor can zero out
  // a real risk from the other two.
  const riskRatio = clamp(
    0.45 * rainfallRatio + 0.35 * (facingMultiplier - 0.7) / (1.3 - 0.7) + 0.2 * dryingDeficit,
    0, 1
  );

  const score = Math.round((1 - riskRatio) * 100);
  const seasonTag = `${season.months} ${season.label}`;

  const summaryLine =
    riskRatio < 0.3
      ? `Low dampness risk from ${seasonTag}, ${facing}-facing stays relatively sheltered and dry.`
      : riskRatio < 0.6
      ? `Moderate dampness risk from ${seasonTag} (${facing}-facing, ${monsoonRainfallMm}mm local rainfall).`
      : `Higher dampness risk from ${seasonTag}, expect to check walls/paint on this facing afterward (${facing}-facing, ${monsoonRainfallMm}mm local rainfall).`;

  return {
    key: 'dampness',
    label: 'Dampness Risk',
    score,
    summary: summaryLine,
    basis:
      `season=${season.months} (${season.label}), cityMonsoonRainfall=${monsoonRainfallMm}mm, facingMultiplier(${facing})=${facingMultiplier}, ` +
      `monsoonAvgUsableHours=${monsoonAvgHours.toFixed(1)}h → riskRatio=${riskRatio.toFixed(2)} ` +
      `(estimate from climate + orientation, not a building inspection)`,
  };
}
