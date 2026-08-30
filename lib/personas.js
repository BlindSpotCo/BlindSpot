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
    blurb: 'Commute and connectivity over square footage.',
    color: '#A5643B',
    avWeights: { crime: 20, infrastructure: 30, air: 12, power: 10, schools: 2, water: 8, roads: 13, sewerage: 5 },
    defaultAreaWeight: 45, // slightly unit-leaning — the specific place matters as much as the area
    reportFocus: 'this reader is a young professional or single renter/buyer — lead with commute, connectivity, nightlife/walkability, and how liveable the unit itself is day-to-day. Schools and family-oriented infrastructure matter far less here — don\u2019t dwell on them.',
    reportOverlay: {
      readerLine: 'A young professional, roughly 24-32, buying or renting a smaller unit. Works from home at least part of the week. Cares about what the place costs to run, how noisy it is, how exposed it is to the flats facing it, and whether they can get out of it cleanly in three to five years.',
      weightUp: 'usable daylight hours during a working day, glare on screens, privacy from facing units, cooling load and which months are AC-heavy, metro and road connectivity, walkability, noise exposure.',
      weightDown: 'schools, family-oriented infrastructure, retiree suitability. One clause each at most where the ground truth makes them unavoidable — never a paragraph.',
      sectionTitle: 'YOUR WEEK IN THIS FLAT',
      sectionBody: 'Six bullet lines, each starting "- " with a short label, then a colon, then one sentence containing a real figure from the ground truth. Use exactly these labels in this order: Desk light window, Screen glare risk, AC-heavy months, Privacy from facing units, Commute reach, Exit in three years. If the ground truth does not support a line, say plainly on that line that the data is not available for this address rather than guessing.',
      toneNote: 'Peer-to-peer and blunt. Short sentences. Assume they stop reading after the first section unless it earns the rest.',
    },
  },
  family_buyer: {
    id: 'family_buyer',
    label: 'Family Buyer',
    short: 'Family',
    blurb: 'Schools and safety come first.',
    color: '#632834',
    avWeights: { crime: 30, infrastructure: 12, air: 15, power: 10, schools: 22, water: 8, roads: 3, sewerage: 0 },
    defaultAreaWeight: 60, // area-leaning — the neighbourhood a kid grows up in matters more than one unit's finish
    reportFocus: 'this reader is buying for a family with (or planning) school-age kids — lead with safety, school access, and how settled/liveable the neighbourhood is long-term. This is a once-in-a-decade decision for them, so be thorough and don\u2019t undersell real weaknesses.',
    reportOverlay: {
      readerLine: 'A family buying a home to live in for ten years or more, with school-age children and often ageing parents in the same house. This is the largest financial decision they will make and they are risk-averse. They will read the whole report, twice.',
      weightUp: 'crime and safety, school access and count, hospital reach, water and power dependability, air quality, morning light in the rooms people wake up in, balcony and utility sunlight for drying, floor level and lift dependence for elderly members.',
      weightDown: 'rental yield, resale timing, screen glare, nightlife and walkability as a lifestyle draw.',
      sectionTitle: 'FAMILY LIFE HERE',
      sectionBody: 'Six bullet lines, each starting "- " with a short label, then a colon, then one sentence containing a real figure from the ground truth. Use exactly these labels in this order: Children\u2019s daylight, School reach, Emergency medical reach, Elderly access and this floor, Drying and utility sun, Water and power dependability. If the ground truth does not support a line, say plainly on that line that the data is not available for this address rather than guessing.',
      toneNote: 'Calm, complete, unhedged. Longer sentences are fine. Do not reassure. If crime, water or power sits in a weak band, state it inside the Home Buyer Verdict paragraph itself, not only later — this reader is the one a soft-pedalled warning actually harms.',
    },
  },
  investor: {
    id: 'investor',
    label: 'Investor',
    short: 'Investor',
    blurb: 'Yield and growth over lifestyle fit.',
    color: '#77652E',
    avWeights: { crime: 15, infrastructure: 28, air: 8, power: 15, schools: 8, water: 8, roads: 13, sewerage: 5 },
    defaultAreaWeight: 55,
    reportFocus: 'this reader is evaluating this as an investment, not a home to live in themselves — lead with price band vs. the composite score (over/under-valued for the fundamentals), infrastructure trajectory (metro/highway plans), and rentability. Personal-comfort factors like schools matter only insofar as they affect resale/rental demand, not for the reader\u2019s own use.',
    reportOverlay: {
      readerLine: 'Someone buying to rent out and exit in three to seven years. Emotionally neutral about the flat itself. Wants to know what drives the rent, what caps the price, and how this compares to the rest of the locality.',
      weightUp: 'the price band against the composite score — whether this reads as under-valued for the fundamentals, priced in line, or a premium, said plainly. Then infrastructure and connectivity trajectory, power reliability, school and hospital density purely as tenant-demand drivers, floor and facing as resale-negotiation items, and obstruction risk to future light from neighbouring plots.',
      weightDown: 'personal comfort framing, aesthetics, how it feels to live there.',
      sectionTitle: 'RENTAL AND RESALE POSITION',
      sectionBody: 'Six bullet lines, each starting "- " with a short label, then a colon, then one sentence containing a real figure from the ground truth. Use exactly these labels in this order: Price band against fundamentals, Tenant profile this suits, Strongest pricing lever, Biggest discount risk, Obstruction risk to future light, Infrastructure trajectory. If the ground truth does not support a line, say plainly on that line that the data is not available for this address rather than guessing.',
      toneNote: 'Analytical and unsentimental. Number first, sentence second. Name the single biggest downside early and do not soften it. State once, plainly, that the price context is a government guidance value and not a market quote, and that BlindSpot does not model rents or yields — everything here concerns the physical and locality factors that influence them.',
    },
  },
  broker: {
    id: 'broker',
    label: 'Broker',
    short: 'Broker',
    blurb: 'A neutral picture to walk clients through.',
    color: '#3F411C',
    avWeights: { crime: 25, infrastructure: 20, air: 15, power: 10, schools: 10, water: 8, roads: 7, sewerage: 5 }, // same as AsliVastu's own Default — a broker needs the neutral baseline, not a slant
    defaultAreaWeight: 50,
    reportFocus: 'this reader is a broker/agent who will relay this to a client of unknown profile — stay balanced and complete rather than leading with one buyer type\u2019s priorities. Keep the closing multi-buyer breakdown (families/young professionals/investors) prominent, since that\u2019s exactly what a broker needs to address different clients with the same report.',
    reportOverlay: {
      readerLine: 'A broker or channel partner about to walk a client of unknown profile through this unit. Needs material they can say out loud on site, and needs to know the client\u2019s objection before the client raises it.',
      weightUp: 'whatever genuinely scores highest in the ground truth, plus every weak point restated as an objection to be ready for. Keep the multi-buyer breakdown prominent — that is the part a broker actually reuses across clients.',
      weightDown: 'nothing in particular, but keep every section tighter than default. This reader skims on a site visit.',
      sectionTitle: 'PITCH SHEET',
      sectionBody: 'Six bullet lines, each starting "- " with a short label, then a colon, then one sentence containing a real figure from the ground truth. Use exactly these labels in this order: Opening line, Strongest verifiable claim, Buyer type this suits, Buyer type to not waste a visit on, Likely objection and the honest answer, What not to promise. If the ground truth does not support a line, say plainly on that line that the data is not available for this address rather than guessing.',
      toneNote: 'Short sentences, speakable, nothing that needs rereading. The "What not to promise" line is mandatory and must name the specific overstatement this particular data invites — a broker\u2019s value from BlindSpot is credibility, so never hand them a claim the numbers cannot back.',
    },
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
