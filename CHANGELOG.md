# Data & scoring changelog

Item 7 of the trust-framework checklist: "Version your scoring model... publish a simple changelog... monitor impact." This file starts that practice - it is reconstructed from git history up through this entry, and should be updated by hand (or by whatever patches `data/aslivastu/*.json`) from here on, every time a data source, weight, or scoring method changes for any dimension in any city.

Version numbers are for this dataset/methodology, not the app (`package.json`'s `version` is separate).

## v1.8 - 2026-09-22

- Ran a full pre-monetization audit across all 4 validators, every city, every pincode, plus a codebase search for the schools_list bug class and a real-source spot check on the validator's cross-field-contradiction flags (commercial zone + weak infra + 0 metro, the Connaught Place bug pattern). Full findings in `pre-monetization-data-audit-2026-09-22.md` (not committed to this repo, kept as a working document).
- Fixed 4 confirmed-wrong `metro_stations_nearby` values found by that audit: 201309 (Noida Sector 62/62A, Delhi NCR), 400052 (Khar West, Mumbai), 500082 (Somajiguda, Hyderabad), 500073 (Srinagar Colony, Hyderabad). Each checked against a real, named, currently operational station and a real distance, not guessed. 201309 is a special case worth flagging: `scripts/metro_stations.py`'s own registry entry for "Noida Sector 62" carries a wrong placeholder coordinate (28.480863, 77.084888), shared, incorrectly, by 6 unrelated stations (Noida Sectors 34/52/59/61/62 and Old Faridabad) - this looks like a gap-filled value in the upstream open dataset the registry was built from, not a bug BlindSpot introduced. This pin was fixed by direct override (station's own name matches the pin's own named sector), not by correcting that shared bad coordinate, which affects other stations too and is a separate, larger follow-up, not done in this pass.
- Not fixed this pass, flagged for follow-up: 3 more pincodes from the same audit sample (400049 Juhu, 500032 Gachibowli/Financial District, 500084 Kondapur/Kothaguda) are borderline and need a tighter distance check than a general web search gave; Mumbai and Hyderabad's metro fields are still mostly unverified city-wide (48% and 80% of their pins respectively report 0 with no source citation at all); Bangalore's crime counts look synthetic (100% round multiples of 10) and all 66 of its records are still tagged as an unauthoritative seed source from v1.0; pincode 123106 (Dharuhera) is scored on only 2 of 8 dimensions yet still carries a B+ grade; and the registry coordinate bug found above (the other 5 stations sharing that placeholder coordinate, plus a cluster of 11 Gurugram Rapid Metro stations that all share a different wrong shared coordinate) hasn't been corrected yet.

## v1.7 - 2026-09-22

- Fixed a real production bug found while reviewing a live Chennai report page: Hyderabad's and Chennai's `schools_list` was stored as an array of plain strings, while Delhi NCR's and Bangalore's was an array of objects (`{name, address, board, pass_pct, distance_km}`). `AVDetailedReadout.js` only ever knew the object shape, so on Hyderabad/Chennai `sc.name` came back blank and `sc.board` silently fell back to a hardcoded `'CBSE'` default, on all 217 of their named schools, regardless of the school's actual board. Reshaped both cities' `schools_list` to the same object schema. Board is populated only where a school's own registered name states it (`Kendriya Vidyalaya` -> CBSE, a literal `CBSE`/`ICSE` in the name, or `Matriculation` -> Tamil Nadu's Matriculation Board): 25 of 217 schools qualified. The other 192 are left `board: null`, shown in the UI as "Board not confirmed" rather than defaulting to CBSE, matching Hyderabad's own build-script docstring, which already said board wasn't reliably determined at the single-school level this pass. `address`/`pass_pct`/`distance_km` were never captured for either city's schools and stay `null`, not fabricated.
- Also fixed `scripts/build_chennai.py` and `scripts/build_hyderabad.py` (both got a shared `infer_school_board()` helper) so a future re-run of either generator produces the same object shape, instead of regressing back to plain strings.
- Separately noted, not fixed this pass: Delhi NCR's and Bangalore's existing `schools_list` boards are already 100% `'CBSE'` across all 796 entries, which is either a genuinely CBSE-only source or the same kind of unverified default this fix just removed elsewhere. Worth checking before trusting that field at face value.

## v1.6 - 2026-09-22

- Same audit applied to Chennai (added earlier this pass as v1.5 of the city roster, not to be confused with this file's own v1.5): checked all 34 pins' `metro_stations_nearby` against Chennai Metro's real, currently operational Blue and Green Line stations. Found the data build already correctly withheld metro credit from every pin only served by the still-under-construction Yellow/Red/Purple line corridors, better than Mumbai's equivalent gap. One confirmed miss: Thiruvottiyur (600019) corrected from 0 to 2 (Tiruvottriyur and Tiruvottriyur Theradi stations, operational since 2019, share this pin's area name under an alternate transliteration). `discom` (TANGEDCO, the single state utility) needed no correction. Two pins (Royapuram 600013, KK Nagar 600078) were flagged as sitting close to real stations without an exact name match; left unchanged pending a precise coordinate check.

## v1.5 - 2026-09-19

- 16 sourced point-fixes to `master_by_pin.json`, found by checking real, currently operational transit stations and government utility listings against pins whose own area name matched them exactly (or nearly so): `metro_stations_nearby` corrected from 0 to 1 for 13 Mumbai pins (Saki Naka, Jogeshwari East, Bangur Nagar, Oshiwara, Mandapeshwar, Magathane, Dadar East, Hutatma Chowk, Santacruz West, Bandra West, Mantralaya, Deonar, Worli Colony), 1 Bangalore pin (HSR Layout, missed because the Yellow Line opened after the v1.4 station registry was built), and 1 Hyderabad pin (Khairatabad); `discom` corrected from UHBVN to DHBVN for Mahendragarh (122505), confirmed against the district's own government website. Each fix carries a `_provenance` entry naming its source.
- This was a spot-check, not an exhaustive re-run of `scripts/metro_stations.py` - Mumbai and Hyderabad still have no real station registry behind them (see v1.4's note), so `validate:data`'s `unverified-field` warnings for those two cities are still accurate for every pin not listed above. A proper fix is redoing metro_stations.py with real Mumbai (5-line, ~76-station) and Hyderabad (Red/Blue/Green) station data the way Delhi NCR and Bangalore already got.

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
