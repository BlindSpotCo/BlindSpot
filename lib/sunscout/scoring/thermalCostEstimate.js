// lib/sunscout/scoring/thermalCostEstimate.js
//
// Turns the existing Shade & Heat exposure signal into a rough summer
// AC-running-cost estimate -- "this facing/floor will cost you more to
// cool", not a new 0-100 comfort sub-score. Deliberately NOT fed into
// scoreAggregator.js's weighted average: a ₹ figure isn't a "goodness"
// score the other five sub-scores are, and folding it in would distort
// the weighting rather than add information. It's a satellite stat,
// surfaced next to the Shade & Heat tile.
//
// Same honesty rule as shadeHeatScore.js ("estimate, not measured
// temperature"): there's no insulation, window area, or room-volume data
// anywhere in this app, so this is not a heat-transfer simulation. It's
// two assumptions -- a baseline AC run-time every summer night regardless
// of exposure, plus extra run-time scaled by this unit's own heatLoad --
// times a standard 1.5-ton AC's power draw, times a per-city tariff.
// Good enough to compare two units against each other; not a bill.

import { clamp } from './types';
import { CEILING_HEAT_LOAD } from './shadeHeatScore';

// Nights in an Indian summer where SOME AC use happens even in a
// well-shaded, low-exposure unit -- humidity and ambient heat that have
// nothing to do with this unit's own sun exposure.
const BASELINE_HOURS_PER_NIGHT = 4;

// Extra hours added at the worst-case heatLoad -- imported from
// shadeHeatScore.js rather than a second hardcoded copy of 7, so a unit
// that scores 0 on Shade & Heat is always the one that gets the full
// extra 4h here too; the two numbers can't drift out of sync.
const MAX_EXTRA_HOURS = 4;

// A typical 1.5-ton, 5-star inverter split AC's average running draw --
// not its nameplate wattage, which assumes 100% compressor duty and
// overstates real-world draw once a room reaches its set temperature.
const ASSUMED_AC_KW = 1.4;

const DAYS_PER_MONTH = 30;

// Shown as a range, not a point figure -- the two assumptions above are
// real assumptions, and a single confident number would overclaim
// precision this estimate doesn't have.
const RANGE_SPREAD = 0.15;

export function estimateAcCost({ heatLoad, tariffPerKwh }) {
  const heatRatio = clamp(heatLoad / CEILING_HEAT_LOAD, 0, 1);
  const estRunHoursPerDay = BASELINE_HOURS_PER_NIGHT + heatRatio * MAX_EXTRA_HOURS;

  const estKwhPerMonth = estRunHoursPerDay * ASSUMED_AC_KW * DAYS_PER_MONTH;
  const estCostPerMonth = estKwhPerMonth * tariffPerKwh;

  const low = Math.round(estCostPerMonth * (1 - RANGE_SPREAD));
  const high = Math.round(estCostPerMonth * (1 + RANGE_SPREAD));

  return {
    estRunHoursPerDay: Math.round(estRunHoursPerDay * 10) / 10,
    estKwhPerMonth: Math.round(estKwhPerMonth),
    estCostPerMonth: Math.round(estCostPerMonth),
    estCostRange: [low, high],
    methodology:
      `~${BASELINE_HOURS_PER_NIGHT}h/night baseline summer AC use + up to ${MAX_EXTRA_HOURS}h more ` +
      `scaled by this unit's own heat exposure (heatLoad=${heatLoad.toFixed(1)}/${CEILING_HEAT_LOAD}) ` +
      `→ ~${Math.round(estRunHoursPerDay * 10) / 10}h/day for a standard 1.5-ton 5-star AC ` +
      `(${ASSUMED_AC_KW}kW) at ₹${tariffPerKwh.toFixed(1)}/unit -- an estimate, not a bill.`,
  };
}
