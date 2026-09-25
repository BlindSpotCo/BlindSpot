#!/usr/bin/env python3
"""
Regression fix: commit 8cd445d ("Map/report flow...") was authored from a
stale local checkout branched before several data-integrity fixes landed
on main, and its merge silently reverted large parts of
data/aslivastu/nqi_scores.json (and other files) back to their pre-fix
state, alongside real, wanted UI work in the same commit. This was pushed
straight to origin/main. A separate commit (e21e899) already restored
Ahmedabad's own addition, but did not address the fact that the SAME
revert also undid:

1. crime_percentile/crime_tier consistency (originally fixed in
   patch_crime_percentile_consistency.py / patch_crime_tier_absolute.py,
   changelog v1.16): reverted back to a same-city percentile-derived tier
   for Delhi NCR, Bangalore, Mumbai, Hyderabad, Chandigarh and Chennai.
2. Bangalore's master/nqi total_cognizable_crimes desync (same v1.16 fix):
   nqi's own copy reverted back to a flat 320 placeholder for all 66
   records, while master_by_pin.json's copy (already correct, varied) was
   untouched by the revert.

This script re-applies both fixes fresh against current data, and checks
every city (including Kolkata, added after the revert, on its own correct
methodology from the start) rather than assuming which cities need it.
scores.crime itself is never touched by this script, only the total_cognizable_crimes
sync and the derived percentile/tier fields.
"""
import json
import shutil
from collections import defaultdict
from datetime import date

MASTER_PATH = "data/aslivastu/master_by_pin.json"
NQI_PATH = "data/aslivastu/nqi_scores.json"
TODAY = date.today().isoformat()

for path in (MASTER_PATH, NQI_PATH):
    shutil.copy(path, path + ".v117_backup")

master = json.load(open(MASTER_PATH, encoding="utf-8"))
nqi = json.load(open(NQI_PATH, encoding="utf-8"))
master_by_pin = {m["pin_code"]: m for m in master}


def tier_for_crime_score(score):
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")


# ---- Part 1: total_cognizable_crimes desync, any city ----
desync_fixed = []
for r in nqi:
    m = master_by_pin.get(r["pin_code"])
    if m is None:
        continue
    nqi_val = r.get("total_cognizable_crimes")
    master_val = m.get("total_cognizable_crimes")
    if nqi_val is not None and master_val is not None and nqi_val != master_val:
        r["total_cognizable_crimes"] = master_val
        r.setdefault("_provenance", {})["total_cognizable_crimes"] = {
            "value": master_val,
            "source_id": "internal-sync",
            "method": "Copied from this pincode's own master_by_pin.json record. Re-synced after commit "
                      "8cd445d's stale-checkout merge reverted nqi_scores.json's own copy back to a stale "
                      "placeholder value while master_by_pin.json's copy (already correct) was untouched.",
            "as_of": TODAY,
            "confidence": "high",
            "note": f"Old (reverted) value here: {nqi_val!r}. Now matches master: {master_val!r}.",
        }
        desync_fixed.append((r["city"], r["pin_code"], nqi_val, master_val))

# ---- Part 2: crime_percentile / crime_tier, derived from scores.crime ----
by_city = defaultdict(list)
for e in nqi:
    if e.get("crime_percentile") is None:
        continue
    by_city[e["city"]].append(e)

tier_changed = []
for city, rows in by_city.items():
    all_scores = sorted(r["scores"]["crime"] for r in rows)
    n = len(all_scores)
    for r in rows:
        this_score = r["scores"]["crime"]
        rank_worse = sum(1 for s in all_scores if s < this_score)
        pct = round(rank_worse / n * 100)
        tier = tier_for_crime_score(this_score)

        old_pct = r.get("crime_percentile")
        old_tier = r.get("crime_tier")
        if old_pct == pct and old_tier == tier:
            continue

        r["crime_percentile"] = pct
        r["crime_tier"] = tier
        r.setdefault("_provenance", {})["crime_percentile"] = {
            "value": pct,
            "source_id": "internal-recompute",
            "method": "Rank of this record's own scores.crime among all scores.crime values for the same city; "
                      "crime_tier is a separate absolute threshold on scores.crime (Very Low>=80, Low>=70, "
                      "Moderate>=60, High>=50, Very High else). Re-applied after commit 8cd445d's stale-checkout "
                      "merge reverted this fix (originally v1.16) back to a same-city-percentile-derived tier.",
            "as_of": TODAY,
            "confidence": "high",
            "note": f"Old percentile={old_pct!r} tier={old_tier!r} -> new percentile={pct!r} tier={tier!r}. "
                    f"scores.crime ({this_score}) is unchanged.",
        }
        tier_changed.append((city, r["pin_code"], this_score, old_pct, pct, old_tier, tier))

with open(MASTER_PATH, "w", encoding="utf-8") as f:
    json.dump(master, f, indent=2, ensure_ascii=False)
with open(NQI_PATH, "w", encoding="utf-8") as f:
    json.dump(nqi, f, indent=2, ensure_ascii=False)

print(f"total_cognizable_crimes desync fixed: {len(desync_fixed)} record(s)")
by_c = defaultdict(int)
for city, *_ in desync_fixed: by_c[city] += 1
for city, n in by_c.items(): print(f"  {city}: {n}")

print()
print(f"crime_percentile/crime_tier corrected: {len(tier_changed)} record(s)")
by_c2 = defaultdict(int)
for city, *_ in tier_changed: by_c2[city] += 1
for city, n in by_c2.items(): print(f"  {city}: {n}")
