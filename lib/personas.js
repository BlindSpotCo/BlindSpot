// lib/personas.js
//
// "Uncover Your BlindSpot" persona system. Picking a persona doesn't just
// relabel the same report — it changes three real things:
//   1. avWeights        — re-weights AsliVastu's 8 neighbourhood factors,
//                          so the composite score itself shifts per persona
//                          (a family's score leans on schools/safety; an
//                          investor's leans on infrastructure/connectivity).
//   2. defaultAreaWeight — the neighbourhood-vs-unit split in the combined
//                          BlindSpot score (still adjustable by the person
//                          via the existing slider — this just sets where
//                          it starts).
//   3. reportFocus       — one line folded into the AI report prompt so the
//                          report itself is framed for what this persona
//                          actually cares about, not written generically.
//
// avWeights must sum to 100 — mirrors the same 8 factors AsliVastu already
// scores (see lib/property-score/ui.js FACTOR_LABELS), just re-proportioned.
//
// `color` codes each persona to which score domain it leans toward, using
// the exact 4-colour swatch given: dark olive (#3F411C, close to
// BlindSpot's own --brand — the neutral, structural one), burnt rust
// (#A5643B, continuity with the old --sun/unit-leaning accent), dark wine
// (#632834, continuity with the old --slate/area-leaning accent), and
// olive-gold (#77652E, the "balances both" tone). Young Professional
// leans unit-heavy -> rust. Family Buyer leans area-heavy -> wine.
// Investor balances both -> olive-gold. Broker stays neutral -> dark olive.

export const PERSONAS = {
  young_professional: {
    id: 'young_professional',
    label: 'Young Professional',
    short: 'Youngster',
    blurb: 'Commute, connectivity, and a lively area matter more than square footage.',
    color: '#A5643B',
    avWeights: { crime: 20, infrastructure: 30, air: 12, power: 10, schools: 2, water: 8, roads: 13, sewerage: 5 },
    defaultAreaWeight: 45, // slightly unit-leaning — the specific place matters as much as the area
    reportFocus: 'this reader is a young professional or single renter/buyer — lead with commute, connectivity, nightlife/walkability, and how liveable the unit itself is day-to-day. Schools and family-oriented infrastructure matter far less here — don\u2019t dwell on them.',
  },
  family_buyer: {
    id: 'family_buyer',
    label: 'Family Buyer',
    short: 'Family',
    blurb: 'Schools, safety, and a settled neighbourhood come first.',
    color: '#632834',
    avWeights: { crime: 30, infrastructure: 12, air: 15, power: 10, schools: 22, water: 8, roads: 3, sewerage: 0 },
    defaultAreaWeight: 60, // area-leaning — the neighbourhood a kid grows up in matters more than one unit's finish
    reportFocus: 'this reader is buying for a family with (or planning) school-age kids — lead with safety, school access, and how settled/liveable the neighbourhood is long-term. This is a once-in-a-decade decision for them, so be thorough and don\u2019t undersell real weaknesses.',
  },
  investor: {
    id: 'investor',
    label: 'Investor',
    short: 'Investor',
    blurb: 'Yield, price band, and infrastructure trajectory over lifestyle fit.',
    color: '#77652E',
    avWeights: { crime: 15, infrastructure: 28, air: 8, power: 15, schools: 8, water: 8, roads: 13, sewerage: 5 },
    defaultAreaWeight: 55,
    reportFocus: 'this reader is evaluating this as an investment, not a home to live in themselves — lead with price band vs. the composite score (over/under-valued for the fundamentals), infrastructure trajectory (metro/highway plans), and rentability. Personal-comfort factors like schools matter only insofar as they affect resale/rental demand, not for the reader\u2019s own use.',
  },
  broker: {
    id: 'broker',
    label: 'Broker',
    short: 'Broker',
    blurb: 'A neutral, complete picture to walk a client through, not one slant.',
    color: '#3F411C',
    avWeights: { crime: 25, infrastructure: 20, air: 15, power: 10, schools: 10, water: 8, roads: 7, sewerage: 5 }, // same as AsliVastu's own Default — a broker needs the neutral baseline, not a slant
    defaultAreaWeight: 50,
    reportFocus: 'this reader is a broker/agent who will relay this to a client of unknown profile — stay balanced and complete rather than leading with one buyer type\u2019s priorities. Keep the closing multi-buyer breakdown (families/young professionals/investors) prominent, since that\u2019s exactly what a broker needs to address different clients with the same report.',
  },
};

export const PERSONA_ORDER = ['young_professional', 'family_buyer', 'investor', 'broker'];

export function getPersona(id) {
  return PERSONAS[id] || null;
}

// Weighted-mean recompute of the AsliVastu composite from raw per-factor
// scores, using a persona's weights instead of AsliVastu's own baked-in
// Default weighting. Mirrors the same recompute NeighbourhoodReport.js
// does client-side for its own persona toggle — same math, just reused
// here server-side for the main property-score flow.
export function recomputeAreaScore(rawScores, avWeights) {
  const keys = Object.keys(rawScores || {});
  if (!keys.length) return null;
  const totalW = keys.reduce((sum, k) => sum + (avWeights[k] || 0), 0) || 1;
  const composite = Math.round(keys.reduce((sum, k) => sum + rawScores[k] * (avWeights[k] || 0), 0) / totalW);
  return composite;
}

export function gradeFor(score) {
  if (score == null) return '—';
  return score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C+' : score >= 40 ? 'C' : 'D';
}
