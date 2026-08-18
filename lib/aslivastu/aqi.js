// lib/aslivastu/aqi.js
// AQI band logic + the AQI -> 0-100 dimension score used by the area
// scoring engine. Pure functions, no I/O, no React -- safe to import from
// server routes, client components and scripts alike.
//
// Split out of the static data pipeline because air quality is the one
// dimension that genuinely changes day to day: every other dimension
// (crime, schools, roads...) comes from an annual government report, but
// AQI is a live reading. The stored aqi_avg in master_by_pin.json is a
// snapshot, and 27 of 268 pins never got one at all -- all of them in the
// NCR satellite cities (Gurugram, Noida, Ghaziabad, Faridabad) that were
// bucketed under "Delhi NCR" but sat outside whatever Delhi-only station
// mapping produced that file. Those areas were then scored on 7 of 8
// dimensions with air's weight silently redistributed to the rest, which
// systematically flattered exactly the places with the worst air.
//
// The fix is to stop depending on that snapshot: /api/aqi resolves a
// reading from the pin's own coordinates via a MODELLED 500m grid
// (Google Air Quality, ind_cpcb index) rather than from the nearest
// physical monitoring station. That distinction is the whole point --
// any station-based source reintroduces the same coverage lottery,
// because station networks are dense in city cores and thin everywhere
// else. A modelled grid returns a value for every coordinate, so the gap
// cannot come back, and a new city needs no air-quality data work at all.
// All AQI values here are therefore on CPCB's native 0-500 scale.

// CPCB's national AQI breakpoints. Same six bands the board publishes and
// the same labels already used across the report UI (see AQI_PLAIN).
export const AQI_BANDS = [
  { max: 50, category: 'Good' },
  { max: 100, category: 'Satisfactory' },
  { max: 200, category: 'Moderate' },
  { max: 300, category: 'Poor' },
  { max: 400, category: 'Very Poor' },
  { max: Infinity, category: 'Severe' },
];

export function aqiCategory(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return null;
  return AQI_BANDS.find(b => aqi <= b.max).category;
}

// AQI -> 0-100 dimension score.
//
// This is NOT a new curve. It is the curve the existing pipeline already
// used, recovered by regression against the 241 stored (aqi_avg, air)
// pairs in the shipped data, so that a live reading and a stored one for
// the same AQI produce the same score. Deliberately not "improved": any
// different curve would silently re-score the air dimension of all 268
// areas and shift their composites, which is a much larger change than
// filling in the missing readings and would make new numbers
// incomparable with anything previously shown or screenshotted.
//
// Fit: score = 101.41 - 0.2314 * aqi  (r ~ 1.0 across 221 of 241 records,
// max deviation 2.0 points). Expressed below in the equivalent, more
// legible form `100 - aqi/4.3`, which tracks the fit to within ~1 point
// over the populated range and to 4 points at the extreme (AQI 261).
//
// The 20 records that do NOT fit are all 20 Chandigarh records, which
// were scored on a visibly different curve (roughly 110 - 0.43 * aqi --
// far steeper, so a Chandigarh area is penalised about twice as hard per
// AQI point as an identical Delhi/Mumbai/Bangalore one). That is a real
// cross-city comparability bug in the source data, not something this
// function should paper over by special-casing a city: flagged for a
// separate rescoring pass rather than silently absorbed here.
const AQI_PER_POINT = 4.3;

export function aqiToScore(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return null;
  const v = Math.max(0, Math.min(500, aqi));
  return Math.max(0, Math.min(100, Math.round(100 - v / AQI_PER_POINT)));
}

// The canonical full-weight table, before any renormalisation: the split
// a record carries when all 8 dimensions are present.
//
// This has to be stated somewhere, because a record's own
// `weights_applied` is NOT a reliable base to build on. Records missing a
// dimension ship with weights ALREADY renormalised over the survivors and
// with the missing key absent entirely -- PIN 122002 carries crime 0.2941
// and no `air` key at all, rather than crime 0.25 and air 0.15. Adding an
// air score back while reusing those weights would give air a weight of
// zero and leave the composite completely unmoved, which is exactly the
// silent no-op this constant exists to prevent.
export const DEFAULT_WEIGHTS = {
  crime: 0.25, infrastructure: 0.20, air: 0.15, power: 0.10,
  schools: 0.10, water: 0.08, roads: 0.07, sewerage: 0.05,
};

// Restricts a full weight table to the dimensions actually present and
// renormalises so it sums to 1. Renormalising is the right call for a
// genuinely absent dimension, but it is NOT neutral: the missing weight
// is redistributed to the survivors, so a pin missing its weakest
// dimension scores higher than it would have with the data. That is the
// bug the live AQI feed exists to end.
export function normaliseWeights(scores, base = DEFAULT_WEIGHTS) {
  const keys = Object.keys(scores || {}).filter(k => scores[k] != null && base[k] != null);
  const total = keys.reduce((sum, k) => sum + base[k], 0);
  if (!total) return {};
  return Object.fromEntries(keys.map(k => [k, base[k] / total]));
}

// Weighted mean over whatever dimensions are present, renormalised across
// them. Extracted here because three places needed it and each had its
// own copy: the offline scoring pipeline, NeighbourhoodReport's persona
// re-weighting, and now the live-AQI merge.
export function weightedComposite(scores, weights) {
  const keys = Object.keys(scores || {}).filter(k => scores[k] != null);
  if (!keys.length) return null;
  const totalW = keys.reduce((sum, k) => sum + (weights?.[k] || 0), 0);
  if (!totalW) return null;
  return Math.round(keys.reduce((sum, k) => sum + scores[k] * (weights[k] || 0), 0) / totalW);
}

export function gradeFor(s) {
  if (s == null) return '—';
  return s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : s >= 50 ? 'C+' : s >= 40 ? 'C' : 'D';
}

// Folds a live AQI reading into a record: sets the air score, recomputes
// the composite over all 8 dimensions and re-derives the grade. Returns a
// NEW record; never mutates the argument (the caller's copy is often
// shared React state or a cached server object).
//
// If `live` is null -- no token configured, upstream down, or no station
// within range -- the record is returned untouched, so the stored
// snapshot keeps working and the page degrades to exactly its previous
// behaviour rather than erroring or showing a blank dimension.
export function withLiveAqi(record, live) {
  if (!record || !live || live.aqi == null) return record;
  const airScore = aqiToScore(live.aqi);
  if (airScore == null) return record;

  const scores = { ...(record.scores || {}), air: airScore };
  // Rebuilt from the canonical table rather than from record.weights_applied
  // -- see DEFAULT_WEIGHTS. This also has to be written back onto the
  // record, not just used for the arithmetic: the dimension readout prints
  // each row's weight from weights_applied, so leaving the old 7-dimension
  // split in place would show Safety at 29% while the composite beside it
  // was computed with 25%.
  const weights = normaliseWeights(scores);
  const composite = weightedComposite(scores, weights);

  return {
    ...record,
    scores,
    weights_applied: weights,
    aqi_avg: live.aqi,
    aqi_category: aqiCategory(live.aqi),
    aqi_station: live.station,
    aqi_observed_at: live.observedAt,
    aqi_is_live: true,
    ...(composite != null ? { nqi_composite: composite, grade: gradeFor(composite) } : {}),
  };
}
