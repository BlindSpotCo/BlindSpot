// lib/sunscout/scoring/floorPriors.js
// Ported from SunScout's lib/scoring/floorPriors.ts.
import { clamp } from './types';

export function floorViewPrior(floor) {
  return Math.round(clamp(18 + floor * 4.5, 18, 85));
}

export function floorPrivacyPrior(floor) {
  return Math.round(clamp(24 + floor * 4, 24, 88));
}
