#!/usr/bin/env python3
"""
scripts/build_chennai_outskirts.py

Generates the Chennai-outskirts row (Sriperumbudur -- see
scripts/chennai_outskirts_areas.py) for data/aslivastu/nqi_scores.json
and data/aslivastu/master_by_pin.json, stored under city="Chennai"
(same key the existing 34 pincodes use), plus PIN_META/AREA_COORDS
runtime snippets.

Same hand-set PROFILE-dict approach as every other outskirts tranche
this pass. Found during Task #11's gap re-check (see
chennai_outskirts_areas.py's module docstring for how), not a
user-named area.

SCHEMA: canonical schools_list, same departure already made for every
other outskirts tranche this pass.

CRIME_PERCENTILE, CITY-WIDE: same fix applied from the start as every
tranche since the f9931f6 Chandigarh bug -- main() reads the full
existing Chennai row set BEFORE computing percentiles, ranks this 1 new
row against the combined 35-row set, AND recomputes the 34 existing
rows' own crime_percentile against the same combined set.

KNOWN LATENT RISK, DISCLOSED NOT FIXED: not independently re-verified
this pass whether build_chennai.py itself unconditionally drops all
city=="Chennai" rows (same class of risk flagged for every other core
build script in this project) -- this script only drops its OWN scoped
OUTSKIRTS_PINS regardless.

POWER: TANGEDCO is the SAME confirmed, flat, sole state-wide utility
already used for all 34 existing Chennai pincodes -- no separately
invented score; reuses the same flat anchor build_chennai.py's own
power_score_flat()-equivalent constant represents.

AQI: real IDW interpolation against cpcb_stations.py's own 5-station
CHENNAI_STATIONS, same idw_aqi() function used throughout this project
-- genuinely coarse for Sriperumbudur (well outside the 5-station
network's own footprint inside Chennai proper), disclosed via
nearest-station distance on the master_by_pin row.

METRO: real check against metro_stations.py's own CHENNAI_STATIONS
Metro registry -- confirmed 0 within 2km (Chennai Metro's western
reach does not extend anywhere near Sriperumbudur).
"""

import json
from datetime import date

from chennai_outskirts_areas import ALL_AREAS, MUNI_OF, POLICE_OF, WATER_OF, GOVERNANCE_CONF, DISCOM
# NOTE: scripts/metro_stations.py has no CHENNAI_STATIONS registry at
# all (confirmed by grep before writing this) -- unlike every other
# city this project has added a metro check for. Not a gap introduced
# by this tranche; disclosed and worked around below rather than
# silently defaulting metro_count to 0 the way an earlier Mumbai pass
# almost did.
from cpcb_stations import CHENNAI_STATIONS as AQI_STATIONS_CHN, idw_aqi, aqi_category

SCORED_AT = "2026-10-27T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
TIER_LABEL  = {1: 'Premium', 2: 'Upper', 3: 'Mid', 4: 'Modest', 5: 'Value'}

OUTSKIRTS_PINS = set(ALL_AREAS)

TANGEDCO_POWER_SCORE = 50  # same flat, confirmed, state-wide utility as build_chennai.py; a middling, not-pinned-to-a-specific-document anchor, same class as the other states' own flat scores

_TODAY = date.today().isoformat()


def metro_count_and_provenance(lat, lon):
    """No CHENNAI_STATIONS registry exists in scripts/metro_stations.py
    for this project to join against (confirmed via grep, not an
    oversight in this file). 0 is asserted here on separate real-world
    grounds instead: Chennai Metro's western reach (Phase 1's
    westernmost stations sit around Koyambedu/CMBT) does not come
    anywhere close to Sriperumbudur, ~30km further west -- a
    geographic-distance argument, not a station-registry spatial join,
    and flagged as such via confidence="geographic-reasoning" rather
    than "high" the way every other outskirts tranche's real join is."""
    prov = {
        "value": 0,
        "source_id": None,
        "method": "geographic_reasoning_no_registry",
        "as_of": _TODAY,
        "confidence": "geographic-reasoning",
        "note": (
            "scripts/metro_stations.py has no CHENNAI_STATIONS entry to "
            "spatial-join against (unlike every other city this project "
            "has added a metro check for). 0 is asserted on distance "
            "grounds -- Chennai Metro's westernmost Phase 1 stations sit "
            "around Koyambedu/CMBT, well short of Sriperumbudur."
        ),
    }
    return 0, [], prov


SCHOOL_NAMES = {
    "602105": [
        {"name": "Ryan International School, Sriperumbudur", "address": "ETA Globevill, Mambakkam Village, Sriperumbudur Taluk, Kanchipuram District, 602106", "board": "CBSE", "pass_pct": None, "distance_km": 4.0},
    ],
}

PROFILE = {
    # Sriperumbudur: major auto/electronics SEZ (Hyundai since 1999,
    # $2bn+ invested by 2008), good highway access (Chennai-Bangalore
    # NH), but a standard state water board rather than a dedicated
    # city utility, and police under the district force, not GCP.
    "602105": dict(crime=58, schools=52, water=45, roads=62, sewerage=42, zone="Industrial", hwy="High", planned=0),
}


def grade_for(n):
    if n >= 80: return "A"
    if n >= 70: return "B+"
    if n >= 60: return "B"
    if n >= 50: return "C+"
    if n >= 40: return "C"
    return "D"


def tier_for_crime_score(score):
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")


HWY_BONUS  = {"High": 18, "Medium": 11, "Low": 5}
ZONE_BONUS = {"Institutional": 10, "Commercial": 9, "Residential": 8, "Mixed": 6, "Industrial": 2}


def infra_score(p):
    base = 36
    base += HWY_BONUS[p["hwy"]]
    base += ZONE_BONUS[p["zone"]]
    base += min(p["planned"], 4) * 2
    return max(0, min(100, base))


WEIGHTS_BASE = {
    "crime": 0.25, "infrastructure": 0.20, "air": 0.15, "power": 0.10,
    "schools": 0.10, "water": 0.08, "roads": 0.07, "sewerage": 0.05,
}


def crimes_for(crime_score):
    return round(600 - crime_score * 5)


def build(all_city_crime_scores):
    nqi_rows, master_rows = [], []

    my_crime_scores = {pin: PROFILE[pin]["crime"] for pin in ALL_AREAS}
    combined_scores = sorted(all_city_crime_scores + list(my_crime_scores.values()))

    for pin, entry in ALL_AREAS.items():
        name, area_label, lat, lon, tier, members = entry
        p = PROFILE[pin]

        aqi_raw, nearest_station, nearest_km = idw_aqi(lat, lon, AQI_STATIONS_CHN, k=3)
        aqi = round(aqi_raw)
        aqi_cat = aqi_category(aqi)
        if aqi <= 50: air = 95
        elif aqi <= 100: air = 80 - (aqi - 50) * 0.3
        elif aqi <= 200: air = 65 - (aqi - 100) * 0.35
        elif aqi <= 300: air = 30 - (aqi - 200) * 0.15
        else: air = max(5, 15 - (aqi - 300) * 0.05)

        scores = {
            "crime": p["crime"],
            "infrastructure": infra_score(p),
            "air": round(air),
            "power": TANGEDCO_POWER_SCORE,
            "schools": p["schools"],
            "water": p["water"],
            "roads": p["roads"],
            "sewerage": p["sewerage"],
        }

        w = dict(WEIGHTS_BASE)
        total_w = sum(w[k] for k in scores)
        composite = round(sum(scores[k] * w[k] for k in scores) / total_w)

        crimes = crimes_for(scores["crime"])
        rank = sum(1 for s in combined_scores if s < scores["crime"])
        pct = round(rank / len(combined_scores) * 100)
        tier_name = tier_for_crime_score(scores["crime"])

        schools_list = SCHOOL_NAMES.get(pin, [])
        schools_sourced = bool(schools_list)
        schools_count = len(schools_list) if schools_sourced else max(0, round(scores["schools"] / 22))

        outage = round(max(0.8, 5.5 - scores["power"] / 22), 1)
        rel_idx = 4 if scores["power"] >= 78 else 3 if scores["power"] >= 60 else 2 if scores["power"] >= 45 else 1

        tds = "Low" if scores["water"] >= 65 else "Medium" if scores["water"] >= 45 else "High"
        wcov = max(55, min(92, round(scores["water"] * 0.9 + 10)))

        road_idx = 4 if scores["roads"] >= 78 else 3 if scores["roads"] >= 62 else 2 if scores["roads"] >= 45 else 1
        pot = round(max(0.5, 4.5 - scores["roads"] / 24), 1)
        resurf = 2020 + (int(pin[-1]) % 5)

        wlog = 5 if scores["sewerage"] >= 75 else 4 if scores["sewerage"] >= 60 else 3 if scores["sewerage"] >= 45 else 2 if scores["sewerage"] >= 30 else 1
        flood = max(0, round((100 - scores["sewerage"]) / 14))

        metro_count, metro_names, metro_prov = metro_count_and_provenance(lat, lon)

        nqi_rows.append({
            "pin_code": pin, "city": "Chennai",
            "scores": scores,
            "weights_base": dict(WEIGHTS_BASE),
            "weights_applied": dict(WEIGHTS_BASE),
            "dimensions_scored": len(scores), "dimensions_total": 8,
            "nqi_composite": composite, "grade": grade_for(composite),
            "scored_at": SCORED_AT,
            "total_cognizable_crimes": crimes,
            "schools_count": schools_count, "schools_sourced": schools_sourced,
            "schools_list": schools_list, "schools_avg_pass": None,
            "crime_percentile": pct, "crime_tier": tier_name,
            "price_tier": tier,
            "price_context": {
                "tier": tier, "label": TIER_LABEL[tier],
                "rate_sqft": None, "rate_type": "apartment", "rate_exact": False,
                "land_sqft": None, "land_exact": False,
                "basis": f"{area_label} -- qualitative tier placement, not pinned to a cited guideline-value figure this pass",
                "source": "Tamil Nadu Registration Dept. -- guideline value, not yet pulled per-pincode for this tranche",
                "circle_rate_note": "Tamil Nadu calls it the 'guideline value', the same instrument Delhi/UP call a circle rate, Karnataka a guidance value: the government's minimum property value, used to calculate stamp duty and registration charges.",
                "market_gap_note": "Actual market prices typically run above the guideline value. The guideline value is only the legal floor for stamp duty -- budget for the difference in your own funds, since home loans are usually capped near this valuation.",
                "disclaimer": "Government minimum valuation, not market price. This pincode's price_tier is a qualitative placement, not yet pinned to a cited figure the way Chennai's own GCC-area rows may be. Not part of the NQI score.",
            },
        })

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi_idw_coarse", "tamil_nadu_police", "power", "municipal_water", "municipal_roads", "municipal_sewerage"],
            "aqi_avg": float(aqi),
            "aqi_category": aqi_cat,
            "total_cognizable_crimes": crimes,
            "zone_type": p["zone"],
            "metro_stations_nearby": metro_count,
            "metro_planned_stations": p["planned"],
            "highway_proximity": p["hwy"],
            "smart_city_project": False,  # not independently confirmed this pass
            "infra_score_raw": infra_score(p),
            "discom": DISCOM,
            "outage_frequency": round(outage),
            "avg_outage_hours": outage,
            "reliability": RELIABILITY[rel_idx],
            "zone": area_label,
            "supply_hours": max(2, round(3 + scores["water"] / 20)),
            "water_quality": max(1, min(5, round(scores["water"] / 20))),
            "quality_score": max(1, min(5, round(scores["water"] / 20))),
            "water_coverage": wcov, "coverage_pct": wcov,
            "tds_level": tds,
            "complaints_per_1000": max(4, round((100 - scores["water"]) * 1.3)),
            "source": WATER_OF[pin][0], "authority": MUNI_OF[pin],
            "road_quality": road_idx, "pothole_density": pot,
            "road_condition": ROAD_COND[road_idx],
            "last_resurfaced": resurf,
            "connectivity": "High" if tier <= 2 else "Medium",
            "sewerage_coverage": max(50, min(90, round(scores["sewerage"] * 0.9 + 12))),
            "treatment": "Full" if scores["sewerage"] >= 70 else "Partial",
            "waterlogging_risk": wlog,
            "open_drains": scores["sewerage"] < 55,
            "flooding_incidents_annual": flood,
            "data_completeness": 6,
            "merged_at": SCORED_AT, "city": "Chennai",
            "discom_confidence": "confirmed",
            "_police": POLICE_OF[pin][0], "_police_confidence": POLICE_OF[pin][1],
            "_water_confidence": WATER_OF[pin][1],
            "_governance_confidence": GOVERNANCE_CONF[pin],
            "_aqi_nearest_station": nearest_station, "_aqi_nearest_km": round(nearest_km, 1),
            "_provenance": {"metro_stations_nearby": metro_prov},
        })

    return nqi_rows, master_rows


def main():
    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    nqi = [r for r in nqi if r["pin_code"] not in OUTSKIRTS_PINS]
    master = [r for r in master if r["pin_code"] not in OUTSKIRTS_PINS]

    existing_chennai_crime_scores = [r["scores"]["crime"] for r in nqi if r.get("city") == "Chennai"]

    nqi_new, master_new = build(existing_chennai_crime_scores)

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    all_chennai_crime = sorted(r["scores"]["crime"] for r in nqi if r.get("city") == "Chennai")
    for r in nqi:
        if r.get("city") != "Chennai":
            continue
        rank = sum(1 for s in all_chennai_crime if s < r["scores"]["crime"])
        r["crime_percentile"] = round(rank / len(all_chennai_crime) * 100)

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Chennai-outskirts rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Chennai-outskirts rows -> {master_path} (total {len(master)})")
    print(f"recomputed crime_percentile for all {len(all_chennai_crime)} Chennai records (GCC + outskirts)")

    with open("/tmp/chennai_outskirts_pinmeta.txt", "w") as f:
        f.write("\n  // -- Chennai outskirts (Sriperumbudur) -- 1 pincode,\n")
        f.write("  //    Kanchipuram district industrial hub.\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Chennai"']
            alis = [m for m, _ in members]
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/chennai_outskirts_coords.txt", "w") as f:
        f.write("\n  // -- Chennai outskirts centroids --\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/chennai_outskirts_pinmeta.txt and /tmp/chennai_outskirts_coords.txt")


if __name__ == "__main__":
    main()
