#!/usr/bin/env python3
"""
One-time patch: replaces Chandigarh's flat water_quality/quality_score
(4/5 on all 20 records) with the composite the field's own UI copy
already claims it is: "Composite 1-5 water-quality rating from TDS,
complaints and supply hours" (components/property-score/AVDetailedReadout.js).

Those three inputs (tds_level, complaints_per_1000, supply_hours) are
already real, already-sourced, and already vary per pincode in
master_by_pin.json -- only the composite itself was never actually
computed from them; it shipped as a placeholder constant. This patch
computes it, it does not introduce any new source data.

quality_score is a separate, effectively-vestigial field: the UI's
fallback chains (record.water_quality ?? record.quality_score for Water,
record.road_quality ?? record.quality_score for Roads) never reach it
because every Chandigarh record already carries its own road_quality.
Set to the same value as water_quality here for consistency, since
nothing reads it independently.

Does not touch nqi_scores.json -- the actual "water" score used in the
composite/grade is already computed from supply_hours/coverage_pct/
tds_level independently (confirmed before writing this patch) and was
never flat; only this cosmetic 1-5 display field was.
"""
import json
import shutil
from datetime import date

PATH = "data/aslivastu/master_by_pin.json"
TODAY = date.today().isoformat()

shutil.copy(PATH, PATH + ".v114_backup")
master = json.load(open(PATH, encoding="utf-8"))
chd = [r for r in master if r.get("city") == "Chandigarh"]

TDS_SCORE = {"Low": 5, "Medium": 3, "High": 1}
complaints = [r["complaints_per_1000"] for r in chd]
supply = [r["supply_hours"] for r in chd]
c_lo, c_hi = min(complaints), max(complaints)
s_lo, s_hi = min(supply), max(supply)

changed = []
for r in chd:
    t = TDS_SCORE[r["tds_level"]]
    c_norm = 1 - (r["complaints_per_1000"] - c_lo) / (c_hi - c_lo)
    s_norm = (r["supply_hours"] - s_lo) / (s_hi - s_lo)
    composite = max(1, min(5, round((t / 5 * 0.4 + c_norm * 0.35 + s_norm * 0.25) * 5)))

    old_wq, old_qs = r.get("water_quality"), r.get("quality_score")
    r["water_quality"] = composite
    r["quality_score"] = composite
    r.setdefault("_provenance", {})["water_quality"] = {
        "value": composite,
        "source_id": "internal-derive",
        "method": "Composite of this record's own tds_level (40% weight), complaints_per_1000 (35%, inverted) "
                   "and supply_hours (25%), matching the field's own UI definition. All three inputs are real, "
                   "already-sourced, already per-pincode-varying fields; only the composite itself was never "
                   "actually computed until this patch.",
        "as_of": TODAY,
        "confidence": "high",
        "note": f"Was a flat 4 for all 20 Chandigarh records before this patch (pre-monetization audit, Tier 2). "
                f"Old value: {old_wq!r}.",
    }
    changed.append((r["pin_code"], old_wq, old_qs, composite))

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(master, f, indent=2, ensure_ascii=False)

print(f"{len(changed)} Chandigarh records: water_quality/quality_score recomputed")
from collections import Counter
print("  distribution:", dict(Counter(c for _, _, _, c in changed)))
for pin, old_wq, old_qs, new in changed[:6]:
    print(f"  {pin}: water_quality {old_wq!r} -> {new!r}, quality_score {old_qs!r} -> {new!r}")
