#!/usr/bin/env python3
"""
scripts/ground_truth_audit.py

Item 3 from the trust-framework checklist: "Select a validation set of
10-20 neighbourhoods you or trusted partners know well... compare your
crime/AQI/water/power/infrastructure scores against official portals and
on-ground experience... report accuracy with a confidence interval."

This script can't do the actual verification -- that step is inherently
human (you, an advisor, a local broker, someone who's actually walked
the area). What it does is the mechanical half: pick a defensible random
sample, lay out exactly what to check and against what, and turn a
filled-in verdict column into the measured percentage the checklist asks
for, so "we think we're ~85%" can become a real number with a source.

USAGE
  Generate a sample to audit (15 pins per city by default):
    python3 scripts/ground_truth_audit.py --generate --per-city 15 --seed 42

  This writes docs/ground_truth_audit_<date>.csv with columns to fill in
  by hand: `verified_ok` (y/n/partial) per checked field, plus a free-text
  `notes` column. Verify each row against the source named in
  `check_against` -- official portals where one exists (CPCB, DMRC/
  station registries, state DISCOM/water-board sites) and on-the-ground
  knowledge otherwise (the checklist's own "commute, outages, visible
  infrastructure" test) -- then re-run:

    python3 scripts/ground_truth_audit.py --score docs/ground_truth_audit_<date>.csv

  which reports % accuracy with a binomial 95% CI, per field and overall,
  the exact form the checklist asks for ("96.4% +/- 1.7%, measured").

Sampling is a fixed-seed random.sample over EVERY pin BlindSpot scores
(not just ones a specific person happens to already know), because a
sample chosen for familiarity is a biased sample -- it only checks the
areas the tester was already confident about, which is exactly the
subset least likely to surface something the model gets wrong. Cross a
random pick against colleagues/advisors/local brokers per the checklist,
rather than swapping the pick itself for a convenient one.
"""
import argparse
import csv
import json
import math
import random
from datetime import date

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"

FIELDS_TO_CHECK = [
    ("total_cognizable_crimes", "Police district FIR/crime data (state police portal or NCRB); "
                                 "note this is district-level, not pincode-exact, per the "
                                 "architecture doc's own finding -- verify the DISTRICT figure, "
                                 "not an expectation of pincode precision."),
    ("aqi_avg", "CPCB / state pollution board site (cpcb.nic.in, or the nearest named station "
                "in scripts/cpcb_stations.py) for a same-week reading."),
    ("metro_stations_nearby", "Official operator map (DMRC/BMRCL/MMRDA/L&TMRHL) or Google Maps "
                              "walking-distance check from the pin's approximate centroid."),
    ("discom", "State DISCOM service-area map, or a utility bill from someone in the area."),
    ("supply_hours", "Municipal water board's own published ward timing, or resident report."),
    ("road_condition", "On-ground: has anyone on the team or a local contact actually seen "
                        "these roads recently?"),
]

def load_records():
    nqi = json.load(open(NQI_PATH))
    master = {str(r.get("pin_code")): r for r in json.load(open(MASTER_PATH))}
    merged = []
    for r in nqi:
        pin = str(r.get("pin_code"))
        combined = {**r, **master.get(pin, {})}
        merged.append(combined)
    return merged

def load_pin_names():
    try:
        src = open("lib/aslivastu/pinMeta.js", encoding="utf-8").read()
    except FileNotFoundError:
        return {}
    import re
    names = {}
    for m in re.finditer(r'"(\d{6})":\{\s*name:"([^"]*)"', src):
        names[m.group(1)] = m.group(2)
    return names

def cmd_generate(args):
    records = load_records()
    names = load_pin_names()
    by_city = {}
    for r in records:
        by_city.setdefault(r["city"], []).append(r)

    rng = random.Random(args.seed)
    sample = []
    for city, recs in sorted(by_city.items()):
        k = min(args.per_city, len(recs))
        sample.extend(rng.sample(recs, k))

    out_path = f"docs/ground_truth_audit_{date.today().isoformat()}.csv"
    fieldnames = (
        ["city", "pin_code", "area_name", "nqi_composite", "grade"]
        + [f[0] for f in FIELDS_TO_CHECK]
        + ["check_against_reference (see script header for detail per column)"]
        + [f"{f[0]}__verified_ok(y/n/partial)" for f in FIELDS_TO_CHECK]
        + ["notes"]
    )
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in sample:
            row = {
                "city": r["city"],
                "pin_code": r["pin_code"],
                "area_name": names.get(str(r["pin_code"]), ""),
                "nqi_composite": r.get("nqi_composite"),
                "grade": r.get("grade"),
            }
            for field, _ in FIELDS_TO_CHECK:
                row[field] = r.get(field)
                row[f"{field}__verified_ok(y/n/partial)"] = ""
            row["check_against_reference (see script header for detail per column)"] = ""
            row["notes"] = ""
            w.writerow(row)

    print(f"Wrote {len(sample)} rows ({args.per_city}/city x {len(by_city)} cities) to {out_path}")
    print()
    print("What to check per column (also in this script's docstring):")
    for field, how in FIELDS_TO_CHECK:
        print(f"  - {field}: {how}")
    print()
    print("Fill in every *__verified_ok column with y / n / partial, then run:")
    print(f"  python3 scripts/ground_truth_audit.py --score {out_path}")

def wilson_ci(successes, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z ** 2 / n
    centre = p + z ** 2 / (2 * n)
    adj = z * math.sqrt((p * (1 - p) + z ** 2 / (4 * n)) / n)
    return ((centre - adj) / denom, (centre + adj) / denom)

def cmd_score(args):
    with open(args.score, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    per_field = {}
    for field, _ in FIELDS_TO_CHECK:
        col = f"{field}__verified_ok(y/n/partial)"
        vals = [row[col].strip().lower() for row in rows if row.get(col, "").strip()]
        if not vals:
            continue
        y = sum(1 for v in vals if v == "y")
        partial = sum(1 for v in vals if v == "partial")
        n_total = sum(1 for v in vals if v in ("y", "n", "partial"))
        n_checked = sum(1 for v in vals if v in ("y", "n"))  # partial excluded from the strict % but reported
        per_field[field] = (y, n_checked, partial, n_total)

    print("=" * 78)
    print(f"Ground-truth audit results — {args.score}")
    print("=" * 78)
    overall_y, overall_n = 0, 0
    for field, (y, n, partial, n_total) in per_field.items():
        if n == 0:
            print(f"  {field}: no y/n verdicts yet ({partial} marked partial) — skipped")
            continue
        pct = y / n * 100
        lo, hi = wilson_ci(y, n)
        print(f"  {field}: {pct:.1f}% ({y}/{n} strict yes/no; {partial} marked partial, "
              f"95% CI [{lo*100:.1f}%, {hi*100:.1f}%])")
        overall_y += y
        overall_n += n
    print()
    if overall_n:
        pct = overall_y / overall_n * 100
        lo, hi = wilson_ci(overall_y, overall_n)
        verdict = "PASS (>=95%)" if lo * 100 >= 95 else "below the 95% target from item 3 of the checklist"
        print(f"OVERALL: {pct:.1f}% ({overall_y}/{overall_n}), 95% CI [{lo*100:.1f}%, {hi*100:.1f}%] — {verdict}")
    else:
        print("No verdicts filled in yet — nothing to score.")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--generate", action="store_true")
    p.add_argument("--per-city", type=int, default=15)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--score", metavar="CSV_PATH")
    args = p.parse_args()
    if args.score:
        cmd_score(args)
    else:
        cmd_generate(args)
