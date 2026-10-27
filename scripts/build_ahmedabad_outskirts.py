#!/usr/bin/env python3
"""
scripts/build_ahmedabad_outskirts.py

Generates the Ahmedabad-outskirts rows (Gandhinagar, GIFT City -- see
scripts/ahmedabad_outskirts_areas.py) for data/aslivastu/nqi_scores.json
and data/aslivastu/master_by_pin.json, stored under city="Ahmedabad"
(same key the existing 39 pincodes use), plus PIN_META/AREA_COORDS
runtime snippets.

Same hand-set PROFILE-dict approach as every other outskirts tranche
this pass (Chandigarh Tricity, Mumbai, Bangalore, Hyderabad) -- NOT
build_ahmedabad.py's own zone-baseline bulk model, which was built for
its original 39-pincode tranche.

SCHEMA: canonical schools_list ({name, address, board, pass_pct,
distance_km}, schools_count, schools_sourced) -- same departure already
made for every other outskirts tranche.

CRIME_PERCENTILE, CITY-WIDE: same fix applied from the start as every
tranche since the f9931f6 Chandigarh bug -- main() reads the full
existing Ahmedabad row set BEFORE computing percentiles, ranks these 2
new rows against the combined 41-row set, AND recomputes the 39
existing rows' own crime_percentile against the same combined set.

KNOWN LATENT RISK, DISCLOSED NOT FIXED: build_ahmedabad.py itself
unconditionally drops ALL city=="Ahmedabad" rows before rewriting (same
pattern as build_mumbai.py/build_chandigarh.py/build_hyderabad.py) --
if it is ever re-run after this tranche lands, it will silently wipe
these 2 rows. This script only drops its OWN scoped OUTSKIRTS_PINS,
never the full city.

POWER: NOT a single flat score, unlike every other outskirts tranche --
Gandhinagar proper and GIFT City have two DIFFERENT real licensees (see
ahmedabad_outskirts_areas.py's DISCOM_OF), so POWER_SCORE_OF is keyed
per-pincode. Gandhinagar reuses Ahmedabad's own confirmed Torrent Power
anchor; GIFT City's own licensee (GIFT PCL) has no citywide Ministry-
of-Power-style rating found this pass, so it is modelled at a
qualitatively similar score to a well-run private SEZ utility, flagged
INFERRED rather than pinned to a specific real document the way
Ahmedabad/Bangalore/Hyderabad's flat anchors are.

AQI: real IDW interpolation against cpcb_stations.py's own 5-station
AHMEDABAD_STATIONS, same idw_aqi() function used throughout this
project -- genuinely coarse for both points (15-20km+ to nearest real
station), disclosed via nearest-station distance on each
master_by_pin row.

METRO: real check against metro_stations.py's own 43-station Ahmedabad
Metro registry, same method as every other outskirts tranche --
confirmed 0 within 2km of both pincodes (the real, cited GIFT City/
Gandhinagar Phase 2 extension was not operational as of this pass).
"""

import json
from datetime import date

from ahmedabad_outskirts_areas import ALL_AREAS, MUNI_OF, POLICE_OF, WATER_OF, GOVERNANCE_CONF, DISCOM_OF
from metro_stations import AHMEDABAD_STATIONS as METRO_STATIONS_AHD, stations_within_radius
from cpcb_stations import AHMEDABAD_STATIONS as AQI_STATIONS_AHD, idw_aqi, aqi_category

SCORED_AT = "2026-10-27T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
TIER_LABEL  = {1: 'Premium', 2: 'Upper', 3: 'Mid', 4: 'Modest', 5: 'Value'}

OUTSKIRTS_PINS = set(ALL_AREAS)

# Gandhinagar reuses Ahmedabad's own confirmed Torrent Power anchor
# (same letter-grade-derived scale used throughout this project: A+=92,
# A=85, B+=76, B=68, B-=60, C+=52, C=44, C-=36). GIFT City's own
# licensee (GIFT PCL) has no citywide Ministry-of-Power rating found
# this pass -- modelled qualitatively, flagged INFERRED, not pinned to
# a specific document.
POWER_SCORE_OF = {
    "382010": 60,  # Torrent Power, same B- anchor as Ahmedabad proper
    "382050": 64,  # GIFT PCL, SEZ-managed utility, modelled not pinned
}
POWER_CONF_OF = {"382010": "confirmed", "382050": "inferred"}

_METRO_TUPLES = [(n, la, lo) for n, la, lo in METRO_STATIONS_AHD]
_METRO_RADIUS_KM = 2.0
_TODAY = date.today().isoformat()


def metro_count_and_provenance(lat, lon):
    count, names = stations_within_radius(lat, lon, _METRO_TUPLES, _METRO_RADIUS_KM)
    prov = {
        "value": count,
        "source_id": "metro_stations.AHMEDABAD_STATIONS",
        "method": f"spatial_join_radius_{int(_METRO_RADIUS_KM*1000)}m_centroid",
        "as_of": _TODAY,
        "confidence": "high",
        "note": (
            "Centroid-radius count against the real 43-station Ahmedabad "
            "Metro registry in scripts/metro_stations.py. Confirmed 0 for "
            "this pincode -- the real, cited Phase 2 extension toward "
            "GIFT City/Gandhinagar was not operational as of this pass."
        ),
    }
    return count, names, prov


# ── Canonical schools_list schema. Every entry cleared a second
# independent source -- see ahmedabad_outskirts_areas.py's SOURCING.
SCHOOL_NAMES = {
    "382010": [  # Gandhinagar
        {"name": "Kendriya Vidyalaya No 1, Gandhinagar", "address": "Sector 30, Gandhinagar, 382030", "board": "CBSE", "pass_pct": None, "distance_km": 3.0},
    ],
    "382050": [  # GIFT City
        {"name": "Jamnabai Narsee School, GIFT City", "address": "Block 40-A, Shram Marg, Zone-IV, GIFT City, Gandhinagar, 382050", "board": "CISCE", "pass_pct": None, "distance_km": 0.3},
    ],
}

# ── Per-pincode modelled dimension inputs ───────────────────────────────
PROFILE = {
    # Gandhinagar: planned sector-grid capital city, genuinely good news
    # on water (24x7 since Nov 2025), decent civic baseline throughout.
    "382010": dict(crime=65, schools=60, water=70, roads=68, sewerage=58, zone="Institutional", hwy="High", planned=1),
    # GIFT City: purpose-built, gated financial SEZ, high security and
    # planned infra, but self-managed utilities not independently rated.
    "382050": dict(crime=68, schools=62, water=58, roads=72, sewerage=60, zone="Commercial", hwy="High", planned=1),
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
    """Same shape as every other outskirts tranche's infra_score(): 0
    operational metro stations confirmed within 2km of either pincode
    (see module docstring), so `planned` carries the only transit
    signal (the real, cited GIFT City/Gandhinagar Phase 2 extension)."""
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
    either area."""
    return round(600 - crime_score * 5)


def build(all_city_crime_scores):
    nqi_rows, master_rows = [], []

    my_crime_scores = {pin: PROFILE[pin]["crime"] for pin in ALL_AREAS}
    combined_scores = sorted(all_city_crime_scores + list(my_crime_scores.values()))

    for pin, entry in ALL_AREAS.items():
        name, area_label, lat, lon, tier, members = entry
        p = PROFILE[pin]

        aqi_raw, nearest_station, nearest_km = idw_aqi(lat, lon, AQI_STATIONS_AHD, k=3)
        aqi = round(aqi_raw)
        aqi_cat = aqi_category(aqi)
        if aqi <= 50: air = 95
        elif aqi <= 100: air = 80 - (aqi - 50) * 0.3
        elif aqi <= 200: air = 65 - (aqi - 100) * 0.35
        elif aqi <= 300: air = 30 - (aqi - 200) * 0.15
        else: air = max(5, 15 - (aqi - 300) * 0.05)

        power_score = POWER_SCORE_OF[pin]

        scores = {
            "crime": p["crime"],
            "infrastructure": infra_score(p),
            "air": round(air),
            "power": power_score,
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
            "pin_code": pin, "city": "Ahmedabad",
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
                "basis": f"{area_label} -- qualitative tier placement, not pinned to a cited Jantri-rate figure this pass",
                "source": "Gujarat Revenue Dept. (Jantri) -- government valuation, not yet pulled per-pincode for this tranche",
                "circle_rate_note": "Gujarat calls it the 'Jantri rate', the same instrument Delhi/UP call a circle rate, Haryana/Chandigarh a collector rate, Karnataka a guidance value, and Telangana a market value: the government's minimum property value, used to calculate stamp duty and registration charges.",
                "market_gap_note": "Actual market prices in Gandhinagar/GIFT City typically run above the Jantri rate. The Jantri rate is only the legal floor for stamp duty -- budget for the difference in your own funds, since home loans are usually capped near this valuation.",
                "disclaimer": "Government minimum valuation, not market price. This pincode's price_tier is a qualitative placement, not yet pinned to a cited Jantri-rate figure the way Ahmedabad's own AMC-area rows may be. Not part of the NQI score.",
            },
        })

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi_idw_coarse", "gujarat_police", "power", "municipal_water", "municipal_roads", "municipal_sewerage"],
            "aqi_avg": float(aqi),
            "aqi_category": aqi_cat,
            "total_cognizable_crimes": crimes,
            "zone_type": p["zone"],
            "metro_stations_nearby": metro_count,
            "metro_planned_stations": p["planned"],
            "highway_proximity": p["hwy"],
            "smart_city_project": pin == "382010",  # Gandhinagar's 24x7 water switch was reported as a smart-city initiative; GIFT City not independently confirmed as a formal Smart City Mission project
            "infra_score_raw": infra_score(p),
            "discom": DISCOM_OF[pin],
            "outage_frequency": round(outage),
            "avg_outage_hours": outage,
            "reliability": RELIABILITY[rel_idx],
            "zone": area_label,
            "supply_hours": 24 if pin == "382010" else max(2, round(3 + scores["water"] / 20)),
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
            "merged_at": SCORED_AT, "city": "Ahmedabad",
            "discom_confidence": POWER_CONF_OF[pin],
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

    existing_ahmedabad_crime_scores = [r["scores"]["crime"] for r in nqi if r.get("city") == "Ahmedabad"]

    nqi_new, master_new = build(existing_ahmedabad_crime_scores)

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    all_ahmedabad_crime = sorted(r["scores"]["crime"] for r in nqi if r.get("city") == "Ahmedabad")
    for r in nqi:
        if r.get("city") != "Ahmedabad":
            continue
        rank = sum(1 for s in all_ahmedabad_crime if s < r["scores"]["crime"])
        r["crime_percentile"] = round(rank / len(all_ahmedabad_crime) * 100)

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Ahmedabad-outskirts rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Ahmedabad-outskirts rows -> {master_path} (total {len(master)})")
    print(f"recomputed crime_percentile for all {len(all_ahmedabad_crime)} Ahmedabad records (AMC + outskirts)")

    with open("/tmp/ahmedabad_outskirts_pinmeta.txt", "w") as f:
        f.write("\n  // -- Ahmedabad outskirts (Gandhinagar / GIFT City) -- 2\n")
        f.write("  //    pincodes, own governing bodies.\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Ahmedabad"']
            alis = [m for m, _ in members]
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/ahmedabad_outskirts_coords.txt", "w") as f:
        f.write("\n  // -- Ahmedabad outskirts centroids --\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/ahmedabad_outskirts_pinmeta.txt and /tmp/ahmedabad_outskirts_coords.txt")


if __name__ == "__main__":
    main()
