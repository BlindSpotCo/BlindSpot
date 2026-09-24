#!/usr/bin/env python3
"""
One-time patch: recomputes crime_percentile and crime_tier for every
record in nqi_scores.json, deriving them directly from that record's own
scores.crime rank within its city, instead of from a separately-jittered
total_cognizable_crimes count.

ROOT CAUSE (found while investigating a user report that Whitefield,
Bangalore, 560066, showed "Safety 75/100" next to "safer than 18% of
areas, Very High crime tier"):

1. Structural, present in all 7 cities: crime_percentile/crime_tier were
   computed as a within-city rank of total_cognizable_crimes, then shown
   next to scores.crime, an absolute 0-100 measure. A within-city
   percentile always stretches whatever it is given across the full
   0-100 range, so a pincode with a perfectly decent absolute score can
   still land at the bottom of its own city's narrow distribution and
   get labelled "Very High crime, safer than 0%". Confirmed even in
   Chandigarh, where scores.crime and total_cognizable_crimes correlate
   at r=-0.98: 11 of its 20 pincodes still showed a >25-point gap between
   score and percentile, purely from this stretching effect.

2. Amplifying, present in Mumbai/Hyderabad/Chennai/Ahmedabad/Bangalore's
   own patch_bangalore_crime.py: crimes_for() adds an independent +/-40
   jitter (a different, unrelated salt) on top of the score-derived
   count. That is worth +/-8 points of pure noise at this formula's own
   5-crimes-per-point slope, comparable to or larger than the real zone
   signal, which further decorrelates the count's rank from the score's
   own rank. This is why these 5 cities show weaker score-to-count
   correlation (0.67-0.80) than Delhi NCR or Chandigarh (0.98), and why
   Whitefield's own _provenance.crime note documents the damage directly:
   score moved 72 -> 75 (basically unchanged) while percentile collapsed
   51 -> 18 and tier flipped Moderate -> Very High, from jitter alone.

FIX: crime_percentile and crime_tier become a strict, monotonic function
of scores.crime's own rank among that city's pincodes. Since both numbers
now derive from the exact same value, score and tier can no longer
contradict each other, by construction, regardless of which city or
which crime-count methodology produced the original score.
total_cognizable_crimes is untouched -- it is already honestly disclosed
in _provenance as a low-confidence modelled relative estimate, and this
patch does not change what generated it, only what crime_percentile /
crime_tier are computed FROM.

SEPARATE FIX, Bangalore only: patch_bangalore_crime.py (this same
session, v1.12) updated total_cognizable_crimes in master_by_pin.json but
never wrote the same field into nqi_scores.json, leaving nqi's own copy
stale at its pre-patch value. Whitefield's own two files disagreed with
each other (master: 265, nqi: 360). This patch copies master's current
value into nqi for every Bangalore record so a record's own two files
agree with each other again.

Does NOT touch: nqi_composite or grade (crime_percentile/crime_tier are
display-only fields, never part of the weighted composite -- only
scores.crime is), scores.crime itself, or total_cognizable_crimes in
master_by_pin.json.
"""
import json
import shutil
from collections import defaultdict
from datetime import date

MASTER_PATH = "data/aslivastu/master_by_pin.json"
NQI_PATH = "data/aslivastu/nqi_scores.json"
TODAY = date.today().isoformat()

for path in (MASTER_PATH, NQI_PATH):
    shutil.copy(path, path + ".v116_backup")

master = json.load(open(MASTER_PATH, encoding="utf-8"))
nqi = json.load(open(NQI_PATH, encoding="utf-8"))
master_by_pin = {m["pin_code"]: m for m in master}


def tier_for(pct):
    return ("Very Low" if pct >= 80 else "Low" if pct >= 60
            else "Moderate" if pct >= 40 else "High" if pct >= 20 else "Very High")


# ---- Part 1: crime_percentile / crime_tier, derived from scores.crime ----
by_city = defaultdict(list)
for e in nqi:
    if e.get("crime_percentile") is None:
        continue
    by_city[e["city"]].append(e)

changed = []
for city, rows in by_city.items():
    all_scores = sorted(r["scores"]["crime"] for r in rows)
    n = len(all_scores)
    for r in rows:
        this_score = r["scores"]["crime"]
        rank_worse = sum(1 for s in all_scores if s < this_score)
        pct = round(rank_worse / n * 100)
        tier = tier_for(pct)

        old_pct = r.get("crime_percentile")
        old_tier = r.get("crime_tier")
        if old_pct == pct and old_tier == tier:
            continue

        r["crime_percentile"] = pct
        r["crime_tier"] = tier
        r.setdefault("_provenance", {})["crime_percentile"] = {
            "value": pct,
            "source_id": "internal-recompute",
            "method": "Rank of this record's own scores.crime among all scores.crime values for the same city "
                      "(percentage of areas with a strictly lower score, i.e. worse). Previously ranked "
                      "total_cognizable_crimes instead, a separately-modelled, independently-jittered figure that "
                      "could rank very differently from the score shown right next to it.",
            "as_of": TODAY,
            "confidence": "high",
            "note": f"Fixes a score-vs-percentile contradiction (e.g. Bangalore 560066 Whitefield showed "
                    f"'Safety 75/100' next to 'safer than 18%, Very High crime tier'). Old percentile={old_pct!r} "
                    f"tier={old_tier!r} -> new percentile={pct!r} tier={tier!r}. scores.crime ({this_score}) is "
                    f"unchanged; only the derived rank is corrected.",
        }
        changed.append((city, r["pin_code"], this_score, old_pct, pct, old_tier, tier))

# ---- Part 2: Bangalore master/nqi total_cognizable_crimes desync ----
desync_fixed = []
for r in nqi:
    if r.get("city") != "Bangalore":
        continue
    m = master_by_pin.get(r["pin_code"])
    if m is None:
        continue
    nqi_val = r.get("total_cognizable_crimes")
    master_val = m.get("total_cognizable_crimes")
    if nqi_val != master_val:
        r["total_cognizable_crimes"] = master_val
        r.setdefault("_provenance", {})["total_cognizable_crimes"] = {
            "value": master_val,
            "source_id": "internal-sync",
            "method": "Copied from this pincode's own master_by_pin.json record. patch_bangalore_crime.py "
                      "(v1.12, this session) updated total_cognizable_crimes in master_by_pin.json but never "
                      "wrote the same field into nqi_scores.json, leaving this file's own copy stale at its "
                      "pre-patch value.",
            "as_of": TODAY,
            "confidence": "high",
            "note": f"nqi_scores.json's own total_cognizable_crimes disagreed with master_by_pin.json's for the "
                    f"same pincode. Old (stale) value here: {nqi_val!r}. Now matches master: {master_val!r}.",
        }
        desync_fixed.append((r["pin_code"], nqi_val, master_val))

with open(NQI_PATH, "w", encoding="utf-8") as f:
    json.dump(nqi, f, indent=2, ensure_ascii=False)

print(f"crime_percentile/crime_tier corrected: {len(changed)} record(s)")
by_c = defaultdict(int)
for city, *_ in changed:
    by_c[city] += 1
for city, n in by_c.items():
    print(f"  {city}: {n}")

print()
print(f"Bangalore total_cognizable_crimes desync fixed: {len(desync_fixed)} record(s)")
for pin, old, new in desync_fixed[:10]:
    print(f"  {pin}: {old} -> {new}")
if len(desync_fixed) > 10:
    print(f"  ... and {len(desync_fixed) - 10} more")

print()
print("Sample corrections (city, pin, score, old_pct->new_pct, old_tier->new_tier):")
for city, pin, score, old_pct, pct, old_tier, tier in changed[:10]:
    print(f"  {city} {pin}: score={score} {old_pct}->{pct} {old_tier!r}->{tier!r}")
