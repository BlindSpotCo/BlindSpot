// lib/sunscout/scoring/viewScore.js
// Ported from SunScout's lib/scoring/viewScore.ts (deterministic floor
// cutoffs -- no live building-data dependency, per SunScout's own
// reliability decision).
import { floorViewPrior } from './floorPriors';

const CUTOFFS = [
  { max: 1, label: 'ground level, typically boxed in by compound walls or the next building' },
  { max: 4, label: 'low floor, partially open at best' },
  { max: 9, label: 'mid floor, usually clears most immediate obstructions' },
  { max: 15, label: 'high floor, generally open sky in most directions' },
  { max: Infinity, label: 'very high floor, close to unobstructed' },
];

export function computeViewScore(floor, facing) {
  const score = floorViewPrior(floor);
  const bucket = CUTOFFS.find(c => floor <= c.max);

  return {
    key: 'view',
    label: 'View',
    score,
    summary: `Floor ${floor} (${facing}-facing) — ${bucket.label}.`,
    basis: `Deterministic floor cutoff, not building-specific: floor=${floor} → score=${score}.`,
  };
}
