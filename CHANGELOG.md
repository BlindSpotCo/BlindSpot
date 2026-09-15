# Data & scoring changelog

Item 7 of the trust-framework checklist: "Version your scoring model... publish a simple changelog... monitor impact." This file starts that practice - it is reconstructed from git history up through this entry, and should be updated by hand (or by whatever patches `data/aslivastu/*.json`) from here on, every time a data source, weight, or scoring method changes for any dimension in any city.

Version numbers are for this dataset/methodology, not the app (`package.json`'s `version` is separate).

## v1.4 - 2026-09-13 (this pass)

- Real, sourced `metro_stations_nearby` for Delhi NCR + Bangalore via a centroid-radius join against named DMRC/Namma Metro station registries (`scripts/metro_stations.py`, `scripts/patch_metro.py`). Fixes the flagship bug in `docs/data-integrity-architecture.md` (PIN 110001 / Connaught Place: 0 → 8 stations). Mumbai/Hyderabad metro unchanged - no sourced station data found yet.
- First L0 provenance envelope (`_provenance` per record) - currently only on the metro field, for the two cities above.
- New tooling, not a data change itself: `scripts/validate_data_integrity.py` (L2 invariant gates), `scripts/quality_metrics.py` (completeness/consistency/timeliness), `scripts/benchmark_price_correlation.py` (score vs. circle-rate correlation), `scripts/ground_truth_audit.py` (sampling + scoring for a human-verified accuracy check). See each script's own docstring and `docs/data-integrity-architecture.md` section 7 for what each one found.
- L5 resident feedback loop (`components/shared/FieldFeedback.js` → `/api/field-feedback`) on 8 stat rows.
- L6 confidence badges in the detailed readout, wired generically to any field carrying `_provenance` (today: metro only).

## v1.3 - 2026-09-13

- AQI/air score rebuilt on real CPCB/KSPCB station data with inverse-distance-weighted interpolation, replacing zone-baseline-plus-jitter, for Mumbai, Hyderabad, Chandigarh and Bangalore (`scripts/cpcb_stations.py`). Delhi NCR intentionally NOT included - the available real station readings skewed to a pollution-season sample (mean AQI ~333 vs. a commonly-cited annual ~150–220); applying it as-is would have dropped Delhi's composite scores by up to 21 points on a non-representative sample. Kept as researched, unapplied work pending a re-anchor against real annual figures.

## v1.2 - 2026-09-11 to 09-12

- Mumbai water-supply score rebuilt from real BMC ward-timing data (23 of 25 wards; 2 keep the old zone estimate, flagged).
- Bangalore water-supply score rebuilt on a real core/periphery BBMP-zone split (no per-ward BWSSB data exists; this is the coarser fix that data availability allows).
- Power-outage score rebuilt across all 5 cities on real DISCOM/utility grades from the Ministry of Power's Integrated Rating & Ranking reports, replacing zone-baseline-plus-jitter.

## v1.1 - 2026-08-16 to 09-07

- Bangalore, Chandigarh, Mumbai and Hyderabad added as cities 2–5 (Delhi NCR was city 1). Assorted verified fixes along the way: Chandigarh AQI category mislabeling and unrealistic water-supply hours (both caught and fixed same-day), Mumbai schools count corrected (~4x overstated) and CBSE/ICSE ratio un-inverted, Mumbai air score recalibrated onto the same AQI scale as Delhi/Bangalore, Chandigarh air rescored onto that same shared curve.

## v1.0 - 2026-07-28

- Original baseline: Delhi NCR + Bangalore, 309 pincodes across the full dataset's eventual 5-city footprint, 8 scored dimensions (crime, infrastructure, air, power, schools, water, roads, sewerage). Large parts of this baseline were later found to be zone-modelled-plus-hash-jitter rather than measured (see `docs/data-integrity-architecture.md` section 1) - Bangalore's entire dataset was self-labelled `bengaluru_seed`. Every version above this one is, in part, a fix to something in this baseline.
