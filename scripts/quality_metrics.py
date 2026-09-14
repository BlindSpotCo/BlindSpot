#!/usr/bin/env python3
"""
scripts/quality_metrics.py

Item 2 from the trust-framework checklist: explicit, measured quality
metrics per dimension, not a vibe ("we think we're ~85%"). Computes three
of the four named metrics from data already in the repo:

  - Completeness: % of pins in a city with a non-null score for each of
    the 8 dimensions.
  - Consistency: do values for a field stay inside the range/vocabulary
    every city is supposed to share (score dimensions 0-100, 1-5 quality
    scores actually 1-5, categorical fields drawing from one fixed set
    rather than a different spelling per city)?
  - Timeliness: age of each record's scored_at/merged_at timestamp
    against an EXPECTED_FRESHNESS_DAYS per dimension (defined below --
    these are this script's own stated assumption, not sourced from any
    BlindSpot policy doc, because none exists yet; change them if the
    product team picks different targets).

Accuracy (the fourth metric: "% of data points that match an independent
trusted source in a sample audit") is NOT computed here and can't be --
it needs a human-verified ground-truth sample, which is item 3 on the
checklist, not this script. scripts/ground_truth_audit.py generates the
sample to do that with.

Run: python3 scripts/quality_metrics.py
"""
import json
from collections import defaultdict
from datetime import datetime, timezone

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"

DIMENSIONS = ["crime", "infrastructure", "air", "power", "schools", "water", "roads", "sewerage"]

# This pipeline is a static, hand-triggered snapshot rebuild, not a live
# refresh job (flagged previously as a real gap: "every report firing two
# live Overpass API queries... stale data, no refresh pipeline"). These
# freshness targets are what a per-dimension refresh SHOULD hit once one
# exists, not a claim that one does. Everything will read as stale
# against these until a scheduled rebuild job is actually built.
EXPECTED_FRESHNESS_DAYS = {
    "air": 30,            # AQI is meant to feel close to live
    "crime": 365,         # annual government reporting cadence
    "infrastructure": 180,
    "power": 365,
    "schools": 365,
    "water": 365,
    "roads": 365,
    "sewerage": 365,
}

# Known-good vocabularies -- values outside these are either a typo, a
# different spelling used by one city's build script, or a genuinely new
# category nobody added to this list yet. Either way it's a consistency
# problem worth a human look.
EXPECTED_VOCAB = {
    "crime_tier": {"Very Low", "Low", "Moderate", "High", "Very High"},
    "aqi_category": {"Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"},
    "highway_proximity": {"High", "Medium", "Low"},
    "reliability": {"Excellent", "Good", "Average", "Poor", "Very Poor"},
    "road_condition": {"Excellent", "Good", "Average", "Poor", "Very Poor"},
    "connectivity": {"High", "Medium", "Low"},
    "treatment": {"Adequate", "Partial", "Inadequate"},
    "grade": {"A", "B", "C", "D", "F"},
}

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))
master_by_pin = {str(r.get("pin_code")): r for r in master}

nqi_by_city = defaultdict(list)
for r in nqi:
    nqi_by_city[r["city"]].append(r)

now = datetime.now(timezone.utc)

def parse_dt(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None

print("=" * 78)
print("1. COMPLETENESS -- % of pins with a non-null score, per dimension per city")
print("=" * 78)
for city, recs in sorted(nqi_by_city.items()):
    n = len(recs)
    line = [city.ljust(12)]
    for dim in DIMENSIONS:
        have = sum(1 for r in recs if (r.get("scores") or {}).get(dim) is not None)
        pct = have / n * 100
        flag = "" if pct >= 99 else "!"
        line.append(f"{dim[:5]}:{pct:5.1f}%{flag}")
    print("  " + "  ".join(line))
print("  (! = below 99% complete)")

print()
print("=" * 78)
print("2. CONSISTENCY -- values inside the expected range/vocabulary?")
print("=" * 78)
range_violations = 0
for city, recs in sorted(nqi_by_city.items()):
    for r in recs:
        for dim, val in (r.get("scores") or {}).items():
            if val is not None and not (0 <= val <= 100):
                print(f"  ✗ {city} {r.get('pin_code')}: scores.{dim} = {val} — outside 0-100 range")
                range_violations += 1
vocab_violations = 0
for pin, r in master_by_pin.items():
    for field, allowed in EXPECTED_VOCAB.items():
        val = r.get(field)
        if val is not None and val not in allowed:
            print(f"  ✗ {r.get('city')} {pin}: {field} = {val!r} — not in expected set {sorted(allowed)}")
            vocab_violations += 1
for r in nqi:
    val = r.get("grade")
    if val is not None and val not in EXPECTED_VOCAB["grade"]:
        print(f"  ✗ {r.get('city')} {r.get('pin_code')}: grade = {val!r} — not in expected set")
        vocab_violations += 1
if range_violations == 0 and vocab_violations == 0:
    print("  No range or vocabulary violations found.")
else:
    print(f"  {range_violations} range violation(s), {vocab_violations} vocabulary violation(s).")

print()
print("=" * 78)
print("3. TIMELINESS -- age of scored_at/merged_at vs. an expected refresh window")
print("=" * 78)
print("(Assumed windows, not a sourced BlindSpot policy -- see module docstring.)")
for city, recs in sorted(nqi_by_city.items()):
    scored_ages = [
        (now - dt).days for r in recs
        if (dt := parse_dt(r.get("scored_at"))) is not None
    ]
    if not scored_ages:
        print(f"  {city}: no parseable scored_at timestamps.")
        continue
    oldest, newest, avg = max(scored_ages), min(scored_ages), sum(scored_ages) / len(scored_ages)
    print(f"  {city}: scored_at age — newest {newest}d, oldest {oldest}d, avg {avg:.0f}d "
          f"({len(scored_ages)} records)")
stale_by_dim = defaultdict(int)
for pin, r in master_by_pin.items():
    dt = parse_dt(r.get("merged_at"))
    if dt is None:
        continue
    age_days = (now - dt).days
    for dim, window in EXPECTED_FRESHNESS_DAYS.items():
        if age_days > window:
            stale_by_dim[dim] += 1
print()
print("  Records past their assumed per-dimension refresh window (master_by_pin merged_at):")
for dim in DIMENSIONS:
    print(f"    {dim.ljust(16)}: {stale_by_dim.get(dim, 0)}/{len(master_by_pin)} stale "
          f"(window {EXPECTED_FRESHNESS_DAYS[dim]}d)")
print()
print("  Every dimension reading as fully/mostly 'stale' here is expected until a")
print("  scheduled rebuild job exists -- this is a snapshot pipeline today, rerun by")
print("  hand per city per fix, not a live refresh. That gap is the actual finding.")
