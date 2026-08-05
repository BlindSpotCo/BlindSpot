// lib/sunscout/scoring/types.js
// Ported from SunScout's lib/scoring/types.ts.

export const DEFAULT_WEIGHTS = {
  sun: 0.3,
  shadeHeat: 0.25,
  view: 0.2,
  privacy: 0.15,
  wind: 0.1,
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
