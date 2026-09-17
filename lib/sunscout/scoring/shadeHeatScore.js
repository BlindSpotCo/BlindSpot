// lib/sunscout/scoring/shadeHeatScore.js
// Ported from SunScout's lib/scoring/shadeHeatScore.ts.
import { clamp } from './types';

const SUMMER_MONTHS = ['April', 'May', 'June'];

const FACING_HEAT_MULTIPLIER = {
  West: 1.3, 'South-West': 1.2, South: 1.0, 'North-West': 1.05,
  'South-East': 0.9, East: 0.8, 'North-East': 0.7, North: 0.6,
};

// Which part of the day this facing's summer exposure actually falls in,
// so the "high heat" line below can name it correctly instead of always
// saying "afternoon". Checked against the app's own sun-path data at a
// ~13°N site: at this latitude the sun's midday azimuth swings north of
// overhead from roughly April to August, so an East/North-East/South-East
// unit's whole visible window sits in the morning then (e.g. a South-East
// unit on 21 June: sun visible 06:03-11:33, never after 11:33) -- calling
// that "afternoon warmth" would be describing a time of day the sun isn't
// even up for, for that wall. West-ish facings are the mirror case.
// South gets almost nothing across April-June this close to the equator
// (its one narrow window is a midday one in April) and North gets sun
// essentially dawn-to-dusk, so both get a time-neutral phrase rather than
// a specific claim the geometry doesn't clearly support either way.
// Exported so lib/property-score/actionItems.js can point someone to
// visit at the right time of day too -- "visit in the afternoon" is the
// same wrong advice as "expect afternoon warmth" for the same facings.
export const FACING_TIME_OF_DAY = {
  East: 'morning', 'North-East': 'morning', 'South-East': 'morning',
  West: 'afternoon', 'South-West': 'afternoon', 'North-West': 'afternoon',
  South: 'midday', North: 'through the day',
};

export const CEILING_HEAT_LOAD = 7;

export function computeShadeHeatScore(summary, facing) {
  const summerRows = summary.monthlySummary.filter(m => SUMMER_MONTHS.includes(m.month));
  const summerAvgHours = summerRows.length
    ? summerRows.reduce((s, m) => s + m.usableHours, 0) / summerRows.length
    : 0;

  const multiplier = FACING_HEAT_MULTIPLIER[facing] ?? 1.0;
  const heatLoad = summerAvgHours * multiplier;

  const normalized = 1 - clamp(heatLoad / CEILING_HEAT_LOAD, 0, 1);
  const score = Math.round(normalized * 100);

  const summaryLine =
    heatLoad < 1.5
      ? `Well-shaded through summer, low direct heat exposure (${facing}-facing).`
      : heatLoad < 4
      ? `Moderate summer sun exposure (${summerAvgHours.toFixed(1)}h/day avg, ${facing}-facing).`
      : `High summer heat exposure, expect strong ${FACING_TIME_OF_DAY[facing] || 'daytime'} warmth (${summerAvgHours.toFixed(1)}h/day avg, ${facing}-facing).`;

  return {
    key: 'shadeHeat',
    // Was "Shade & Heat" -- read as two separate things being assessed
    // when this is one score (summer heat exposure from lack of shade),
    // and it didn't match the "X Risk" naming Dampness/Noise already use
    // for the same "higher score = safer" shape. "Heat Risk" fixes both.
    label: 'Heat Risk',
    score,
    summary: summaryLine,
    basis: `summerAvgUsableHours=${summerAvgHours.toFixed(1)}h × facingMultiplier(${facing})=${multiplier} → heatLoad=${heatLoad.toFixed(1)} (estimate, not measured temperature)`,
    // Raw value, not just the 0-100 score -- thermalCostEstimate.js needs
    // the actual heatLoad number (and CEILING_HEAT_LOAD below) to turn
    // exposure into an AC-cost estimate, not the normalized score.
    heatLoad,
  };
}
