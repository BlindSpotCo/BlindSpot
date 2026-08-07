// lib/sunscout/scoring/sunScore.js
// Ported from SunScout's lib/scoring/sunScore.ts.
import { clamp } from './types';

const CEILING_HOURS = 6;
const FLOOR_HOURS = 0.5;

export function computeSunScore(summary) {
  const { avgUsableHours, verdict, bestMonths, worstMonths } = summary.solarFeasibility;

  const normalized = (avgUsableHours - FLOOR_HOURS) / (CEILING_HOURS - FLOOR_HOURS);
  const score = Math.round(clamp(normalized * 100));

  const summaryLine =
    avgUsableHours < FLOOR_HOURS
      ? `Very little direct sun reaches this unit year-round (${avgUsableHours}h/day avg).`
      : `Averages ${avgUsableHours}h of usable direct sun per day (best: ${bestMonths[0]}, worst: ${worstMonths[0]}).`;

  return {
    key: 'sun',
    label: 'Sun',
    score,
    summary: summaryLine,
    basis: `avgUsableHours=${avgUsableHours}h, feasibility verdict="${verdict}"`,
  };
}
