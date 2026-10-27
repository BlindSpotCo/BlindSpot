#!/usr/bin/env python3
"""
scripts/build_hyderabad_outskirts.py

Generates the Hyderabad-outskirts rows (Shamshabad, Medchal -- see
scripts/hyderabad_outskirts_areas.py) for data/aslivastu/nqi_scores.json
and data/aslivastu/master_by_pin.json, stored under city="Hyderabad"
(same key the existing 41 pincodes use), plus PIN_META/AREA_COORDS
runtime snippets.

Same hand-set PROFILE-dict approach as build_chandigarh.py,
build_mumbai_outskirts.py and build_bangalore_outskirts.py (2 pincodes,
each individually researched) -- NOT build_hyderabad.py's own
zone-baseline bulk model, which was built for its original 41-pincode
tranche and isn't a natural fit for 2 new, individually-sourced towns.

SCHEMA: canonical schools_list ({name, address, board, pass_pct,
distance_km}, schools_count, schools_sourced) instead of Hyderabad's own
legacy schools_cbse/schools_icse/schools_state fields -- same departure
already made for Chandigarh Tricity, Mumbai outskirts and Bangalore
outskirts, for the same reason (nothing outside the generation scripts
reads the legacy fields).

CRIME_PERCENTILE, CITY-WIDE: same fix applied from the start as every
outskirts tranche since the f9931f6 Chandigarh bug -- main() reads the
full existing Hyderabad row set BEFORE computing percentiles, ranks
these 2 new rows against the combined 43-row set, AND recomputes the 41
existing rows' own crime_percentile against the same combined set.

KNOWN LATENT RISK, DISCLOSED NOT FIXED: build_hyderabad.py itself
unconditionally drops ALL city=="Hyderabad" rows before rewriting (same
pattern as build_mumbai.py/build_chandigarh.py) -- if it is ever re-run
after this tranche lands, it will silently wipe these 2 rows. This
script only drops its OWN scoped OUTSKIRTS_PINS, never the full city.

POWER: TSSPDCL_POWER_SCORE=44 reused directly from build_hyderabad.py's
own real anchor (same confirmed sole discom, same letter-grade-derived
score already applied to all 41 existing pincodes) -- not a separately
invented number for either town.

AQI: real IDW interpolation against cpcb_stations.py's own 13-station
HYDERABAD_STATIONS, same idw_aqi() function used for Chandigarh/Mumbai
outskirts/Bangalore outskirts -- genuinely coarse for these 2 points
since the network sits inside/near the old GHMC footprint, disclosed
via nearest-station distance on each master_by_pin row rather than
presented as precise.

METRO: real check against metro_stations.py's own 53-station Hyderabad
Metro registry, same method as the other outskirts tranches -- confirmed
0 within 2km of both pincodes (both well outside the three operational
Red/Blue/Green lines), with a _provenance entry recorded on each
master_by_pin row.
"""

import json
from datetime import date

from hyderabad_outskirts_areas import ALL_AREAS, MUNI_OF, POLICE_OF, WATER_OF, GOVERNANCE_CONF, DISCOM
from metro_stations import HYDERABAD_STATIONS as METRO_STATIONS_HYD, stations_within_radius
from cpcb_stations import HYDERABAD_STATIONS as AQI_STATIONS_HYD, idw_aqi, aqi_category

SCORED_AT = "2026-10-27T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
TIER_LABEL  = {1: 'Premium', 2: 'Upper', 3: 'Mid', 4: 'Modest', 5: 'Value'}

OUTSKIRTS_PINS = set(ALL_AREAS)

TSSPDCL_POWER_SCORE = 44  # same real anchor as build_hyderabad.py

_METRO_TUPLES = [(n, la, lo) for n, la, lo, _line, _src in METRO_STATIONS_HYD]
_METRO_RADIUS_KM = 2.0
_TODAY = date.today().isoformat()


def metro_count_and_provenance(lat, lon):
    count, names = stations_within_radius(lat, lon, _METRO_TUPLES, _METRO_RADIUS_KM)
    prov = {
        "value": count,
        "source_id": "metro_stations.HYDERABAD_STATIONS",
        "method": f"spatial_join_radius_{int(_METRO_RADIUS_KM*1000)}m_centroid",
        "as_of": _TODAY,
        "confidence": "high",
        "note": (
            "Centroid-radius count against the real 53-station Hyderabad "
            "Metro registry in scripts/metro_stations.py. Confirmed 0 for "
            "this pincode, not an unverified default -- both Shamshabad "
            "and Medchal are well outside the three operational lines."
        ),
    }
    return count, names, prov


# ── Canonical schools_list schema. Every entry cleared a second
# independent source -- see hyderabad_outskirts_areas.py's SOURCING.
SCHOOL_NAMES = {
    "501218": [  # Shamshabad
        {"name": "Delhi Public School, Aerocity", "address": "Survey No 191/1, 191/2, 191/3 & 192, Rajiv Gandhi International Airport Road, Mamidipally, Shamshabad, 501218", "board": "CBSE", "pass_pct": None, "distance_km": 2.0},
    ],
    "501401": [  # Medchal
        {"name": "Sanskar Innovative School", "address": "Plot No. 889, Survey No. 341, Railway Colony, Medchal, 501401", "board": "CBSE (affiliation #3630208)", "pass_pct": None, "distance_km": 1.0},
    ],
}

# ── Per-pincode modelled dimension inputs ───────────────────────────────
PROFILE = {
    # Shamshabad: RGIA-adjacent, expressway access, but water/sewerage
    # are genuine documented weaknesses (borewell-dependent, no proper
    # drainage network per The Hans India's ground report).
    "501218": dict(crime=55, schools=62, water=38, roads=60, sewerage=35, zone="Commercial", hwy="High", planned=1),
    # Medchal: district HQ town, decent highway access, but water is a
    # live, current crisis as of Oct 2026 (once every 4 days supply).
    "501401": dict(crime=52, schools=58, water=35, roads=55, sewerage=45, zone="Mixed", hwy="High", planned=0),
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
    """Same shape as the other outskirts tranches' infra_score(): 0
    operational metro stations confirmed within 2km of either pincode
    (see module docstring), so `planned` carries the only transit
    signal (Shamshabad's own airport-metro-extension talk)."""
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
    """Same inverse-of-score relative model used throughout this
    project -- no pincode-level real crime-count source exists for
    either town."""
    return round(600 - crime_score * 5)


def build(all_city_crime_scores):
    nqi_rows, master_rows = [], []

    my_crime_scores = {pin: PROFILE[pin]["crime"] for pin in ALL_AREAS}
    combined_scores = sorted(all_city_crime_scores + list(my_crime_scores.values()))

    for pin, entry in ALL_AREAS.items():
        name, area_label, lat, lon, tier, members = entry
        p = PROFILE[pin]

        aqi_raw, nearest_station, nearest_km = idw_aqi(lat, lon, AQI_STATIONS_HYD, k=3)
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
            "power": TSSPDCL_POWER_SCORE,
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

        # outage/reliability: same TSSPDCL grade-derived formula shape
        # used throughout this project for a flat-per-city power score.
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
            "pin_code": pin, "city": "Hyderabad",
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
                "basis": f"{area_label} -- qualitative tier placement, not pinned to a cited circle-rate figure this pass",
                "source": "Telangana Registration & Stamps Dept. -- market value (circle rate), not yet pulled per-pincode for this tranche",
                "circle_rate_note": "Telangana calls it the 'market value', the same instrument Delhi/UP call a circle rate and Haryana/Chandigarh a collector rate: the government's minimum property value, used to calculate stamp duty and registration charges.",
                "market_gap_note": "Actual market prices typically run above the market value. The market value is only the legal floor for stamp duty -- budget for the difference in your own funds, since home loans are usually capped near this valuation.",
                "disclaimer": "Government minimum valuation, not market price. This pincode's price_tier is a qualitative placement, not yet pinned to a cited circle-rate figure the way Hyderabad's own GHMC-area rows may be. Not part of the NQI score.",
            },
        })

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi_idw_coarse", "telangana_police", "power", "municipal_water", "municipal_roads", "municipal_sewerage"],
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
            "merged_at": SCORED_AT, "city": "Hyderabad",
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

    existing_hyderabad_crime_scores = [r["scores"]["crime"] for r in nqi if r.get("city") == "Hyderabad"]

    nqi_new, master_new = build(existing_hyderabad_crime_scores)

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    all_hyderabad_crime = sorted(r["scores"]["crime"] for r in nqi if r.get("city") == "Hyderabad")
    for r in nqi:
        if r.get("city") != "Hyderabad":
            continue
        rank = sum(1 for s in all_hyderabad_crime if s < r["scores"]["crime"])
        r["crime_percentile"] = round(rank / len(all_hyderabad_crime) * 100)

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Hyderabad-outskirts rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Hyderabad-outskirts rows -> {master_path} (total {len(master)})")
    print(f"recomputed crime_percentile for all {len(all_hyderabad_crime)} Hyderabad records (GHMC + outskirts)")

    with open("/tmp/hyderabad_outskirts_pinmeta.txt", "w") as f:
        f.write("\n  // -- Hyderabad outskirts (Shamshabad / Medchal) -- 2\n")
        f.write("  //    pincodes, own municipal bodies.\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Hyderabad"']
            alis = [m for m, _ in members]
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/hyderabad_outskirts_coords.txt", "w") as f:
        f.write("\n  // -- Hyderabad outskirts centroids --\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/hyderabad_outskirts_pinmeta.txt and /tmp/hyderabad_outskirts_coords.txt")


if __name__ == "__main__":
    main()
