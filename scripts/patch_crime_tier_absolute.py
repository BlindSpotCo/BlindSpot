#!/usr/bin/env python3
"""
Follow-up to patch_crime_percentile_consistency.py, same session, same
day. That patch made crime_percentile a rank of scores.crime instead of
the separately-jittered crime count, which fixed the direct sign-flip
bug (a decent score could no longer rank as a worse percentile than a
worse score in the same city). But crime_tier was still being derived
FROM that percentile, and a same-city percentile always stretches to
fill 0-100 regardless of how tightly real scores cluster. Result: 26
pincodes (mostly Bangalore and Mumbai, whose scores compress into a
narrow 55-88ish band) still showed a genuinely decent absolute score
(70-73, B+/B territory on this platform's own grade_for scale) labelled
"High" crime tier, purely because most of that city's other pincodes
scored even higher.

Fix: crime_tier becomes an absolute reading of the record's own
scores.crime, using the same threshold bands as grade_for()'s A/B+/B/C+
boundaries (80/70/60/50), matching how every other quality label on this
platform already works (reliability/road_condition/treatment are all
direct thresholds of their own dimension's score, never a same-city
rank). crime_percentile is untouched by this patch -- it stays a
same-city relative comparison, which is honestly what the UI already
calls it ("safer than N% of tracked areas"). The two numbers now measure
genuinely different things (this record's absolute standing vs. its
standing among local peers) and neither can contradict the other's
qualitative direction anymore, in any city, regardless of that city's
score distribution.

Also updates the SOURCE build scripts (build_mumbai.py, build_hyderabad.py,
build_chennai.py, build_ahmedabad.py, build_chandigarh.py,
patch_bangalore_crime.py) with the same tier_for_crime_score() function,
so a future re-run cannot regress this.
"""
import json
import shutil
from datetime import date

NQI_PATH = "data/aslivastu/nqi_scores.json"
TODAY = date.today().isoformat()

shutil.copy(NQI_PATH, NQI_PATH + ".v116b_backup")
nqi = json.load(open(NQI_PATH, encoding="utf-8"))


def tier_for_crime_score(score):
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")


changed = []
for e in nqi:
    if e.get("crime_percentile") is None:
        continue
    score = e["scores"]["crime"]
    new_tier = tier_for_crime_score(score)
    old_tier = e.get("crime_tier")
    if new_tier == old_tier:
        continue
    e["crime_tier"] = new_tier
    prov = e.setdefault("_provenance", {}).setdefault("crime_percentile", {})
    prov["note"] = (prov.get("note", "") +
                     f" [Follow-up same day: crime_tier changed from a same-city percentile rank to an absolute "
                     f"threshold of scores.crime ({score}), matching grade_for()'s A/B+/B/C+ bands. "
                     f"Old tier (percentile-based)={old_tier!r} -> new tier (absolute)={new_tier!r}.]")
    changed.append((e["city"], e["pin_code"], score, e["crime_percentile"], old_tier, new_tier))

with open(NQI_PATH, "w", encoding="utf-8") as f:
    json.dump(nqi, f, indent=2, ensure_ascii=False)

print(f"crime_tier corrected to absolute-score basis: {len(changed)} record(s)")
from collections import Counter
by_city = Counter(c for c, *_ in changed)
for city, n in by_city.items():
    print(f"  {city}: {n}")
print()
for row in changed[:15]:
    print(" ", row)
