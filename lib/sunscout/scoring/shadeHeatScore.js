// lib/sunscout/scoring/shadeHeatScore.js
// Ported from SunScout's lib/scoring/shadeHeatScore.ts.
import { clamp } from './types';

const SUMMER_MONTHS = ['April', 'May', 'June'];

const FACING_HEAT_MULTIPLIER = {
  West: 1.3, 'South-West': 1.2, South: 1.0, 'North-West': 1.05,
  'South-East': 0.9, East: 0.8, 'North-East': 0.7, North: 0.6,
};

const CEILING_HEAT_LOAD = 7;

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
      ? `Well-shaded through summer — low direct heat exposure (${facing}-facing).`
      : heatLoad < 4
      ? `Moderate summer sun exposure (${summerAvgHours.toFixed(1)}h/day avg, ${facing}-facing).`
      : `High summer heat exposure — expect strong afternoon warmth (${summerAvgHours.toFixed(1)}h/day avg, ${facing}-facing).`;

  return {
    key: 'shadeHeat',
    label: 'Shade & Heat',
    score,
    summary: summaryLine,
    basis: `summerAvgUsableHours=${summerAvgHours.toFixed(1)}h × facingMultiplier(${facing})=${multiplier} → heatLoad=${heatLoad.toFixed(1)} (estimate, not measured temperature)`,
  };
}
