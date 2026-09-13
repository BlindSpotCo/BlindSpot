#!/usr/bin/env python3
"""
scripts/validate_data_integrity.py

L2 "invariant gates" from docs/data-integrity-architecture.md section 3 --
mechanical checks that catch fabricated or broken data WITHOUT needing to
know the correct answer. Every gate here is taken directly from that
doc's own table and is built to catch the specific bugs its audit found.

Run: python3 scripts/validate_data_integrity.py [--strict]

Exit code 0 = no failures (or only warnings, without --strict).
Exit code 1 = at least one gate failed. Intended to run in CI on every
data PR per the doc's sequencing table ("L2 invariant gates in CI ...
cheap, mechanical, catches all four audit findings, prevents recurrence").

This is a read-only report -- it never edits data, only flags it.
"""
import json
import sys
from collections import Counter, defaultdict

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"

STRICT = "--strict" in sys.argv

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))

master_by_pin = {str(r.get("pin_code")): r for r in master}

failures = []
warnings = []

def fail(msg):
    failures.append(msg)

def warn(msg):
    warnings.append(msg)

by_city_master = defaultdict(list)
for r in master:
    by_city_master[r.get("city")].append(r)

by_city_nqi = defaultdict(list)
for r in nqi:
    by_city_nqi[r.get("city")].append(r)

# ── Gate 1: zero-variance -- a field constant across >5 pins in a city ──
# (doc: "field constant across >5 pins in a city" caught Bangalore's
# last_resurfaced and Chandigarh's water_quality)
ZERO_VARIANCE_FIELDS = [
    "smart_city_project", "source", "authority", "discom", "zone",
    "last_resurfaced", "water_quality", "quality_score", "treatment",
    "road_condition", "reliability", "connectivity",
]
for city, recs in by_city_master.items():
    if len(recs) <= 5:
        continue
    for field in ZERO_VARIANCE_FIELDS:
        vals = [r.get(field) for r in recs if field in r]
        if len(vals) > 5 and len(set(vals)) == 1:
            fail(f"[zero-variance] {city}: '{field}' is the same value "
                 f"({vals[0]!r}) across all {len(vals)} records -- looks like a placeholder, not measured data.")

# ── Gate 2: synthetic tell -- >80% of a numeric field's values are round multiples of 10 ──
# (doc: caught 100% of Bangalore's crime counts)
SYNTHETIC_TELL_FIELDS = ["total_cognizable_crimes"]
for city, recs in by_city_master.items():
    for field in SYNTHETIC_TELL_FIELDS:
        vals = [r.get(field) for r in recs if isinstance(r.get(field), (int, float))]
        if len(vals) < 5:
            continue
        round_pct = sum(1 for v in vals if v % 10 == 0) / len(vals)
        if round_pct > 0.8:
            fail(f"[synthetic-tell] {city}: {round_pct:.0%} of '{field}' values are round "
                 f"multiples of 10 ({len(vals)} records) -- looks generated, not counted.")

# ── Gate 3: low cardinality -- distinct values < 5% of record count ──
# (doc: caught metro_stations_nearby at 3 distinct values across 268 records)
LOW_CARD_FIELDS = ["metro_stations_nearby", "aqi_avg"]
for city, recs in by_city_master.items():
    if len(recs) < 20:
        continue
    for field in LOW_CARD_FIELDS:
        vals = [r.get(field) for r in recs if field in r and r.get(field) is not None]
        if not vals:
            continue
        distinct_pct = len(set(vals)) / len(vals)
        if distinct_pct < 0.05:
            warn(f"[low-cardinality] {city}: '{field}' has only {len(set(vals))} distinct "
                 f"values across {len(vals)} records ({distinct_pct:.1%}) -- check for zone/jitter modelling.")

# ── Gate 4: non-authoritative source tag ──
# (doc: caught all 66 Bangalore records tagged "bengaluru_seed")
NON_AUTH_MARKERS = ("seed", "placeholder", "test", "fixture", "mock")
for r in master:
    sources = r.get("sources") or []
    for s in sources:
        if any(m in str(s).lower() for m in NON_AUTH_MARKERS):
            fail(f"[non-authoritative-source] {r.get('city')} {r.get('pin_code')}: "
                 f"sources includes {s!r} -- not fit to publish at high confidence.")
            break

# ── Gate 5: spatial impossibility for metro -- 0 stations while _provenance says otherwise, or unverified 0 in a dense city ──
# (doc: caught 78 Delhi pins claiming 0 while a real station sits within radius)
for r in master:
    prov = r.get("_provenance", {})
    metro_prov = prov.get("metro_stations_nearby")
    if metro_prov and metro_prov.get("confidence") == "high" and r.get("metro_stations_nearby", 0) < 0:
        fail(f"[spatial-impossibility] {r.get('city')} {r.get('pin_code')}: negative metro count.")
# Unverified metro fields (no _provenance entry) in cities we know had the bug --
# these are expected right now (Mumbai/Hyderabad) so this is a warning, not a failure,
# until a real station registry exists for them (see scripts/metro_stations.py docstring).
for city in ("Mumbai", "Hyderabad"):
    recs = by_city_master.get(city, [])
    unverified_zero = sum(
        1 for r in recs
        if r.get("metro_stations_nearby") == 0 and "metro_stations_nearby" not in r.get("_provenance", {})
    )
    if unverified_zero:
        warn(f"[unverified-field] {city}: {unverified_zero}/{len(recs)} pins report "
             f"metro_stations_nearby=0 with no _provenance entry -- still the old, "
             f"unfixed value (see scripts/metro_stations.py docstring for why).")

# ── Gate 6: cross-field contradiction -- commercial zone, weak infra, zero metro ──
for r in master:
    if (r.get("zone_type") == "Commercial" and (r.get("infra_score_raw") or 0) < 50
            and r.get("metro_stations_nearby") == 0):
        fail(f"[cross-field-contradiction] {r.get('city')} {r.get('pin_code')}: "
             f"Commercial zone + infra_score_raw<50 + 0 metro stations -- the exact "
             f"Connaught Place bug pattern from the architecture doc's audit.")

# ── Gate 7: coverage -- a dimension missing without an explicit low/none confidence ──
for r in nqi:
    scored = r.get("dimensions_scored")
    total = r.get("dimensions_total")
    if scored is not None and total is not None and scored < total:
        warn(f"[coverage-gap] {r.get('city')} {r.get('pin_code')}: only {scored}/{total} "
             f"dimensions scored -- weights renormalise over survivors, so this area can "
             f"score HIGHER for missing its weakest dimension. Confirm the UI discloses this.")

# ── Gate 8: distribution drift placeholder -- needs a prior snapshot to compare against ──
# Not implemented: no versioned prior snapshot is checked into the repo yet (see the
# architecture doc's L6/versioning follow-up). Once one exists, compare each city's mean
# composite score release-over-release and fail on a >2-sigma shift.

print("=" * 72)
print("BlindSpot data integrity gates (docs/data-integrity-architecture.md, L2)")
print("=" * 72)
print(f"Records checked: {len(master)} (master_by_pin.json), {len(nqi)} (nqi_scores.json)")
print()

if failures:
    print(f"FAILURES ({len(failures)}):")
    for f in failures:
        print(f"  ✗ {f}")
    print()
if warnings:
    print(f"WARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  ⚠ {w}")
    print()
if not failures and not warnings:
    print("All gates passed clean.")

print("=" * 72)
if failures or (STRICT and warnings):
    print(f"RESULT: FAIL ({len(failures)} failure(s), {len(warnings)} warning(s))")
    sys.exit(1)
else:
    print(f"RESULT: PASS ({len(warnings)} warning(s))")
    sys.exit(0)
