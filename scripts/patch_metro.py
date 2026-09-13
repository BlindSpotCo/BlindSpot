"""
scripts/patch_metro.py

L1 fix for metro_stations_nearby -- see docs/data-integrity-architecture.md
section 3 ("L1 - Derive, don't store") and scripts/metro_stations.py for
the sourced station registries and method this uses.

SCOPE: Delhi NCR and Bangalore only (86 + 66 = 152 of 309 pins). Mumbai and
Chandigarh and Hyderabad are explicitly untouched:
  - Chandigarh: audited value is already correct (0 everywhere -- Chandigarh
    has no metro), left alone.
  - Mumbai / Hyderabad: no sourced station-coordinate dataset found this
    pass (see metro_stations.py docstring) -- their metro_stations_nearby
    stays at its old, still-broken value rather than being touched without
    a real source. Flagged as a tracked follow-up, not silently dropped.

WHAT THIS CHANGES, per Delhi/Bangalore record in master_by_pin.json:
  - metro_stations_nearby: replaced with a real count of named stations
    within 1.5km of the pin's own AREA_COORDS centroid (the architecture
    doc's own declared default radius for this interim, centroid-based
    method).
  - A new "_provenance" object is added (or extended) on the record, with
    one entry per field this pass touches -- the L0 "provenance envelope"
    from the architecture doc, section 3. This is purely additive: every
    existing field/consumer is untouched, so nothing that reads
    metro_stations_nearby as a plain number breaks.

nqi_scores.json's infrastructure composite score is DELIBERATELY NOT
recomputed in this pass. infra_score_raw is a zone-baseline+jitter formula
per city (see build_mumbai.py's infra_score()) and neither Delhi nor
Bangalore has a real, reproducible version of that formula to begin with
(Delhi has no build script at all; Bangalore's whole dataset was audited
as seed data) -- inventing a new zone-bonus system for either city here
would be exactly the kind of unverified scalar this pass exists to
remove. Recomputing the composite honestly is a separate, larger piece of
work, tracked as a follow-up (same treatment the Delhi AQI rework got:
research done, fix deferred with the reason on record, not shipped as a
guess). This pass fixes the raw fact -- the one an investor can and did
check by hand -- immediately.
"""
import json
import re
import sys
from datetime import date

sys.path.insert(0, "scripts")
from metro_stations import DELHI_STATIONS, BANGALORE_STATIONS, stations_within_radius

MASTER_PATH = "data/aslivastu/master_by_pin.json"
COORDS_PATH = "lib/aslivastu/areaCoords.js"
RADIUS_KM = 1.5
TODAY = date.today().isoformat()

coords_src = open(COORDS_PATH).read()
COORDS = {
    pin: (float(lat), float(lon))
    for pin, lat, lon in re.findall(r'"(\d{6})":\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]', coords_src)
}

CITY_STATIONS = {
    "Delhi NCR": ("dmrc_stations_2026_09", DELHI_STATIONS),
    "Bangalore": ("bmrcl_stations_2026_09", BANGALORE_STATIONS),
}

master = json.load(open(MASTER_PATH))
json.dump(master, open("/tmp/metro_master_backup.json", "w"))

changed = 0
skipped_no_coord = []
deltas = []

for rec in master:
    city = rec.get("city")
    if city not in CITY_STATIONS:
        continue
    pin = str(rec.get("pin_code", ""))
    if pin not in COORDS:
        skipped_no_coord.append(pin)
        continue
    lat, lon = COORDS[pin]
    source_id, stations = CITY_STATIONS[city]
    count, names = stations_within_radius(lat, lon, stations, RADIUS_KM)

    old = rec.get("metro_stations_nearby")
    if old != count:
        deltas.append((city, pin, old, count, names[:6]))
    rec["metro_stations_nearby"] = count

    prov = rec.setdefault("_provenance", {})
    prov["metro_stations_nearby"] = {
        "value": count,
        "source_id": source_id,
        "method": f"spatial_join_radius_{int(RADIUS_KM*1000)}m_centroid",
        "as_of": TODAY,
        "confidence": "high",
        "note": (
            "Centroid-radius count against a real named station registry "
            "(scripts/metro_stations.py). Interim method -- the "
            "architecture doc's own preferred method is a buffered pin "
            "boundary polygon, not a centroid point; boundary geodata "
            "wasn't available this pass."
        ),
    }
    changed += 1

json.dump(master, open(MASTER_PATH, "w"), indent=2, ensure_ascii=False)

print(f"Updated {changed} records (Delhi NCR + Bangalore).")
print(f"Pins with no AREA_COORDS entry, skipped: {skipped_no_coord}")
print(f"Records whose metro_stations_nearby value actually changed: {len(deltas)}")
print()
cp = next((r for r in master if str(r.get('pin_code')) == '110001'), None)
if cp:
    print("PIN 110001 (Connaught Place) after fix:",
          cp.get("metro_stations_nearby"), cp.get("_provenance", {}).get("metro_stations_nearby"))
print()
print("Sample of changed records:")
for city, pin, old, new, names in deltas[:15]:
    print(f"  {city} {pin}: {old} -> {new}  e.g. {names}")
if len(deltas) > 15:
    print(f"  ... and {len(deltas) - 15} more")
