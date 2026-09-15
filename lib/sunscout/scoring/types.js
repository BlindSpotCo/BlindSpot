// lib/sunscout/scoring/types.js
// Ported from SunScout's lib/scoring/types.ts.

// Rebalanced again when noise was added as a real 7th sub-score, same
// reasoning as the dampness rebalance above -- every existing weight
// scaled down proportionally so the set still sums to 1.
export const DEFAULT_WEIGHTS = {
  sun: 0.24,
  shadeHeat: 0.20,
  view: 0.16,
  privacy: 0.12,
  wind: 0.08,
  dampness: 0.10,
  noise: 0.10,
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
