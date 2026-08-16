// lib/aslivastu/cityMeta.js
// Per-city attribution and price-context wording, keyed by the `city`
// value on each record in data/aslivastu/nqi_scores.json.
//
// WHY THIS EXISTS
// Every city-specific string used to be a binary ternary written as
// `city === 'Bangalore' ? bengaluruText : delhiText` -- in source() in
// AVDetailedReadout.js, and again in NeighbourhoodReport.js and
// my-reports/[id]/page.js. That is fine with exactly two cities and
// silently wrong the moment there is a third: Chandigarh would have
// rendered "Delhi Police Annual Report", "Delhi Jal Board", "MCD / PWD
// road surveys" and "band for the NCR", because it simply wasn't
// Bangalore. Nothing would have thrown; the report would just have
// confidently cited the wrong government department for every dimension.
//
// The fallback below is deliberately GENERIC, not Delhi. An unknown city
// gets neutral, non-committal wording ("Municipal records", "the local
// authority") rather than another city's institutions. A vague label is
// recoverable; a wrong attribution is a credibility problem.
//
// Adding a city = adding one entry here. If you forget, nothing breaks
// and nothing lies -- you just get the generic text, which is the
// intended failure mode.

const GENERIC = {
  // Used when a city has no entry. Names no institution it can't back up.
  shortName: 'this city',
  // "circle rate" (Delhi/UP), "collector rate" (Haryana/Chandigarh) and
  // "guidance value" (Karnataka) are the same instrument under different
  // state vocabulary -- the government's minimum registrable value.
  rateTerm: 'government rate',
  // Title-cased form for headings ("Price Context · Circle Rate"). The
  // report used to hardcode "Guidance Value" -- Karnataka's term -- on
  // every city's heading, including Delhi's.
  rateTermTitle: 'Government Rate',
  // How far market prices sit above the government minimum: [low, high]
  // multipliers plus the matching human label. Was hardcoded at NCR's
  // 20-70% for every city.
  marketMultiplier: [1.2, 1.6],
  marketGapLabel: 'well above',
  sources: {
    crime: 'Police records · est. 2023',
    infrastructure: 'Municipal development plans · est. 2024',
    air: 'CPCB live AQI · updated daily',
    power: 'Local DISCOM reports · est. 2023',
    schools: 'CBSE affiliation database · est. 2023',
    water: 'Municipal water supply records · est. 2023',
    roads: 'Municipal road surveys · est. 2023',
    sewerage: 'Drainage & waterlogging records · est. 2023',
  },
  rateTermNote:
    'The government’s minimum property value, used to calculate stamp duty and registration charges. States name it differently — circle rate, collector rate, or guidance value — but it is the same instrument.',
  marketGapNote:
    'Actual market prices typically run above the government minimum. That minimum is only the legal floor — budget for the difference in your own funds, since home loans are usually capped near this valuation.',
};

export const CITY_META = {
  'Delhi NCR': {
    shortName: 'the NCR',
    rateTerm: 'circle rate',
    rateTermTitle: 'Circle Rate',
    marketMultiplier: [1.2, 1.6],
    marketGapLabel: '20-70% above',
    sources: {
      crime: 'Delhi Police Annual Report · est. 2023',
      infrastructure: 'DDA Master Plan · DMRC · est. 2024',
      air: 'CPCB live AQI · updated daily',
      power: 'BSES / Tata Power · est. 2023',
      schools: 'CBSE affiliation database · est. 2023',
      water: 'Delhi Jal Board supply & quality · est. 2023',
      roads: 'MCD / PWD road surveys · est. 2023',
      sewerage: 'Drainage & waterlogging records · est. 2023',
    },
    rateTermNote:
      '‘Circle rate’ and ‘collector rate’ are the SAME thing — the government’s minimum property value, used to calculate stamp duty and registration charges. Delhi/UP call it circle rate; Haryana calls it collector rate.',
    marketGapNote:
      'Actual market prices in NCR typically run 20–70% ABOVE the circle rate (highest in prime Delhi & Gurugram, per Anarock/industry data). The circle rate is only the legal floor — budget for the difference in your own funds, since home loans are usually capped near this valuation.',
  },

  Bangalore: {
    shortName: 'Bengaluru',
    rateTerm: 'guidance value',
    rateTermTitle: 'Guidance Value',
    marketMultiplier: [1.1, 1.4],
    marketGapLabel: '10-40% above',
    sources: {
      crime: 'Bengaluru City Police / NCRB · est. 2023',
      infrastructure: 'BBMP plans · BMRCL Namma Metro · est. 2024',
      air: 'CPCB / KSPCB live AQI · updated daily',
      power: 'BESCOM annual reports · est. 2023',
      schools: 'CBSE affiliation database · est. 2023',
      water: 'BWSSB (Cauvery) supply & quality · est. 2023',
      roads: 'BBMP road-condition surveys · est. 2023',
      sewerage: 'BWSSB waterlogging records · est. 2023',
    },
    rateTermNote:
      'Karnataka calls it ‘guidance value’ — the same instrument Delhi/UP call a circle rate and Haryana calls a collector rate: the government’s minimum property value, used to calculate stamp duty and registration charges. Set by the Dept. of Stamps & Registration (Kaveri).',
    marketGapNote:
      'Actual market prices in Bengaluru typically run above the guidance value, with the gap widest in central and high-demand tech-corridor pockets. The guidance value is only the legal floor — budget for the difference in your own funds, since home loans are usually capped near this valuation.',
  },

  Chandigarh: {
    shortName: 'Chandigarh',
    rateTerm: 'collector rate',
    rateTermTitle: 'Collector Rate',
    marketMultiplier: [1.15, 1.5],
    marketGapLabel: '15-50% above',
    sources: {
      crime: 'Chandigarh Police / NCRB · est. 2023',
      // No operational metro: Phase 1 of the Tricity network is scheduled
      // 2027-2034 and construction has not started, so infrastructure here
      // is road/grid-led rather than transit-led. Said plainly rather than
      // citing a metro authority that runs nothing yet.
      infrastructure: 'UT Master Plan 2031 · CHB · est. 2024',
      air: 'CPCB / CPCC live AQI · updated daily',
      // Distribution transferred from the UT Electricity Department to
      // Chandigarh Power Distribution Ltd (RPSG/EEDL) in Feb 2025 -- dated
      // 2025 deliberately, since older figures describe a different operator.
      power: 'Chandigarh Power Distribution Ltd (CPDL) · est. 2025',
      schools: 'CBSE affiliation database · est. 2023',
      water: 'Chandigarh MC water supply · est. 2023',
      roads: 'Chandigarh MC / UT Engineering Dept · est. 2023',
      sewerage: 'Chandigarh MC drainage records · est. 2023',
    },
    rateTermNote:
      'Chandigarh calls it the ‘collector rate’ (or DC rate) — the same instrument Delhi/UP call a circle rate and Karnataka calls a guidance value: the government’s minimum property value, used to calculate stamp duty and registration charges. Published sector-wise by the Office of the District Collector, U.T. Chandigarh.',
    marketGapNote:
      'Actual market prices in Chandigarh typically run above the collector rate, with the widest gap in the low-numbered northern sectors. The collector rate is only the legal floor — budget for the difference in your own funds, since home loans are usually capped near this valuation.',
  },

  Mumbai: {
    shortName: 'Mumbai',
    rateTerm: 'ready reckoner rate',
    rateTermTitle: 'Ready Reckoner Rate',
    marketMultiplier: [1.3, 2.2],
    marketGapLabel: '30-120% above',
    sources: {
      crime: 'Mumbai Police / NCRB · est. 2023',
      // Mumbai Metro is real and operational here, unlike Chandigarh --
      // Line 1, 2A/2B, 3 (Aqua, fully underground, 27 stations) and 7 are
      // all running as of late 2025/2026, so this cites the transit
      // authority rather than a "no metro yet" caveat.
      infrastructure: 'MMRDA · Mumbai Metro · est. 2024',
      air: 'CPCB / MPCB / SAFAR-Mumbai · updated daily',
      // Mumbai's power distribution is genuinely three-way, not one
      // DISCOM -- BEST (Island City), Tata Power + Adani Electricity
      // (parallel-licensed western suburbs, the only Indian city with two
      // networks on one street), MSEDCL at the BMC periphery. The
      // `discom` field on each record already carries the specific
      // combination for that pincode.
      power: 'BEST / Tata Power / Adani Electricity · est. 2024',
      schools: 'CBSE & ICSE affiliation databases · est. 2023',
      water: 'BMC Hydraulic Engineering Dept. · est. 2023',
      roads: 'BMC Roads Dept. · est. 2023',
      sewerage: 'BMC Storm Water Drains Dept. · est. 2023',
    },
    rateTermNote:
      'Maharashtra calls it the ‘Ready Reckoner Rate’ (RRR) or Annual Statement of Rates — the same instrument Delhi/UP call a circle rate, Haryana/Chandigarh a collector rate, and Karnataka a guidance value: the government’s minimum property value, used to calculate stamp duty and registration charges. Published per sq metre, zone-wise, by IGR Maharashtra.',
    marketGapNote:
      'Actual market prices in Mumbai typically run well above the Ready Reckoner Rate, with the widest gap in supply-constrained South Mumbai and Bandra. The RRR is only the legal floor for stamp duty — budget for the difference in your own funds, since home loans are usually capped near this valuation.',
  },
};

export function cityMeta(city) {
  return CITY_META[city] || GENERIC;
}

// Convenience for the one thing every surface needs: the source line for
// a given dimension in a given city.
export function sourceFor(dimension, city) {
  return cityMeta(city).sources[dimension] || '';
}

export const KNOWN_CITIES = Object.keys(CITY_META);

// The coverage pill on the landing page and the property-score intro used
// to hardcode "Delhi NCR & Bangalore". Deriving it means adding a city in
// one place updates the public claim automatically, instead of the site
// continuing to advertise two cities after a third goes live (or, worse,
// advertising a city whose data never landed).
//
// Keep CITY_META in step with data/aslivastu/nqi_scores.json --
// scripts/build_chandigarh.py asserts the two agree.
export function coverageLabel() {
  const n = KNOWN_CITIES;
  if (n.length === 0) return '';
  if (n.length === 1) return n[0];
  return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
}
