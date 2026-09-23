#!/usr/bin/env python3
"""
One-time patch: adds a real, sourced power score to pincode 123106
(Dharuhera, Rewari district, tagged "Delhi NCR"), the one record in the
entire dataset scored on only 2 of 8 dimensions (air, schools) despite
carrying a full composite score and grade (flagged in the pre-monetization
audit, Tier 3, and picked up as task 4 of the resulting punch list).

123106's master_by_pin.json record already has real DHBVN power data
(discom=DHBVN, outage_frequency=2, avg_outage_hours=1.9,
reliability=Excellent), filled in by scripts/patch_delhi_power.py. That
script's own docstring explains why no corresponding nqi_scores.json power
score was ever added: "That pincode has no 'power' dimension scored at all
in nqi_scores.json (a pre-existing data-completeness gap, out of scope for
this pass)". Its own DISCOM_POWER_SCORE table gives DHBVN a power score of
79, and that exact value, run through its own outage_and_reliability()
function, reproduces 123106's current master_by_pin.json display fields
exactly (79 -> 1.9 avg outage hours -> Excellent) -- so this is not new data,
it is finishing a computation that was already done once but never written
to the scores dict it belongs in.

This takes 123106 from 2/8 to 3/8 scored dimensions. The remaining 5
dimensions (crime, infrastructure beyond metro, water, roads, sewerage)
still have no source data for this small industrial Haryana pincode and are
NOT fabricated here; they stay absent, honestly, same as before.

Uses the same weights_base renormalization convention already used for
every other partial-dimension record in this dataset (round(weight / sum of
scored weights, 4)), verified against existing 7-dimension records before
writing this script.
"""
import json
import shutil
from datetime import date

PATH = "data/aslivastu/nqi_scores.json"
BACKUP = PATH + ".v112_backup"
TODAY = date.today().isoformat()

WEIGHTS_BASE = {'crime': 0.25, 'infrastructure': 0.2, 'air': 0.15, 'power': 0.1,
                 'schools': 0.1, 'water': 0.08, 'roads': 0.07, 'sewerage': 0.05}
POWER_SCORE = 79  # DHBVN, from scripts/patch_delhi_power.py's DISCOM_POWER_SCORE table


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


shutil.copy(PATH, BACKUP)
nqi = json.load(open(PATH, encoding="utf-8"))

e = next(x for x in nqi if x["pin_code"] == "123106")
before = {k: e[k] for k in ["dimensions_scored", "scores", "weights_applied", "nqi_composite", "grade"]}

e["scores"]["power"] = POWER_SCORE
scored_dims = list(e["scores"].keys())
base_sum = sum(WEIGHTS_BASE[k] for k in scored_dims)
weights_applied = {k: round(WEIGHTS_BASE[k] / base_sum, 4) for k in scored_dims}
e["weights_applied"] = weights_applied
composite = round(sum(e["scores"][k] * weights_applied[k] for k in scored_dims))
e["nqi_composite"] = composite
e["grade"] = canonical_grade_for(composite)
e["dimensions_scored"] = len(scored_dims)

e.setdefault("_provenance", {})["power"] = {
    "value": POWER_SCORE,
    "source_id": "mop_discom_rating_2026 (DHBVN)",
    "method": "Ministry of Power Integrated Rating & Ranking DISCOM grade, same DISCOM_POWER_SCORE table "
              "scripts/patch_delhi_power.py already applied to every other Delhi NCR pincode",
    "as_of": TODAY,
    "confidence": "high",
    "note": "This pincode's discom (DHBVN) and its display fields (outage_frequency=2, avg_outage_hours=1.9, "
            "reliability=Excellent in master_by_pin.json) were already computed from this exact score by "
            "patch_delhi_power.py, but the score itself was never added to nqi_scores.json, leaving this record "
            "at 2/8 scored dimensions despite carrying a full composite and grade. This patch finishes that "
            "computation; it does not introduce new source data.",
}

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(nqi, f, indent=2, ensure_ascii=False)

print("Backup written to", BACKUP)
print("BEFORE:", json.dumps(before, indent=2))
print()
print("AFTER: dimensions_scored=%d scores=%s weights_applied=%s composite=%d grade=%s" % (
    e["dimensions_scored"], e["scores"], e["weights_applied"], e["nqi_composite"], e["grade"]))
