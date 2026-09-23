#!/usr/bin/env python3
"""
One-time patch: recomputes the `grade` field for every nqi_scores.json
record whose current grade does not match what the CANONICAL grade_for()
function (used consistently by scripts/build_chennai.py, build_hyderabad.py,
build_mumbai.py, build_chandigarh.py, and matching the platform's own live
grade distribution) would produce for that record's existing nqi_composite.

Root cause: scripts/patch_delhi_power.py, patch_delhi_aqi.py,
patch_bangalore_power.py, patch_bangalore_aqi.py and patch_bangalore_water.py
each define their own INLINE grade_for() with a different, coarser threshold
scale (A>=80, B>=65, C>=50, D>=35, F else -- no B+/C+ at all) instead of using
the canonical one. Every time one of those 5 scripts ran, it silently
overwrote the `grade` field of every record it touched using that wrong
scale, even though nqi_composite itself was computed and stored correctly.

This is a pure grade-label fix. It does NOT touch nqi_composite, scores,
weights_applied, or any other field, the underlying score data is not in
question, only the letter grade derived from it. Found while investigating
pincode 123106 (task 4 of the pre-monetization audit punch list); the scope
turned out to be much larger than that single pincode; 106 of 343 records
across Delhi NCR (59) and Bangalore (47) are affected. Mumbai, Hyderabad,
Chandigarh and Chennai are untouched, since none of their build/patch
scripts ever used the inconsistent inline function.
"""
import json
import sys
import shutil
from datetime import date

PATH = sys.argv[1]
BACKUP = PATH + ".v111_backup"
TODAY = date.today().isoformat()

shutil.copy(PATH, BACKUP)
data = json.load(open(PATH, encoding="utf-8"))


def canonical_grade_for(n):
    if n >= 80:
        return "A"
    if n >= 70:
        return "B+"
    if n >= 60:
        return "B"
    if n >= 50:
        return "C+"
    if n >= 40:
        return "C"
    return "D"


changed = []
for e in data:
    composite = e.get("nqi_composite")
    grade = e.get("grade")
    if composite is None or grade is None:
        continue
    correct = canonical_grade_for(composite)
    if correct != grade:
        changed.append((e["pin_code"], e.get("city"), composite, grade, correct))
        e["grade"] = correct
        e.setdefault("_provenance", {})["grade"] = {
            "value": correct,
            "source_id": "internal-recompute",
            "method": "canonical grade_for(nqi_composite) threshold scale (A>=80, B+>=70, B>=60, C+>=50, C>=40, D else), "
                      "the same function used by build_chennai.py/build_hyderabad.py/build_mumbai.py/build_chandigarh.py "
                      "and matching the platform's live grade distribution",
            "as_of": TODAY,
            "confidence": "high",
            "note": f"Corrects a grade-label bug: this record's grade was last overwritten by a patch script "
                    f"(patch_delhi_power.py / patch_delhi_aqi.py / patch_bangalore_power.py / patch_bangalore_aqi.py / "
                    f"patch_bangalore_water.py) using an inconsistent inline grade_for() with coarser thresholds "
                    f"(A>=80, B>=65, C>=50, D>=35, F else, no B+/C+). nqi_composite ({composite}) was already correct "
                    f"and is unchanged; only the derived letter grade is corrected here, from {grade!r} to {correct!r}.",
        }

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Backup written to {BACKUP}")
print(f"{len(changed)} record(s) had their grade corrected:")
by_city = {}
for pin, city, comp, old, new in changed:
    by_city.setdefault(city, []).append((pin, comp, old, new))
for city, rows in by_city.items():
    print(f"\n{city}: {len(rows)} corrected")
    for pin, comp, old, new in rows[:5]:
        print(f"  {pin}: composite={comp} grade {old!r} -> {new!r}")
    if len(rows) > 5:
        print(f"  ... and {len(rows) - 5} more")
