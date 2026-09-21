// lib/property-score/actionItems.js
// Turns weak scores into a concrete thing to do about them, not just a
// number. Apeksha's UX review (2026-08-28, 3:25 PM): "Users may
// understand a concern without knowing what to do about it. Translate
// each important finding into an action: a question to ask their
// realtor/broker, a detail to verify when visiting, or a condition to
// observe during a visit."
//
// Built from the raw per-dimension scores (area.factors, unit.subScores)
// rather than the weighted combinedScore, so this list stays the same
// regardless of how the area/unit weighting is set -- the same 3:22 PM
// point this answers ("keep important concerns visible regardless of
// weighting"). There is no live control for that weighting any more
// (ReportScreen.js hardcodes areaWeight at 0.5), but the reasoning holds
// even if one comes back.

import { FACING_TIME_OF_DAY } from '@/lib/sunscout/scoring/shadeHeatScore';

const THRESHOLD = 60; // matches scoreToGrade's own Good/Fair cutoff (lib/sunscout/scoring/types.js)

const AREA_ACTIONS = {
  crime: 'Ask your broker about local safety, or check nearby police station records. Walk the street after dark during your visit.',
  infrastructure: 'Ask what construction is planned nearby, and look for road dust or traffic noise on a weekday visit.',
  air: "Check the area's live AQI before you visit, and ask residents how it changes in winter.",
  power: 'Ask the housing society how often power cuts happen and whether backup power is included in maintenance.',
  schools: 'If schooling matters to you, ask your broker for the nearest schools by actual walking distance, not just how many are nearby.',
  water: 'Ask the society or broker about daily water supply hours, and whether tanker trucks are needed in summer.',
  roads: 'Walk or drive the actual approach roads during your visit, especially at rush hour, this score does not capture traffic congestion.',
  sewerage: 'Ask neighbours about monsoon waterlogging history in this specific lane, not just the general area.',
};

const UNIT_ACTIONS = {
  sun: 'Visit around midday and see how much natural light actually reaches the main rooms.',
  // Was hardcoded to "the afternoon" for every facing -- wrong advice for
  // an East/North-East/South-East unit, whose own sun-hours figure above
  // comes entirely from the morning at this latitude (see
  // FACING_TIME_OF_DAY in shadeHeatScore.js). Telling someone to visit
  // then would have them checking a wall at exactly the time it's not
  // getting any sun.
  shadeHeat: (facing) =>
    `Visit in the ${FACING_TIME_OF_DAY[facing] || 'afternoon'} during summer to feel how hot the rooms get before deciding.`,
  view: 'This is a floor-based estimate, not building-specific - visit in person and look out each window yourself.',
  privacy: 'This is a floor-based estimate - check the actual line of sight from neighbouring buildings/balconies during your visit.',
  wind: 'Visit on a hot, still day and open windows across the unit to check how well it actually cross-ventilates.',
  dampness: 'Visit soon after monsoon and check this facing\'s outer walls, window frames and ceiling corners for seepage, staining or paint bubbling.',
  noise: 'Visit at rush hour and stand in the main rooms with windows shut, then open, to judge road/rail noise for yourself.',
};

// factors: { key: score } (e.g. combined.area.factors) | null/undefined
// factorLabels: { key: label } (e.g. FACTOR_LABELS from lib/property-score/ui)
function areaActionItems(factors, factorLabels) {
  if (!factors) return [];
  return Object.entries(factors)
    .filter(([key, score]) => AREA_ACTIONS[key] && typeof score === 'number' && score < THRESHOLD)
    .map(([key, score]) => ({ key, label: factorLabels?.[key] || key, score, action: AREA_ACTIONS[key] }));
}

// subScores: [{ key, label, score, ... }] (e.g. combined.unit.subScores) | null/undefined
// facing: needed because UNIT_ACTIONS.shadeHeat is facing-dependent (see above).
function unitActionItems(subScores, facing) {
  if (!Array.isArray(subScores)) return [];
  return subScores
    // `pending` rows (currently just a first-view Noise Risk, still
    // being fetched in the background -- see scoreAggregator.js) carry
    // a neutral placeholder score, not a real judgement. Flagging one as
    // an action item here would show a checklist entry that could then
    // vanish or change the moment the real score lands a few seconds
    // later, which is worse than just waiting for the real value.
    .filter(s => UNIT_ACTIONS[s.key] && typeof s.score === 'number' && s.score < THRESHOLD && !s.pending)
    .map(s => {
      const raw = UNIT_ACTIONS[s.key];
      return { key: s.key, label: s.label, score: s.score, action: typeof raw === 'function' ? raw(facing) : raw };
    });
}

// Combined helper for the Verdict card: pass `combined.area?.factors`,
// `factorLabels`, `combined.unit?.subScores`, and the unit's `facing`.
// Returns [] when nothing scored low enough to be worth flagging, area
// items first.
export function getActionItems({ areaFactors, factorLabels, unitSubScores, facing } = {}) {
  return [...areaActionItems(areaFactors, factorLabels), ...unitActionItems(unitSubScores, facing)];
}
