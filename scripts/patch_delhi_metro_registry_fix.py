#!/usr/bin/env python3
"""
One-time patch: applies the corrected DELHI_STATIONS coordinates (just
fixed in scripts/metro_stations.py) to master_by_pin.json's Delhi NCR
metro_stations_nearby field.

BACKGROUND: the pre-monetization audit's Ahmedabad-adjacent re-check found
that DELHI_STATIONS had far more duplicate-coordinate groups than the
CHANGELOG previously documented (11 groups, not 2). Two were already known
and worked around at the pincode level without fixing the registry itself
(the Noida Sector 34/52/59/61/62 + Old Faridabad cluster, and the 11-station
Gurugram Rapid Metro cluster). Nine more turned up on closer inspection:
five real-but-misplaced stations (Noida Sector 142/144/145/147/148), three
more (Delta 1 / Depot / GNIDA Office, Greater Noida) that were genuinely
close together but still individually wrong, a NSEZ Noida / Noida Sector 50
pair, and Terminal 1 IGI Airport wrongly carrying Sadar Bazar Cantonment's
real coordinate. Three other pairs (Dwarka Sector 21's duplicate entry,
New Delhi / New Delhi-Airport Express, Inderlok / Inderlok Conn:Red) were
individually verified as genuinely co-located, real interchanges or the
same physical station, and were left alone.

Every corrected coordinate was independently sourced this pass (mostly
Wikipedia station infoboxes, cross-checked against Mappls/OSM and against
each station's geographic position relative to its known neighbours on the
same line) before being written into metro_stations.py.

Re-running the same centroid-radius join (1.5km, the architecture doc's
declared default for this interim method) with the corrected registry
against all 86 Delhi NCR pincodes changes exactly 5 pincodes' counts.
Two are new gains from stations that were previously mislocated far away
(121001 gains Old Faridabad, 201304 gains Noida Sector 142, 110037 gains
Terminal 1 IGI Airport). Two are corrections of real overcounts caused by
phantom duplicate entries (110006 Chandni Chowk drops from 6 to 4, losing
Sarai and South Extension, both real stations that were sitting nowhere
near Old Delhi; 122002 Cyber City drops from 11 to 5, losing 6 of the 11
Gurugram Rapid Metro stations that are not actually within 1.5km of it,
once each station has its own real position instead of one shared point).

Same standing as every earlier metro fix this session (scripts/patch_metro.py):
this only touches metro_stations_nearby and its _provenance entry.
nqi_scores.json's infrastructure score and nqi_composite are deliberately
NOT recomputed, because Delhi NCR has no reproducible build-script formula
tying infra_score_raw to metro_stations_nearby (same reasoning
patch_metro.py already documented for this exact city).
"""
import json
import re
import math
import shutil
from datetime import date

MASTER_PATH = "data/aslivastu/master_by_pin.json"
AREA_COORDS_PATH = "lib/aslivastu/areaCoords.js"
METRO_STATIONS_PATH = "scripts/metro_stations.py"
TODAY = date.today().isoformat()


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


areacoords = open(AREA_COORDS_PATH, encoding="utf-8").read()
coords = {m.group(1): (float(m.group(2)), float(m.group(3)))
          for m in re.finditer(r'"(\d{6})":\s*\[([\d.]+),\s*([\d.]+)\]', areacoords)}

content = open(METRO_STATIONS_PATH, encoding="utf-8").read()
m2 = re.search(r"DELHI_STATIONS\s*=\s*\[(.*?)\n\]", content, re.S)
entries = re.findall(r'\(["\']([^"\']+)["\'],\s*([\d.]+),\s*([\d.]+)[^)]*\)', m2.group(1))
stations = [(n, float(la), float(lo)) for n, la, lo in entries]

shutil.copy(MASTER_PATH, MASTER_PATH + ".v115_backup")
master = json.load(open(MASTER_PATH, encoding="utf-8"))

changed = []
for r in master:
    if r.get("city") != "Delhi NCR":
        continue
    pin = r["pin_code"]
    if pin not in coords:
        continue
    plat, plon = coords[pin]
    near = [(n, round(haversine_km(plat, plon, slat, slon), 3))
            for n, slat, slon in stations if haversine_km(plat, plon, slat, slon) <= 1.5]
    near.sort(key=lambda x: x[1])
    new_count = len(near)
    old_count = r.get("metro_stations_nearby")
    if new_count == old_count:
        continue
    r["metro_stations_nearby"] = new_count
    r.setdefault("_provenance", {})["metro_stations_nearby"] = {
        "value": new_count,
        "source_id": "dmrc_stations_2026_09_registry_fix",
        "method": "spatial_join_radius_1500m_centroid",
        "as_of": TODAY,
        "confidence": "high",
        "note": f"Re-run after fixing 28 wrong/duplicated coordinates in scripts/metro_stations.py's "
                f"DELHI_STATIONS (pre-monetization audit follow-up: the registry had 11 groups of stations "
                f"sharing an identical placeholder coordinate, only 2 of which were previously documented and "
                f"worked around at the pincode level; the other 9 were found and fixed this pass). "
                f"Stations within 1.5km of this pin's own centroid: {', '.join(n for n, d in near) or 'none'}. "
                f"Old value: {old_count!r}.",
    }
    changed.append((pin, old_count, new_count, [n for n, d in near]))

with open(MASTER_PATH, "w", encoding="utf-8") as f:
    json.dump(master, f, indent=2, ensure_ascii=False)

print(f"{len(changed)} Delhi NCR pincodes updated:")
for pin, old, new, names in changed:
    print(f"  {pin}: {old} -> {new}  ({', '.join(names)})")
