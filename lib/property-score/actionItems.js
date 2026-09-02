// lib/property-score/actionItems.js
// Turns weak scores into a concrete thing to do about them, not just a
// number. Apeksha's UX review (2026-08-28, 3:25 PM): "Users may
// understand a concern without knowing what to do about it. Translate
// each important finding into an action: a question to ask their
// realtor/broker, a detail to verify when visiting, or a condition to
// observe during a visit."
//
// Built from the raw per-dimension scores (area.factors, unit.subScores)
// rather than the weighted combinedScore, so this list does NOT change
// as the area/unit weighting slider moves -- the same 3:22 PM point this
// answers ("keep important concerns visible regardless of weighting").

const THRESHOLD = 60; // matches scoreToGrade's own Good/Fair cutoff (lib/sunscout/scoring/types.js)

const AREA_ACTIONS = {
  crime: 'Ask your broker about local safety, or check nearby police-station/society reviews. Walk the street after dark during your visit.',
  infrastructure: 'Ask what construction or development is planned nearby, and notice road/construction dust or noise on a weekday visit.',
  air: "Check the area's live AQI before you visit, and ask residents how it changes in winter.",
  power: 'Ask the housing society how often power cuts happen and whether backup power is included in maintenance.',
  schools: 'If schooling matters to you, ask your broker for the nearest schools by actual walking distance, not just how many are nearby.',
  water: 'Ask the society or broker about water supply hours, and whether the building has a history of shortages or tanker dependency.',
  roads: 'Walk or drive the actual approach roads during your visit, especially at rush hour, this score does not capture traffic congestion.',
  sewerage: 'Ask about monsoon waterlogging history in this specific lane or society, not just the area average.',
};

const UNIT_ACTIONS = {
  sun: 'Visit around midday and see how much natural light actually reaches the main rooms.',
  shadeHeat: 'Visit in the afternoon during summer and feel the actual heat buildup in this facing before deciding.',
  view: 'This is a floor-based estimate, not building-specific - visit in person and look out each window yourself.',
  privacy: 'This is a floor-based estimate - check the actual line of sight from neighbouring buildings/balconies during your visit.',
  wind: 'Visit on a hot, still day and open windows across the unit to check how well it actually cross-ventilates.',
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
function unitActionItems(subScores) {
  if (!Array.isArray(subScores)) return [];
  return subScores
    .filter(s => UNIT_ACTIONS[s.key] && typeof s.score === 'number' && s.score < THRESHOLD)
    .map(s => ({ key: s.key, label: s.label, score: s.score, action: UNIT_ACTIONS[s.key] }));
}

// Combined helper for the Verdict card: pass `combined.area?.factors`,
// `factorLabels`, and `combined.unit?.subScores`. Returns [] when nothing
// scored low enough to be worth flagging, area items first.
export function getActionItems({ areaFactors, factorLabels, unitSubScores } = {}) {
  return [...areaActionItems(areaFactors, factorLabels), ...unitActionItems(unitSubScores)];
}
