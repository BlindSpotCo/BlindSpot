"""
NOT YET APPLIED -- see the note at the end of this docstring. Written
and tested (produces a valid patch), but deliberately not run against
the data files.

Delhi NCR air-quality methodology fix (task #57, 4th of 5 cities this pass).

Delhi NCR's stored "air" scores/aqi_avg were already reasonably granular
(30 distinct values across 59 scored records) compared to Bangalore's
giveaway 14-value clustering, but their origin before this pass was
never re-derived from a real, reproducible source in this codebase --
there is no build script for Delhi (unlike Mumbai/Hyderabad/Chandigarh),
so whatever produced these numbers originally is lost. This pass
replaces them with the same real, reproducible method every other city
in this pass now uses: each pincode's AQI is the inverse-distance-
weighted mean of its 3 nearest REAL, named CPCB/DPCC/state-board
stations (see scripts/cpcb_stations.py's DELHI_STATIONS -- 47 real
stations spanning Delhi + Gurugram + Noida/Greater Noida + Ghaziabad +
Faridabad, the actual real jurisdictions "Delhi NCR" bundles in this
dataset), using each pincode's own centroid coordinate from
lib/aslivastu/areaCoords.js (the same coordinates the live app's map
pins use).

Score curve: cpcb_stations.aqi_to_score(), identical to
lib/aslivastu/aqi.js's live aqiToScore() -- so a live /api/aqi reading
and this stored snapshot agree on the same AQI.

Pincode 123106 (Dharuhera, Rewari) has no "power" AND no "air" dimension
scored in nqi_scores.json (a pre-existing data-completeness gap, out of
scope for this pass, same note as patch_delhi_power.py) -- its
nqi_scores.json entry is left alone; only its master_by_pin.json display
fields (aqi_avg/aqi_category) are updated since a coordinate exists for
it.

WHY THIS WASN'T APPLIED
Run once against real data: DELHI_STATIONS' readings average to a mean
AQI of ~333 (median 360) across the 49 stations -- because nearly every
reading found was from a pollution-season date (Nov 2025 was a severe
smog episode; the other backup dates -- Jan/Feb/Dec -- are also winter
months). That is much worse than Delhi's commonly-cited ANNUAL average
(roughly 150-220 in most CPCB/State of Global Air/IQAir reporting), so
applying this as-is would have dropped Delhi's composite scores by up
to 21 points (avg -8.6) across 59 records -- a real, sourced, but
seasonally-biased sample presented as if it were representative.
Flagged to the user and reverted rather than shipped; DELHI_STATIONS in
cpcb_stations.py is kept as real, useful research for a follow-up pass
that re-anchors it against real annual-average figures instead of
pollution-season snapshots. Mumbai/Hyderabad/Chandigarh/Bangalore's
station data did not have this seasonal skew and were applied normally.
"""
import json
import re
import sys

sys.path.insert(0, "scripts")
from cpcb_stations import DELHI_STATIONS, idw_aqi, aqi_to_score, aqi_category

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"
COORDS_PATH = "lib/aslivastu/areaCoords.js"

# ── Parse pincode -> [lat, lon] straight out of the JS source of truth,
# rather than maintaining a second copy of these coordinates in Python.
coords_src = open(COORDS_PATH).read()
COORDS = {
    pin: (float(lat), float(lon))
    for pin, lat, lon in re.findall(r'"(\d{6})":\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]', coords_src)
}

def grade_for(c):
    return ("A" if c >= 80 else "B" if c >= 65 else "C" if c >= 50
            else "D" if c >= 35 else "F")

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))

json.dump(nqi, open("/tmp/delhi_aqi_nqi_backup.json", "w"))
json.dump(master, open("/tmp/delhi_aqi_master_backup.json", "w"))

changed_nqi = 0
missing_coord = []
aqi_diffs = []

for e in nqi:
    if e.get("city") != "Delhi NCR":
        continue
    pin = e["pin_code"]
    if pin not in COORDS:
        missing_coord.append(pin)
        continue
    lat, lon = COORDS[pin]
    new_aqi, station, km = idw_aqi(lat, lon, DELHI_STATIONS)
    new_aqi = round(new_aqi)
    if "air" not in e["scores"]:
        continue  # 123106-style gap: no air dimension to update
    old_air = e["scores"]["air"]
    new_air = aqi_to_score(new_aqi)
    e["scores"]["air"] = new_air
    w = e["weights_applied"]
    composite = round(sum(e["scores"][k] * w[k] for k in e["scores"] if k in w))
    old_composite = e["nqi_composite"]
    e["nqi_composite"] = composite
    e["grade"] = grade_for(composite)
    changed_nqi += 1
    aqi_diffs.append((pin, old_air, new_air, old_composite, composite, station, round(km, 1)))

changed_master = 0
for e in master:
    if e.get("city") != "Delhi NCR":
        continue
    pin = e["pin_code"]
    if pin not in COORDS:
        continue
    lat, lon = COORDS[pin]
    new_aqi, station, km = idw_aqi(lat, lon, DELHI_STATIONS)
    new_aqi = round(new_aqi)
    e["aqi_avg"] = float(new_aqi)
    e["aqi_category"] = aqi_category(new_aqi)
    changed_master += 1

json.dump(nqi, open(NQI_PATH, "w"), indent=2)
json.dump(master, open(MASTER_PATH, "w"), indent=2)

print(f"nqi_scores.json: {changed_nqi} Delhi NCR records updated (air dimension)")
print(f"master_by_pin.json: {changed_master} Delhi NCR records updated (aqi_avg/aqi_category)")
print(f"pincodes with no coordinate in areaCoords.js: {missing_coord}")
print()
old_airs = [d[1] for d in aqi_diffs]
new_airs = [d[2] for d in aqi_diffs]
print(f"old air range: {min(old_airs)}-{max(old_airs)} (distinct {len(set(old_airs))})")
print(f"new air range: {min(new_airs)}-{max(new_airs)} (distinct {len(set(new_airs))})")
comp_deltas = [d[4] - d[3] for d in aqi_diffs]
print(f"composite delta range: {min(comp_deltas)} to {max(comp_deltas)}, avg {sum(comp_deltas)/len(comp_deltas):.2f}")
print()
print("sample diffs (pin, old_air -> new_air, old_composite -> new_composite, nearest_station, km):")
for row in aqi_diffs[:8]:
    print(row)
