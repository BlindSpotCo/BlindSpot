// lib/sunscout/scoring/types.js
// Ported from SunScout's lib/scoring/types.ts.

// Rebalanced when dampness was added as a real 6th sub-score (not a
// satellite stat like thermalCost) -- sun/shadeHeat/view/privacy/wind
// scaled down proportionally rather than dampness just being appended
// on top of a total that summed past 1.
export const DEFAULT_WEIGHTS = {
  sun: 0.27,
  shadeHeat: 0.22,
  view: 0.18,
  privacy: 0.13,
  wind: 0.09,
  dampness: 0.11,
};

export function scoreToGrade(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}
