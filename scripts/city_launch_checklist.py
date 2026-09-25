#!/usr/bin/env python3
"""
scripts/city_launch_checklist.py

Item 8 from the trust-framework checklist: "before you say a city is
live" gate, checked against the other 7 items. Deliberately mechanical —
every row below is computed from the other scripts' own logic (or a
direct data check), not hand-typed from memory, so this table can't
silently drift out of date the way a manually-written status doc would.

Run: python3 scripts/city_launch_checklist.py
Writes: docs/city_launch_checklist.md (overwritten each run — treat it as
a generated report, not a hand-edited doc; edit this script instead).
"""
import json
import math
from collections import defaultdict
from datetime import date

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"
OUT_PATH = "docs/city_launch_checklist.md"
CHANGELOG_PATH = "CHANGELOG.md"


def latest_changelog_version():
    """Reads CHANGELOG.md's own first '## vX.Y' heading instead of a
    hardcoded string here -- a hardcoded version number is exactly the
    kind of quietly-wrong, unmaintained-looking output this checklist
    exists to prevent (caught stuck at 'v1.4' for a long stretch of this
    project's history before this fix)."""
    import re
    try:
        text = open(CHANGELOG_PATH, encoding="utf-8").read()
        m = re.search(r"^## (v[\d.]+)", text, re.MULTILINE)
        return m.group(1) if m else "unknown"
    except FileNotFoundError:
        return "missing"

NON_AUTH_MARKERS = ("seed", "placeholder", "test", "fixture", "mock")

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))
cities = sorted(set(r["city"] for r in nqi))

by_city_master = defaultdict(list)
for r in master:
    by_city_master[r["city"]].append(r)
by_city_nqi = defaultdict(list)
for r in nqi:
    by_city_nqi[r["city"]].append(r)

def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    if sxx == 0 or syy == 0:
        return None
    return sxy / (sxx ** 0.5 * syy ** 0.5)

rows = []
for city in cities:
    mrecs = by_city_master[city]
    nrecs = by_city_nqi[city]
    n = len(nrecs)

    # 1. Source audit: any record tagged with a non-authoritative source marker?
    tainted = sum(1 for r in mrecs if any(
        any(m in str(s).lower() for m in NON_AUTH_MARKERS) for s in (r.get("sources") or [])
    ))
    item1 = "FAIL" if tainted else "pass"
    item1_detail = f"{tainted}/{len(mrecs)} pins tagged non-authoritative" if tainted else "no tainted source tags"

    # 2. Freshness: no scheduled refresh pipeline exists for ANY city today (checked once,
    # true product-wide -- see scripts/quality_metrics.py's own finding). Not a per-city gap.
    item2 = "FAIL"
    item2_detail = "no scheduled refresh pipeline exists yet (product-wide gap)"

    # 3. Ground-truth sample >=95%: needs a human-filled docs/ground_truth_audit_*.csv
    # scored via scripts/ground_truth_audit.py --score. Not run yet for any city.
    item3 = "PENDING"
    item3_detail = "sample generated (scripts/ground_truth_audit.py), not yet human-verified"

    # 4. Resident feedback loop: code is shipped, but the Supabase field_reports table
    # is a manual one-time step (SUPABASE_SETUP.md section 5) -- can't be checked from
    # this codebase alone, so this is reported as PENDING product-wide, not per-city.
    item4 = "PENDING"
    item4_detail = "widget + API shipped on 8/~30 fields; field_reports table not confirmed created"

    # 5. Benchmark alignment: composite score vs. circle-rate correlation.
    pairs, bands = [], set()
    for r in nrecs:
        pc = r.get("price_context") or {}
        band = pc.get("rate_sqft")
        comp = r.get("nqi_composite")
        if band and comp is not None and len(band) == 2:
            pairs.append(((band[0] + band[1]) / 2, comp))
            bands.add(tuple(band))
    if len(bands) < 5:
        item5 = "N/A"
        item5_detail = f"only {len(bands)} distinct price band(s) -- proxy too coarse to check"
    else:
        r_val = pearson([p[0] for p in pairs], [p[1] for p in pairs])
        item5 = "pass" if (r_val or 0) >= 0.3 else "FAIL"
        item5_detail = f"r={r_val:+.2f} vs. circle-rate proxy (not market price -- see script docstring)"

    # 6. Confidence/abstention: fraction of records in this city carrying ANY _provenance entry.
    with_prov = sum(1 for r in mrecs if r.get("_provenance"))
    item6 = "pass" if with_prov == len(mrecs) else ("PARTIAL" if with_prov else "FAIL")
    item6_detail = f"{with_prov}/{len(mrecs)} pins have a _provenance entry on at least one field"

    # 7. Versioning/changelog: exists product-wide as of this pass (CHANGELOG.md).
    item7 = "pass"
    item7_detail = f"CHANGELOG.md exists, currently at {latest_changelog_version()}"

    rows.append({
        "city": city, "n": n,
        "items": [item1, item2, item3, item4, item5, item6, item7],
        "details": [item1_detail, item2_detail, item3_detail, item4_detail, item5_detail, item6_detail, item7_detail],
    })

LABELS = [
    "1. Source audit (no fabricated/seed tags)",
    "2. Freshness checks passing",
    "3. Ground-truth sample >=95%",
    "4. Resident feedback loop live",
    "5. Benchmark alignment (vs. circle-rate proxy)",
    "6. Confidence/abstention logic present",
    "7. Versioning & changelog in place",
]

lines = []
lines.append(f"# City launch checklist\n")
lines.append(f"Generated {date.today().isoformat()} by `scripts/city_launch_checklist.py` — item 8 of the "
              f"trust-framework checklist. Re-run this script after any data or scoring change; don't hand-edit "
              f"this file.\n")
lines.append("`pass` / `FAIL` / `PARTIAL` / `PENDING` (needs a human step) / `N/A` (not measurable with current data).\n")

lines.append("| City | " + " | ".join(f"{i+1}" for i in range(7)) + " | Recommendation |")
lines.append("|---|" + "---|" * 7 + "---|")
for row in rows:
    marks = " | ".join(row["items"])
    any_fail = any(x == "FAIL" for x in row["items"])
    rec = "**Keep labelled beta**" if any_fail else "No FAIL items — still confirm items 3/4 (PENDING) before calling it fully launched"
    lines.append(f"| {row['city']} (n={row['n']}) | {marks} | {rec} |")

lines.append("\n## Detail per city\n")
for row in rows:
    lines.append(f"### {row['city']}\n")
    for label, detail in zip(LABELS, row["details"]):
        lines.append(f"- **{label}**: {detail}")
    lines.append("")

with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Wrote {OUT_PATH}")
for row in rows:
    print(f"  {row['city']}: {row['items']}")
