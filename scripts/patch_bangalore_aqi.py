"""
Bangalore air-quality methodology fix (task #57, last of 5 cities this pass).

Bangalore's stored aqi_avg carried only 14 distinct values across 66
pincodes, clustered heavily at 58 and 62 (19 records each) -- a giveaway
of zone-baseline-plus-jitter modelling, not real per-pincode data, same
underlying issue as every other dimension this multi-session pass has
been fixing city by city.

Replaced with the same real, reproducible method every other city in
this pass now uses: each pincode's AQI is the inverse-distance-weighted
mean of its 3 nearest REAL, named KSPCB/CPCB stations (see
scripts/cpcb_stations.py's BANGALORE_STATIONS -- 9 real stations from
KSPCB's own January 2026 monthly CAAQM bulletin), using each pincode's
own centroid coordinate from lib/aslivastu/areaCoords.js.

Score curve: cpcb_stations.aqi_to_score(), identical to
lib/aslivastu/aqi.js's live aqiToScore() -- so a live /api/aqi reading
and this stored snapshot agree on the same AQI.
"""
import json
import re
import sys

sys.path.insert(0, "scripts")
from cpcb_stations import BANGALORE_STATIONS, idw_aqi, aqi_to_score, aqi_category

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"
COORDS_PATH = "lib/aslivastu/areaCoords.js"

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

json.dump(nqi, open("/tmp/blr_aqi_nqi_backup.json", "w"))
json.dump(master, open("/tmp/blr_aqi_master_backup.json", "w"))

changed_nqi = 0
missing_coord = []
aqi_diffs = []

for e in nqi:
    if e.get("city") != "Bangalore":
        continue
    pin = e["pin_code"]
    if pin not in COORDS:
        missing_coord.append(pin)
        continue
    lat, lon = COORDS[pin]
    new_aqi, station, km = idw_aqi(lat, lon, BANGALORE_STATIONS)
    new_aqi = round(new_aqi)
    if "air" not in e["scores"]:
        continue
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
    if e.get("city") != "Bangalore":
        continue
    pin = e["pin_code"]
    if pin not in COORDS:
        continue
    lat, lon = COORDS[pin]
    new_aqi, station, km = idw_aqi(lat, lon, BANGALORE_STATIONS)
    new_aqi = round(new_aqi)
    e["aqi_avg"] = float(new_aqi)
    e["aqi_category"] = aqi_category(new_aqi)
    changed_master += 1

json.dump(nqi, open(NQI_PATH, "w"), indent=2)
json.dump(master, open(MASTER_PATH, "w"), indent=2)

print(f"nqi_scores.json: {changed_nqi} Bangalore records updated (air dimension)")
print(f"master_by_pin.json: {changed_master} Bangalore records updated (aqi_avg/aqi_category)")
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
