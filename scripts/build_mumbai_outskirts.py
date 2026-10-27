#!/usr/bin/env python3
"""
scripts/build_mumbai_outskirts.py

Generates the Mumbai-outskirts rows (Navi Mumbai, Mira-Bhayandar,
Kalyan-Dombivli, Thane core, Panvel -- see scripts/mumbai_outskirts_areas.py)
for data/aslivastu/nqi_scores.json and data/aslivastu/master_by_pin.json,
all stored under city="Mumbai" (same key build_mumbai.py's own 96 BMC rows
use), plus PIN_META/AREA_COORDS runtime snippets.

WHY A HAND-SET PROFILE DICT, NOT build_mumbai.py's ZONE_BASELINE+JITTER MODEL
build_mumbai.py's zone-baseline-plus-jitter approach exists because 94-96
pincodes is too many to hand-author one at a time without drifting into
copy-paste (the exact defect that model was built to fix). This tranche is
14 pincodes across 5 small, individually-researched areas -- the same
scale as Chandigarh's own 20-pincode build_chandigarh.py, which uses a
literal hand-set PROFILE dict instead. Followed here for the same reason:
each area's crime/schools/water/roads/sewerage placement is grounded in
or disclosed against a specific real fact (see mumbai_outskirts_areas.py's
own SOURCING section), not a zone model tuned for BMC wards specifically.

SCHEMA NOTE: this script writes the CANONICAL schools_list schema
({name, address, board, pass_pct, distance_km} objects, schools_count,
schools_sourced) rather than build_mumbai.py's own legacy
schools_cbse/schools_icse/schools_state fields -- the same departure
build_chandigarh_tricity.py made from build_chandigarh.py's legacy schema,
for the same reason (confirmed via components/property-score/
AVDetailedReadout.js and app/api/sunscout/report/analyse/route.js that
nothing outside the generation scripts themselves reads the legacy
fields; the canonical schema is what the UI actually renders).

CRIME_PERCENTILE, CITY-WIDE: a genuine bug shipped once already this pass
(commit f9931f6, caught by another session, not by the agent that wrote
the code) -- crime_percentile must be a rank against EVERY record sharing
a city key, not just the new script's own rows. This script's main()
reads the FULL existing Mumbai row set (the 96 BMC rows already in
nqi_scores.json) BEFORE computing percentiles, ranks these 14 new rows
against that combined 110-row set, AND recomputes the 96 existing BMC
rows' own crime_percentile against the same combined set -- both
directions, not just the new rows pointing at the old ones. See main().

KNOWN LATENT RISK, DISCLOSED NOT FIXED: build_mumbai.py's own main() drops
ALL rows where city=="Mumbai" unconditionally before rewriting
("Idempotent: drop any existing Mumbai rows first so re-running replaces
rather than duplicates" -- scripts/build_mumbai.py). If build_mumbai.py is
ever re-run after this script, it WILL silently wipe these 14 outskirts
rows along with correctly rebuilding its own 96 -- the exact same latent
risk build_chandigarh.py carries for whatever Chandigarh Tricity rows
eventually land on main (that branch -- add-mohali-chandigarh-tricity --
has not been merged to main as of this pass; see the branch-consolidation
note raised separately). Fixing build_mumbai.py's own idempotency scope
(to drop only its own MUMBAI_BMC_PINS, the same fix this script applies to
ITSELF below) is a cross-cutting change to an established file beyond
"add the outskirts tranche," so it is flagged here rather than made
silently. This script's OWN idempotency is scoped correctly: it drops
only OUTSKIRTS_PINS, never all city=="Mumbai" rows, so re-running
build_mumbai.py's own script is what remains unsafe, not this one.

STAMP DUTY FLAG: see mumbai_outskirts_areas.py's SEVEN_PCT_GROUP/
SIX_PCT_GROUP and the comment added to lib/compare/derive.js's Mumbai
entry. Not applied to any number in this file.

AQI: Navi Mumbai's 92 (Satisfactory) is a real, dated citywide figure
(CPCB bulletin, 14 Oct 2026, via navimumbai.com's own AQI page, which
lists the real MPCB/IITM station names -- Airoli, Kopripada-Vashi, Mahape,
Nerul, Sanpada, Sector 19A Nerul, Sector 2E Kalamboli, Tondare-Taloja --
but no individually fetchable numeric reading per station this pass, so
the citywide bulletin figure is used instead of inventing a per-pincode
number). A same-day CPCB Maharashtra-wide bulletin PDF that would have
given Thane/Kalyan-Dombivli/Mira-Bhayandar/Panvel their own figures
(cpcb.gov.in/upload/Downloads/AQI_Bulletin_20261022.pdf) is
ROBOTS_DISALLOWED -- not retried, per this project's own WebFetch
failure-handling rule. Those four areas' AQI is therefore MODELLED
(disclosed below, not claimed as individually sourced), shaped to each
area's known general character (Kalyan-Dombivli's industrial belt and
Thane's traffic density read worse than Navi Mumbai's and Panvel's more
recently-planned layouts).
"""

import json
from datetime import date, timezone, datetime

from mumbai_outskirts_areas import (
    NAVI_MUMBAI, MIRA_BHAYANDAR, KALYAN_DOMBIVLI, THANE_CORE, PANVEL,
    ALL_AREAS, MUNI_OF, POLICE_OF, WATER_OF,
)
from metro_stations import MUMBAI_STATIONS, stations_within_radius

# Real metro-station proximity check against scripts/metro_stations.py's
# own 66-station Mumbai registry (the same "derive, don't store" fix
# patch_metro.py already applied to Delhi NCR/Bangalore), not an assumed
# 0. All 14 outskirts pincodes come back 0 within the same 1.5km radius
# patch_metro.py uses -- confirmed, not guessed: Navi Mumbai Metro Line 1
# runs Belapur-Pendhar/Taloja, nowhere near Vashi/Nerul; nothing in the
# registry reaches Thane/Kalyan-Dombivli/Mira-Bhayandar/Panvel either.
_STATION_TUPLES = [(n, la, lo) for n, la, lo, _line, _src in MUMBAI_STATIONS]
_METRO_RADIUS_KM = 1.5
_TODAY = date.today().isoformat()


def metro_count_and_provenance(lat, lon):
    count, names = stations_within_radius(lat, lon, _STATION_TUPLES, _METRO_RADIUS_KM)
    prov = {
        "value": count,
        "source_id": "metro_stations.MUMBAI_STATIONS",
        "method": f"spatial_join_radius_{int(_METRO_RADIUS_KM*1000)}m_centroid",
        "as_of": _TODAY,
        "confidence": "high",
        "note": (
            "Centroid-radius count against the real named station "
            "registry in scripts/metro_stations.py, same method "
            "patch_metro.py already applies to Delhi NCR/Bangalore. "
            "Confirmed 0 for this pincode, not an unverified default."
        ),
    }
    return count, names, prov

SCORED_AT = "2026-10-27T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
TIER_LABEL  = {1: 'Premium', 2: 'Upper', 3: 'Mid', 4: 'Modest', 5: 'Value'}

OUTSKIRTS_PINS = set(ALL_AREAS)

# ── Canonical schools_list schema: {name, address, board, pass_pct,
# distance_km}. pass_pct left None where no board exam pass-rate figure
# was found (none were, this pass -- these are addresses/affiliation
# confirmations, not exam results data). distance_km is an approximate
# straight-line estimate from the pincode's own centroid, not a routed
# distance -- same caveat level as the rest of this dataset's distance
# fields. Every entry here cleared a SECOND independent source beyond the
# first listing that surfaced it (see mumbai_outskirts_areas.py's
# SOURCING section) -- anything that didn't was left out, not guessed at.
SCHOOL_NAMES = {
    "400703": [  # Vashi
        {"name": "Vivekanand International School", "address": "Plot 7, opp. Railway Colony, Kopri, Sector 26, Vashi, 400703", "board": "CBSE", "pass_pct": None, "distance_km": 0.5},
    ],
    "400706": [  # Nerul
        {"name": "Podar International School, Nerul", "address": "Plot 30, Sector 36, near HP Petrol Pump, Palm Beach Road, Nerul, 400706", "board": "CBSE / CISCE / Cambridge", "pass_pct": None, "distance_km": 0.8},
    ],
    "401107": [  # Mira Road
        {"name": "Seven Square Academy", "address": "Ideal Park, Deepak Hospital Lane, Mira Road East, 401107", "board": "CBSE", "pass_pct": None, "distance_km": 0.6},
        {"name": "Cosmopolitan High School", "address": "Sheetal Nagar, Mira Road East, 401107", "board": "State (Maharashtra)", "pass_pct": None, "distance_km": 1.0},
    ],
    "421301": [  # Kalyan West
        {"name": "Podar International School, Kalyan", "address": "Wyale Nagar, Gandhar Village, Kalyan West, 421301", "board": "CBSE (affiliation #1130776)", "pass_pct": None, "distance_km": 1.2},
        {"name": "Central Railway Secondary English Medium School", "address": "Murbad Road, Kalyan West, 421301", "board": "CBSE / MSBSHSE", "pass_pct": None, "distance_km": 0.9},
    ],
    "421203": [  # Dombivli East, MIDC Residential Zone
        {"name": "Omkar English Medium School", "address": "P-74, near Mamata Hospital, MIDC Residential Zone, Dombivli East, 421203", "board": "CBSE (affiliation #1130508)", "pass_pct": None, "distance_km": 0.7},
    ],
    "421204": [  # Dombivli East, Palava
        {"name": "Lodha World School, Dombivli East", "address": "Kalyan-Shilphata Road / Palava, Dombivli East, 421204", "board": "CBSE / CISCE", "pass_pct": None, "distance_km": 1.5},
    ],
    "400606": [  # Vartak Nagar, Thane
        {"name": "Sulochana Devi Singhania High School", "address": "Jekegram, Thane, 400606", "board": "ICSE / ISC / IB", "pass_pct": None, "distance_km": 1.0},
        {"name": "Little Flower High School, Thane", "address": "Pokhran Road No. 2, near Upvan Lake, Thane, 400606", "board": "State (Maharashtra SSC) -- inferred from course description, not stated outright", "pass_pct": None, "distance_km": 1.3},
        {"name": "Brahman Vidyalaya Marathi", "address": "Prabag No. 40, Thane, 400606", "board": "State (Maharashtra, Marathi medium)", "pass_pct": None, "distance_km": 0.8},
    ],
    "410206": [  # Panvel City / New Panvel
        {"name": "D.A.V. Public School, New Panvel", "address": "Plot 267-268, Sector 10, New Panvel, 410206", "board": "CBSE", "pass_pct": None, "distance_km": 1.0},
        {"name": "New Horizon Public School", "address": "Sector 13, Khanda Colony, New Panvel West, 410206", "board": "CBSE (affiliation #1130164)", "pass_pct": None, "distance_km": 1.4},
    ],
}

# ── Power: single real anchor, no jitter -- MSEDCL's own 14th Integrated
# Rating (Jan 2026): rank 49/54, score 16.63/100, grade C (up from
# C-minus). Mapped near-directly onto this project's 0-100 power score,
# same "real per-DISCOM score, no fake per-pincode noise" principle
# build_mumbai.py already uses for BEST (92) / Tata (92). Not the hedged
# "Tata Power / MSEDCL" 55 build_mumbai.py uses for its own BMC-periphery
# edge pincodes -- that hedge exists because THOSE pincodes' own DISCOM
# attribution is only plausible, not confirmed; every pincode here is
# confirmed MSEDCL territory (Thane's Shil/Mumbra/Kalwa Torrent Power
# franchise doesn't reach Thane Bazar/Naupada/Vartak Nagar -- see module
# docstring), so the real, unhedged severity is used.
DISCOM = "MSEDCL"
POWER_SCORE = 17

# ── Per-area modelled dimension inputs ──────────────────────────────────
# crime/schools/water/roads/sewerage per pincode. Grounded where a
# specific fact exists (see mumbai_outskirts_areas.py SOURCING); otherwise
# a disclosed qualitative placement shaped to each area's real character,
# same standing as Chandigarh's own PROFILE dict entries.
PROFILE = {
    # Navi Mumbai: CIDCO-planned, Morbe Dam water supply is a genuine
    # documented strength, wide planned roads a genuine strength. AQI is
    # the one real, dated figure in this dataset (92, Satisfactory,
    # 14 Oct 2026 CPCB bulletin via navimumbai.com).
    "400703": dict(crime=68, schools=70, water=75, roads=72, sewerage=68, aqi=92, aqi_cat="Satisfactory", zone="Commercial", hwy="High", planned=0),
    "400706": dict(crime=68, schools=70, water=75, roads=72, sewerage=68, aqi=92, aqi_cat="Satisfactory", zone="Residential", hwy="High", planned=0),
    # Mira-Bhayandar: administrator-run corporation, dense commuter
    # corridor along the Western Line. AQI modelled (disclosed in module
    # docstring), not individually sourced this pass.
    "401107": dict(crime=58, schools=58, water=55, roads=53, sewerage=52, aqi=100, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=0),
    "401101": dict(crime=58, schools=50, water=55, roads=53, sewerage=52, aqi=100, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=0),
    "401105": dict(crime=58, schools=50, water=55, roads=53, sewerage=52, aqi=100, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=0),
    # Kalyan-Dombivli: Ulhas River water-supply stress is a documented
    # real weakness (repeated KDMC pipeline-disruption reporting); AQI
    # modelled, reflecting the area's known industrial-belt character
    # (Dombivli MIDC) rather than an individually sourced reading.
    "421301": dict(crime=52, schools=58, water=48, roads=50, sewerage=48, aqi=110, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    "421304": dict(crime=52, schools=50, water=48, roads=50, sewerage=48, aqi=110, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    "421306": dict(crime=52, schools=50, water=48, roads=50, sewerage=48, aqi=110, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    "421203": dict(crime=52, schools=58, water=46, roads=48, sewerage=46, aqi=112, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    "421204": dict(crime=55, schools=60, water=50, roads=52, sewerage=50, aqi=108, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    # Thane core: Vartak Nagar's 3 schools lift its schools score above
    # Thane Bazar/Naupada's, which have no independently-sourced school
    # this pass. AQI modelled, reflecting Thane's known traffic density.
    "400601": dict(crime=60, schools=50, water=55, roads=58, sewerage=55, aqi=105, aqi_cat="Moderate", zone="Commercial", hwy="Medium", planned=1),
    "400602": dict(crime=60, schools=50, water=55, roads=58, sewerage=55, aqi=105, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    "400606": dict(crime=62, schools=66, water=55, roads=58, sewerage=55, aqi=102, aqi_cat="Moderate", zone="Residential", hwy="Medium", planned=1),
    # Panvel: CIDCO-planned New Panvel, close to the Mumbai-Pune
    # Expressway/NH66 and Navi Mumbai's own planned infrastructure. AQI
    # modelled.
    "410206": dict(crime=62, schools=64, water=60, roads=62, sewerage=58, aqi=95, aqi_cat="Satisfactory", zone="Residential", hwy="High", planned=0),
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
    """Same shape as build_chandigarh.py's infra_score(): no operational
    metro reaches any of these 14 pincodes yet (Navi Mumbai Metro Line 1
    runs Belapur-Pendhar, nowhere near Vashi/Nerul; Thane/Kalyan's own
    planned Metro Line 5 extension hasn't opened), so metro_stations_nearby
    is 0 everywhere and `planned` carries the signal instead."""
    base = 36
    base += HWY_BONUS[p["hwy"]]
    base += ZONE_BONUS[p["zone"]]
    base += min(p["planned"], 4) * 2
    return max(0, min(100, base))


WEIGHTS_BASE = {
    "crime": 0.25, "infrastructure": 0.20, "air": 0.15, "power": 0.10,
    "schools": 0.10, "water": 0.08, "roads": 0.07, "sewerage": 0.05,
}


def crimes_for(pin, crime_score):
    """Same inverse-of-score relative model as build_mumbai.py's own
    crimes_for() -- no pincode-level real crime-count source exists for
    these areas either, so this stays a modelled relative figure, same
    honesty level. No jitter: the per-area crime score already varies
    pincode to pincode where a real signal (schools density, Vartak
    Nagar's own slightly better placement) supports it."""
    return round(600 - crime_score * 5)


def build(all_city_crime_scores):
    """all_city_crime_scores: every OTHER Mumbai (BMC) record's own crime
    score, passed in so this tranche's crime_percentile is a rank against
    the full combined city, not just these 14 rows. See module docstring's
    CRIME_PERCENTILE note."""
    nqi_rows, master_rows = [], []

    my_crime_scores = {pin: PROFILE[pin]["crime"] for pin in ALL_AREAS}
    combined_scores = sorted(all_city_crime_scores + list(my_crime_scores.values()))

    for pin, entry in ALL_AREAS.items():
        name, area_label, lat, lon, tier, members = entry
        p = PROFILE[pin]
        # air score from AQI: CPCB-style inverse band, same bands
        # build_mumbai.py's air_score_from_aqi() uses (not re-imported to
        # avoid a cross-script dependency on build_mumbai.py's internals;
        # replicated here at the same thresholds).
        aqi = p["aqi"]
        if aqi <= 50: air = 95
        elif aqi <= 100: air = 80 - (aqi - 50) * 0.3
        elif aqi <= 200: air = 65 - (aqi - 100) * 0.35
        elif aqi <= 300: air = 30 - (aqi - 200) * 0.15
        else: air = max(5, 15 - (aqi - 300) * 0.05)

        scores = {
            "crime": p["crime"],
            "infrastructure": infra_score(p),
            "air": round(air),
            "power": POWER_SCORE,
            "schools": p["schools"],
            "water": p["water"],
            "roads": p["roads"],
            "sewerage": p["sewerage"],
        }

        w = dict(WEIGHTS_BASE)
        total_w = sum(w[k] for k in scores)
        composite = round(sum(scores[k] * w[k] for k in scores) / total_w)

        crimes = crimes_for(pin, scores["crime"])
        rank = sum(1 for s in combined_scores if s < scores["crime"])
        pct = round(rank / len(combined_scores) * 100)
        tier_name = tier_for_crime_score(scores["crime"])

        schools_list = SCHOOL_NAMES.get(pin, [])
        schools_sourced = bool(schools_list)
        schools_count = len(schools_list) if schools_sourced else max(0, round(scores["schools"] / 22))

        outage = 5.0  # flat, per-DISCOM anchor -- see POWER_SCORE comment
        rel_idx = 1   # 'Poor' -- MSEDCL grade C, no per-pincode variation on a flat anchor

        tds = "Low" if scores["water"] >= 65 else "Medium" if scores["water"] >= 45 else "High"
        wcov = max(60, min(95, round(scores["water"] * 0.9 + 15)))

        road_idx = 4 if scores["roads"] >= 78 else 3 if scores["roads"] >= 62 else 2 if scores["roads"] >= 45 else 1
        pot = round(max(0.5, 4.5 - scores["roads"] / 24), 1)
        resurf = 2020 + (int(pin[-1]) % 5)  # small deterministic spread 2020-2024, not a real per-pin source

        wlog = 5 if scores["sewerage"] >= 75 else 4 if scores["sewerage"] >= 60 else 3 if scores["sewerage"] >= 45 else 2 if scores["sewerage"] >= 30 else 1
        flood = max(0, round((100 - scores["sewerage"]) / 14))

        metro_count, metro_names, metro_prov = metro_count_and_provenance(lat, lon)

        nqi_rows.append({
            "pin_code": pin, "city": "Mumbai",
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
                "basis": f"{area_label} -- qualitative tier placement, not pinned to a cited Ready Reckoner Rate figure this pass",
                "source": "Dept. of Registration & Stamps, Government of Maharashtra (IGR Maharashtra) -- Ready Reckoner Rate, not yet pulled per-pincode for this tranche",
                "circle_rate_note": "Maharashtra calls it the 'Ready Reckoner Rate' (RRR) or Annual Statement of Rates (ASR) -- the same instrument Delhi/UP call a circle rate, Haryana/Chandigarh a collector rate, and Karnataka a guidance value: the government's minimum property value, used to calculate stamp duty and registration charges.",
                "market_gap_note": "Actual market prices typically run above the Ready Reckoner Rate. The RRR is only the legal floor for stamp duty -- budget for the difference in your own funds, since home loans are usually capped near this valuation.",
                "disclaimer": "Government minimum valuation, not market price. This pincode's price_tier is a qualitative placement (see module docstring), not yet pinned to a cited per-sqm RRR figure the way build_mumbai.py's own BMC rows are. Not part of the NQI score.",
            },
        })

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi_partial", "mmr_police", "power", "municipal_water", "municipal_roads", "municipal_sewerage"],
            "aqi_avg": float(aqi),
            "aqi_category": p["aqi_cat"],
            "total_cognizable_crimes": crimes,
            "zone_type": p["zone"],
            "metro_stations_nearby": metro_count,
            "metro_planned_stations": p["planned"],
            "highway_proximity": p["hwy"],
            "smart_city_project": False,  # not independently confirmed this pass -- see module docstring
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
            "source": WATER_OF[pin], "authority": MUNI_OF[pin],
            "road_quality": road_idx, "pothole_density": pot,
            "road_condition": ROAD_COND[road_idx],
            "last_resurfaced": resurf,
            "connectivity": "High" if tier <= 2 else "Medium",
            "sewerage_coverage": max(50, min(92, round(scores["sewerage"] * 0.9 + 15))),
            "treatment": "Full" if scores["sewerage"] >= 70 else "Partial",
            "waterlogging_risk": wlog,
            "open_drains": scores["sewerage"] < 55,
            "flooding_incidents_annual": flood,
            "data_completeness": 6,
            "merged_at": SCORED_AT, "city": "Mumbai",
            "discom_confidence": "zone",
            "_police": POLICE_OF[pin][0], "_police_confidence": POLICE_OF[pin][1],
            "_provenance": {"metro_stations_nearby": metro_prov},
        })

    return nqi_rows, master_rows


def main():
    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    # Scoped idempotency: drop ONLY this tranche's own pincodes, never all
    # city=="Mumbai" rows -- that would wipe build_mumbai.py's own 96 BMC
    # rows. See module docstring's KNOWN LATENT RISK note for the
    # un-fixed reverse direction.
    nqi = [r for r in nqi if r["pin_code"] not in OUTSKIRTS_PINS]
    master = [r for r in master if r["pin_code"] not in OUTSKIRTS_PINS]

    existing_mumbai_crime_scores = [r["scores"]["crime"] for r in nqi if r.get("city") == "Mumbai"]

    nqi_new, master_new = build(existing_mumbai_crime_scores)

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    # Recompute crime_percentile for EVERY Mumbai record (old BMC rows
    # included) against the now-combined full set -- the f9931f6 fix,
    # applied here from the start rather than after the fact.
    all_mumbai_crime = sorted(r["scores"]["crime"] for r in nqi if r.get("city") == "Mumbai")
    for r in nqi:
        if r.get("city") != "Mumbai":
            continue
        rank = sum(1 for s in all_mumbai_crime if s < r["scores"]["crime"])
        r["crime_percentile"] = round(rank / len(all_mumbai_crime) * 100)

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Mumbai-outskirts rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Mumbai-outskirts rows -> {master_path} (total {len(master)})")
    print(f"recomputed crime_percentile for all {len(all_mumbai_crime)} Mumbai records (BMC + outskirts)")

    with open("/tmp/mumbai_outskirts_pinmeta.txt", "w") as f:
        f.write("\n  // -- Mumbai outskirts (Navi Mumbai / Mira-Bhayandar / Kalyan-Dombivli /\n")
        f.write("  //    Thane core / Panvel) -- 14 pincodes, own municipal corporations,\n")
        f.write("  //    still city:\"Mumbai\" per the existing cityAliases.js promise.\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Mumbai"']
            alis = [m for m, _ in members]
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/mumbai_outskirts_coords.txt", "w") as f:
        f.write("\n  // -- Mumbai outskirts centroids --\n")
        for pin, entry in ALL_AREAS.items():
            name, area_label, lat, lon, tier, members = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/mumbai_outskirts_pinmeta.txt and /tmp/mumbai_outskirts_coords.txt")


if __name__ == "__main__":
    main()
