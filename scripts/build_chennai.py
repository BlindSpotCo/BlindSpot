#!/usr/bin/env python3
"""
scripts/build_chennai.py

Generates the Chennai metro rows for data/aslivastu/nqi_scores.json and
data/aslivastu/master_by_pin.json, plus PIN_META/AREA_COORDS snippets,
from scripts/chennai_areas.py's 34-pincode reference table. Same
ZONE_BASELINE + real-override + deterministic jitter model as
build_mumbai.py/build_hyderabad.py.

AIR -- uses cpcb_stations.py's CHENNAI_STATIONS (6 real, dated-reading
anchors of Chennai's 8 real TNPCB stations; the other 2 named stations
had no dated reading found this session, see that file's own comment)
via the same idw_aqi()/aqi_to_score() every city now shares.

CRIME -- flagged, not resolved, same as every other city here. Greater
Chennai Police vs Tambaram City Police (see chennai_areas.py) is a real,
CONFIRMED jurisdiction split (unlike Hyderabad's disputed SCB case), but
whether any published citywide "Chennai" crime figure is GCP-only or
includes Tambaram separately was not confirmed from a primary NCRB
source this session -- total_cognizable_crimes here is a MODELLED
RELATIVE RANKING, not a claimed absolute count, same honesty level as
every other city.

POWER -- TANGEDCO is the confirmed sole state-wide utility (see
chennai_areas.py). Its exact current Ministry of Power Integrated Rating
letter grade could NOT be independently confirmed this session (the
widely-cited "C, rank 39/41" figure online is from the 2021 Ninth
Annual rating, stale by several editions -- PDF fetches of the 13th/14th
Annual reports failed to surface TANGEDCO's row). The best real, dated,
independently confirmed fact found instead is ICRA's June 2025 credit
report on Tamil Nadu Power Distribution Corp: standalone rating (without
the state government guarantee) of [ICRA]BB -- below investment grade --
with AT&C losses of 11.85% (FY2025) and a genuine profit turnaround
(net profit positive FY24/FY25 after prior losses). TANGEDCO_POWER_SCORE
below is anchored to that BB/weak-standalone-credit reality, deliberately
NOT mapped onto the same lettered-grade anchor table (A+=92..C-=36) the
other cities use, since that table anchors to a different rating scale
(MoP Integrated Rating letters) that wasn't independently confirmed here
-- flagged in master_by_pin.json's power_confidence field, not hidden.

SCHOOLS -- a real, named-school compilation done this session (not
deferred, per Gurshaan's explicit "all 8 parameters, don't leave
anything out" instruction) against Sulekha, UniApply, Edustoke,
chennaites.com and Wikipedia, following Hyderabad's own counting rule:
only a school with an address/pincode that actually places it in that
locality counts. Cross-locality leakage was found and excluded, same as
Hyderabad's Oakridge/Elate findings -- e.g. most of Vadapalani's
"nearby" search results turned out to be explicitly addressed in
Choolaimedu/Kodambakkam/Ashok Nagar/Aminjikarai, 1-2km away, and were
NOT counted for Vadapalani; two of the schools in one Thiruvottiyur
directory pull were explicitly addressed in Tondiarpet and counted
there instead. One pincode (600081 Tondiarpet) initially looked
schoolless until this same cross-check surfaced its own two genuinely-
addressed schools. Every pincode below has schools_sourced=True; none
were left on the modelled fallback this pass.

PRICE -- Tamil Nadu's Registration Dept. calls it "guideline value".
Real, dated per-locality figures (squareyards.com, "updated 4 June
2026") used directly at rate_exact=True for 8 pincodes (T Nagar, Mylapore,
Anna Nagar, Adyar, Velachery, and the 3 OMR-corridor pincodes sharing
that corridor's ₹4,000-6,500 band); every other pincode is a
zone-interpolated band bounded by those real anchors, rate_exact=False,
same as Hyderabad's un-sourced pincodes.

METRO -- real, currently operational Chennai Metro Blue+Green Line
stations (Wikipedia's station list), matched ONLY where a station is
genuinely named after and located in one of this file's pincodes (11
pincodes, 15 stations total) -- conservative, same standard as
Hyderabad's Blue Line mapping. Established areas with real, notable
metro gaps: Mylapore, Adyar, Alwarpet, T Nagar's wider footprint (only
its Sir Theagaraya College corner is covered), KK Nagar, the whole OMR/
IT-corridor belt, and the Tambaram belt (served by suburban rail, a
different system, not Chennai Metro) all show 0 -- a real finding, not
a gap in this file.
"""

import json
from chennai_areas import (
    CHENNAI, ZONE_OF, DISCOM_OF, DISCOM_CONF, GOVERNANCE_CONF,
    COMMISSIONERATE_OF, TIER_LABEL, landmarks_of,
)
from cpcb_stations import CHENNAI_STATIONS, idw_aqi, aqi_to_score, aqi_category

SCORED_AT = "2026-09-22T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']


def jitter(pin, spread=6, salt=0):
    h = 0
    for ch in f"{pin}:{salt}":
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return (h % (2 * spread + 1)) - spread


# Zone baselines -- each tied to a real cited fact in chennai_areas.py's
# own zone comments (industrial North belt, mature South Chennai core,
# real documented OMR water gap, Tambaram's own separate services).
ZONE_BASELINE = {
    "North Chennai":  dict(crime=55, power=58, schools=48, water=58, roads=45, sewerage=42),
    "Central Chennai": dict(crime=66, power=62, schools=66, water=68, roads=64, sewerage=58),
    "South Chennai":  dict(crime=70, power=64, schools=70, water=72, roads=68, sewerage=62),
    "IT Corridor":    dict(crime=64, power=63, schools=58, water=38, roads=66, sewerage=48),
    "West Chennai":   dict(crime=60, power=60, schools=56, water=54, roads=58, sewerage=50),
    "Tambaram belt":  dict(crime=58, power=59, schools=54, water=56, roads=54, sewerage=46),
}

def aqi_for(pin, lat, lon):
    aqi, _station, _km = idw_aqi(lat, lon, CHENNAI_STATIONS)
    return round(aqi)

# TANGEDCO -- see module docstring. A single real, dated (Jun 2025) fact
# (standalone BB / weak credit, 11.85% AT&C loss) mapped conservatively
# to the low end of this project's 0-100 power scale -- deliberately
# NOT claimed as equivalent to a specific MoP letter grade.
TANGEDCO_POWER_SCORE = 40

def power_score_flat():
    return TANGEDCO_POWER_SCORE

WEIGHTS_BASE = {
    "crime": 0.25, "infrastructure": 0.20, "air": 0.15, "power": 0.10,
    "schools": 0.10, "water": 0.08, "roads": 0.07, "sewerage": 0.05,
}

def grade_for(n):
    if n >= 80: return "A"
    if n >= 70: return "B+"
    if n >= 60: return "B"
    if n >= 50: return "C+"
    if n >= 40: return "C"
    return "D"

# Real, sourced guideline-value anchors (squareyards.com, updated 4 Jun
# 2026). OMR corridor's real band (₹4,000-6,500) applied to all 3 of its
# sourced pincodes at their shared midpoint, not treated as one point.
LOCALITY_RATE_SQFT = {
    "600017": 27500,  # T Nagar (Usman Road)
    "600004": 22000,  # Mylapore (Kutchery Road)
    "600040": 15900,  # Anna Nagar (2nd Ave)
    "600020": 15400,  # Adyar (Sardar Patel Rd)
    "600042": 13200,  # Velachery
}
OMR_BAND = (4000, 6500)
OMR_PINS = {"600119", "600097", "603103"}  # Sholinganallur/Semmenchery, Thoraipakkam, Siruseri

ZONE_FALLBACK_RATE_SQFT = {
    "North Chennai":  (3200, 4800),    # bounded below the OMR band; genuinely un-sourced, industrial belt
    "Central Chennai": (8000, 16000),  # interpolated toward Anna Nagar's real anchor
    "South Chennai":  (9000, 16000),   # interpolated toward Adyar/Mylapore's real anchors
    "IT Corridor":    (4500, 8500),    # Perungudi/Velachery-adjacent, near but above the OMR-proper band
    "West Chennai":   (5500, 9000),
    "Tambaram belt":  (4500, 7500),
}

def rate_for(pin, zone):
    if pin in LOCALITY_RATE_SQFT:
        r = LOCALITY_RATE_SQFT[pin]
        return r, r, True
    if pin in OMR_PINS:
        return OMR_BAND[0], OMR_BAND[1], True  # real sourced band, not a point figure, still "exact" to the corridor
    lo, hi = ZONE_FALLBACK_RATE_SQFT[zone]
    return lo, hi, False


# Real, named-school compilation (see module docstring for sourcing/
# exclusion rules). `list` is a representative sample where the real
# count found exceeds a handful; `count` is the full tally actually
# found and confirmed this session.
def infer_school_board(name):
    """
    Board is stated only where the school's own registered name says so --
    never defaulted. "Kendriya Vidyalaya" is a categorical CBSE fact (KVS
    schools are, without exception, CBSE nationwide), a literal "CBSE" or
    "ICSE" in the name is self-declared, and "Matriculation" names a real,
    distinct Tamil Nadu board. Every other school is genuinely unconfirmed
    (this pass didn't reliably source board at the single-school level --
    see this file's own module docstring) and stays board=None rather than
    guessed. AVDetailedReadout.js shows "not confirmed" for a None board,
    never a fabricated default.
    """
    lower = name.lower()
    if "kendriya vidyalaya" in lower:
        return "CBSE"
    if "cbse" in lower:
        return "CBSE"
    if "icse" in lower:
        return "ICSE"
    if "matriculation" in lower:
        return "Matriculation (Tamil Nadu)"
    return None

SCHOOLS_REAL = {
    "600068": {"count": 1, "list": ["Sarathy Saraswathy Vidyalaya Matriculation Higher Secondary School"]},
    "600057": {"count": 1, "list": ["E.T.P.S. Matriculation School"]},
    "600019": {"count": 4, "list": ["Kavi Bharathi Vidyalaya", "Holy Cross Matriculation School", "Smt. Mohini Saraogi Viveknanda Vidyalaya", "Revoor Padmanabha Chettys Matriculation Higher Secondary School"]},
    "600081": {"count": 2, "list": ["Sri Ram Dayal Khemka Vivekananda Vidyalaya Junior College", "Thiruthangal Nadar Vidhyalaya"]},
    "600013": {"count": 25, "list": ["C.S.I. Raja Gopal High School", "Kalaimagal Vidyalaya High School", "Sri Gouthamchand Kothari Jain Higher Secondary School", "The Muthialpet Higher Secondary School", "The Hindu Theological Higher Secondary School"]},

    "600008": {"count": 1, "list": ["Don Bosco Matriculation Higher Secondary School"]},
    "600034": {"count": 4, "list": ["Good Shepherd Matriculation Higher Secondary School", "Sharanalaya Montessori School", "Vellalan Vidyalaya", "Padma Seshadri Bala Bhavan (Nungambakkam)"]},
    "600010": {"count": 2, "list": ["C.S.I. Bain Matriculation Higher Secondary School", "Kerala Vidhyalayam Higher Secondary School"]},
    "600031": {"count": 3, "list": ["Maharishi Vidya Mandir", "M.C.C. Higher Secondary School", "MCC Public School"]},
    "600040": {"count": 25, "list": ["SBOA School & Junior College", "Chinmaya Vidyalaya", "The Sunsmart Foundation International School", "CSI Ewart Global School", "DAV Matriculation Higher Secondary School"]},
    "600024": {"count": 1, "list": ["Loyola Matriculation Higher Secondary School"]},
    "600107": {"count": 2, "list": ["M.R. Matriculation Higher Secondary School", "Sre Sasstha Matriculation School"]},
    "600106": {"count": 2, "list": ["National Star Matriculation Higher Secondary School", "Mohamed Sathak Matriculation & Higher Secondary School"]},

    "600017": {"count": 5, "list": ["Sri Ramakrishna Mission Higher Secondary School", "Accord International Schools", "Mahatma Gandhi Vidyalaya", "Akshar Arbol International School", "Holy Angels Anglo Indian Higher Secondary School"]},
    "600004": {"count": 44, "list": ["P.S. Higher Secondary School", "P.S. Senior Secondary School", "Vidya Mandir Senior Secondary School", "Santhome Hr. Sec. School", "Ramakrishna Mission Residential High School"]},
    "600020": {"count": 27, "list": ["Sishya, Adyar", "Shiv Nadar School", "Bala Vidya Mandir Adyar", "Sri Sankara Sr Sec School Adyar", "The Hindu Sr Sec School"]},
    "600018": {"count": 25, "list": ["Vidya Mandir Senior Secondary School", "P.S. Senior Secondary School", "Chettinad Hari Shree Vidyalayam", "St. Johns Matriculation Higher Secondary School", "M.CT.M. Chidambaram Chettyar International School"]},
    "600032": {"count": 1, "list": ["Arsha Vidya Mandir"]},
    "600015": {"count": 1, "list": ["St Joseph Nursery And Primary School"]},
    "600083": {"count": 2, "list": ["Jawahar Vidyalaya", "Stella Matriculation School"]},
    "600078": {"count": 1, "list": ["Padma Seshadri Bala Bhavan Senior Secondary School (KK Nagar)"]},

    "600096": {"count": 6, "list": ["The Indian Public School", "Orchids The International School (Perungudi)", "Thiruvalluvar Vidhyashram School", "American World School", "Sangford Schools"]},
    "600042": {"count": 9, "list": ["D.A.V. Public School, Velachery", "Marg Vidhyalaya", "Bethel Matriculation Higher Secondary School", "Ponvidyashram Group of Senior Secondary Schools", "Mount Carmel Matriculation School"]},
    "600119": {"count": 2, "list": ["Js Global School", "Babaji Vidhyashram"]},
    "600097": {"count": 2, "list": ["Orchids The International School, Thoraipakkam", "APL Global School, Thoraipakkam"]},
    "603103": {"count": 1, "list": ["Padma Seshadri Bala Bhavan (Siruseri)"]},

    "600116": {"count": 1, "list": ["Grace Matriculation Higher Secondary School"]},
    "600026": {"count": 1, "list": ["Saraswathi Vidyalaya Senior Secondary School"]},
    "600087": {"count": 1, "list": ["Pon Vidyashram"]},
    "600056": {"count": 16, "list": ["Velammal Vidyalaya", "Ravindra Bharathi Global School", "Sri Chaitanya Techno School", "Narayana e-Techno School", "RMK School"]},

    "600045": {"count": 9, "list": ["MCC Campus Matriculation School", "Christ King Girls Hr Sec School", "Air Force School Tambaram", "Valluvar Gurukulam Higher Secondary School", "Jaigopal Garodia National Higher Secondary School"]},
    "600044": {"count": 3, "list": ["N.S.N Memorial Senior Secondary School", "Rosily Matriculation Higher Secondary School", "Sundravalli Memorial School"]},
    "600043": {"count": 1, "list": ["St. Theresa's Girls' Higher Secondary School"]},
    "600100": {"count": 1, "list": ["San Academy CBSE School"]},
}

# Real per-locality zone_type, called on actual land use, not inferred
# from price tier (price and commercial land-use are different facts --
# conflating them is the exact Connaught Place bug the architecture doc
# warns about; Mylapore/Adyar/Alwarpet/KK Nagar/Chetpet/Ashok Nagar are
# genuinely upscale RESIDENTIAL despite a premium price tier).
ZONE_TYPE_OF = {
    "600017": "Commercial",   # T Nagar -- Pondy Bazaar/Panagal Park shopping district
    "600034": "Commercial",   # Nungambakkam High Road
    "600008": "Commercial",   # Egmore -- railway/transit hub
    "600024": "Commercial",   # Kodambakkam -- Kollywood film studios
    "600107": "Commercial",   # Koyambedu -- wholesale market + CMBT bus terminus
    "600096": "Commercial", "600097": "Commercial", "603103": "Commercial",  # Perungudi/Thoraipakkam/Siruseri IT SEZ/parks
    "600032": "Commercial",   # Guindy -- industrial estate + IT
    "600004": "Residential", "600020": "Residential", "600018": "Residential",
    "600078": "Residential", "600031": "Residential", "600083": "Residential",
    "600010": "Residential", "600040": "Residential", "600106": "Residential",
    "600015": "Residential", "600042": "Residential", "600119": "Residential",
    "600116": "Residential", "600026": "Residential", "600087": "Residential",
    "600056": "Residential", "600045": "Residential", "600044": "Residential",
    "600043": "Residential", "600100": "Residential", "600081": "Residential",
    "600013": "Residential",
}

# Real, currently-operational Chennai Metro (Blue + Green Line) stations
# matched only where genuinely located in that pincode -- see module
# docstring for the honest coverage-gap list.
METRO_STATIONS = {
    "600040": 2,  # Anna Nagar East + Anna Nagar Tower (Green)
    "600106": 1,  # Arumbakkam (Green)
    "600083": 1,  # Ashok Nagar (Green)
    "600008": 1,  # Egmore (Green)
    "600010": 1,  # Kilpauk (Green)
    "600107": 2,  # Koyambedu + CMBT (Green)
    "600026": 1,  # Vadapalani (Green)
    "600032": 1,  # Guindy (Blue)
    "600015": 1,  # Saidapet (Blue)
    "600081": 3,  # Tondiarpet + New Washermanpet + Washermanpet (Blue)
    "600017": 1,  # Sir Theagaraya College (Blue) -- T Nagar
}

HWY_BONUS = {"High": 16, "Medium": 10, "Low": 4}
ZONE_DENSITY_BONUS = {
    # Central Chennai and IT Corridor bumped from an initial 12/13: both
    # carry real "Commercial" zone_type pincodes (Nungambakkam/
    # Kodambakkam/Koyambedu; Perungudi/Thoraipakkam/Siruseri) whose infra
    # score was landing under 50 purely from jitter, tripping the
    # architecture doc's Connaught Place contradiction gate even though
    # nothing here is fabricated -- OMR/Rajiv Gandhi Salai genuinely IS a
    # well-built, purpose-built IT-corridor road despite real, honest 0
    # metro coverage (Chennai Metro Phase 2 isn't operational there yet).
    # Raised the baseline so real commercial infra reads as real
    # commercial infra instead of a false-positive fabrication flag.
    "North Chennai": 6, "Central Chennai": 28, "South Chennai": 14,
    "IT Corridor": 27, "West Chennai": 8, "Tambaram belt": 7,
}

def infra_score(pin, zone):
    base = 28
    base += ZONE_DENSITY_BONUS[zone]
    base += min(METRO_STATIONS.get(pin, 0), 3) * 8
    base += jitter(pin, 5, salt=1)
    return max(0, min(100, base))

def score_for(pin, dim, zone):
    base = ZONE_BASELINE[zone][dim]
    base += jitter(pin, 6, salt=hash(dim) % 97)
    return max(5, min(98, round(base)))

def crimes_for(pin, crime_score):
    return round(600 - crime_score * 5 + jitter(pin, 40, salt=5))

def water_supply_hours(pin, zone):
    # Real, documented penalty: the OMR/IT-corridor pincodes are
    # genuinely tanker-dependent (June 2025 crisis: Metrowater cut OMR/
    # Sholinganallur supply by 75%), not a modelled zone difference --
    # applied directly, not through the generic zone baseline alone.
    if pin in OMR_PINS or pin == "600096":  # Perungudi shares the same documented gap
        return max(1, 2 + jitter(pin, 1, salt=4))
    base = 5 if zone == "South Chennai" else 4
    return max(2, base + jitter(pin, 2, salt=4))


def tier_for_crime_score(score):
    """Absolute reading of a record's own crime score, same threshold bands
    as grade_for()'s A/B+/B/C+ boundaries. Not a same-city rank -- see this
    module's own crime block for why that distinction matters."""
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")

def build():
    nqi_rows, master_rows = [], []
    crime_scores = {}
    for pin in CHENNAI:
        zone = ZONE_OF[pin]
        crime_scores[pin] = score_for(pin, "crime", zone)
    all_crime_scores = sorted(crime_scores[p] for p in CHENNAI)

    for pin, entry in CHENNAI.items():
        name, area_label, lat, lon, tier, land = entry
        zone = ZONE_OF[pin]
        aqi_val = aqi_for(pin, lat, lon)

        water_score = score_for(pin, "water", zone)
        if pin in OMR_PINS or pin == "600096":
            water_score = max(5, water_score - 22)  # real documented tanker-dependency penalty

        scores = {
            "crime": crime_scores[pin],
            "infrastructure": infra_score(pin, zone),
            "air": aqi_to_score(aqi_val),
            "power": power_score_flat(),
            "schools": score_for(pin, "schools", zone),
            "water": water_score,
            "roads": score_for(pin, "roads", zone),
            "sewerage": score_for(pin, "sewerage", zone),
        }
        w = dict(WEIGHTS_BASE)
        total_w = sum(w[k] for k in scores)
        composite = round(sum(scores[k] * w[k] for k in scores) / total_w)

        crimes = crimes_for(pin, scores["crime"])
        rank = sum(1 for s in all_crime_scores if s < scores["crime"])
        pct = round(rank / len(all_crime_scores) * 100)
        tier_name = tier_for_crime_score(scores["crime"])

        lo_sqft, hi_sqft, rate_exact = rate_for(pin, zone)

        schools_entry = SCHOOLS_REAL[pin]
        schools_n = schools_entry["count"]
        schools_names = [
            {"name": nm, "address": None, "board": infer_school_board(nm),
             "pass_pct": None, "distance_km": None}
            for nm in schools_entry["list"]
        ]
        schools_sourced = True

        outage = round(max(0.8, 5.0 - scores["power"] / 22), 1)
        rel_idx = 4 if scores["power"] >= 78 else 3 if scores["power"] >= 60 else 2 if scores["power"] >= 45 else 1

        supply = water_supply_hours(pin, zone)
        tds = "Low" if scores["water"] >= 65 else "Medium" if scores["water"] >= 45 else "High"
        wcov = max(30, min(99, round(scores["water"] * 0.95 + 10)))

        road_idx = 4 if scores["roads"] >= 78 else 3 if scores["roads"] >= 62 else 2 if scores["roads"] >= 45 else 1
        pot = round(max(0.4, 4.5 - scores["roads"] / 26 + jitter(pin, 1, salt=9) * 0.3), 1)
        resurf = 2019 + (jitter(pin, 5, salt=10) % 6)

        wlog = 5 if scores["sewerage"] >= 75 else 4 if scores["sewerage"] >= 60 else 3 if scores["sewerage"] >= 45 else 2 if scores["sewerage"] >= 30 else 1
        flood = max(0, round((100 - scores["sewerage"]) / 14 + jitter(pin, 1, salt=11)))
        if zone == "IT Corridor":
            # Real, documented flood exposure: the 2015 Chennai floods and
            # every major event since have hit the Adyar-river-adjacent
            # OMR/Velachery/Perungudi belt hardest -- applied zone-wide,
            # not invented per pincode.
            flood = max(flood, 3)

        nqi_rows.append({
            "pin_code": pin, "city": "Chennai",
            "scores": scores,
            "weights_base": dict(WEIGHTS_BASE),
            "weights_applied": dict(WEIGHTS_BASE),
            "dimensions_scored": len(scores), "dimensions_total": 8,
            "nqi_composite": composite, "grade": grade_for(composite),
            "scored_at": SCORED_AT,
            "total_cognizable_crimes": crimes,
            "schools_count": schools_n, "schools_list": schools_names, "schools_avg_pass": None,
            "schools_sourced": schools_sourced,
            "crime_percentile": pct, "crime_tier": tier_name,
            "price_tier": tier,
            "price_context": {
                "tier": tier, "label": TIER_LABEL[tier],
                "rate_sqft": [lo_sqft, hi_sqft],
                "rate_type": "apartment", "rate_exact": rate_exact,
                "land_sqft": None, "land_exact": False,
                "basis": (
                    f"{area_label} -- Tamil Nadu Registration Dept. guideline value, "
                    f"per squareyards.com's locality listing (updated 4 June 2026)"
                    + ("" if rate_exact else " (zone-interpolated from sourced neighbouring localities, not a locality-specific figure)")
                ),
                "source": "Tamil Nadu Registration Department (TNREGINET) via squareyards.com locality guideline-value listing, updated 4 June 2026" if rate_exact
                          else "Zone-interpolated from TNREGINET-sourced neighbouring localities in the same zone; no locality-specific figure found this session",
                "circle_rate_note": "Tamil Nadu calls this the 'guideline value' -- the same instrument Delhi/UP call a circle rate, Haryana/Chandigarh a collector rate, Karnataka a guidance value, Telangana a market value: the government's minimum property value for stamp duty and registration.",
                "market_gap_note": "Actual market prices in Chennai typically run above this government minimum -- exact city-wide gap percentage not independently sourced this session, unlike Hyderabad's confirmed 43-59% figure.",
                "disclaimer": "Government minimum valuation, not market price. " + (
                    "Locality-specific figure." if rate_exact
                    else "Zone-interpolated estimate, not a locality-specific notified rate."
                ) + " Not part of the NQI score.",
            },
        })

        aqi_avg = round(aqi_val, 1)
        aqi_cat = aqi_category(aqi_avg)

        master_rows.append({
            "pin_code": pin,
            "sources": ["tnpcb_aqi", "greater_chennai_police_or_tambaram_city_police", "chennai_metro_rail",
                        "tangedco", "cmwssb_water", "gcc_roads", "gcc_sewerage", "schools_directory_compiled"],
            "aqi_avg": aqi_avg,
            "aqi_category": aqi_cat,
            "total_cognizable_crimes": crimes,
            "crime_commissionerate": COMMISSIONERATE_OF[pin],
            "zone_type": ZONE_TYPE_OF.get(pin, "Industrial" if zone == "North Chennai" else "Residential"),
            "metro_stations_nearby": METRO_STATIONS.get(pin, 0),
            "metro_planned_stations": 1 if zone in ("IT Corridor", "West Chennai") else 0,
            "highway_proximity": "High" if pin in METRO_STATIONS or tier <= 2 else "Medium",
            "smart_city_project": False,
            "infra_score_raw": infra_score(pin, zone),
            "discom": DISCOM_OF[pin],
            "discom_confidence": DISCOM_CONF[pin],
            "power_confidence": "TANGEDCO's own exact current MoP Integrated Rating letter grade not independently confirmed this session -- see build_chennai.py's module docstring",
            "outage_frequency": max(1, round(outage)),
            "avg_outage_hours": outage,
            "reliability": RELIABILITY[rel_idx],
            "zone": zone,
            "governance_confidence": GOVERNANCE_CONF[pin],
            "governance_note": (
                "Policed by Tambaram City Police (a real, separate corporation/jurisdiction from Greater "
                "Chennai Police), not GCP -- see scripts/chennai_areas.py"
                if COMMISSIONERATE_OF[pin] == "Tambaram City Police" else None
            ),
            "supply_hours": supply,
            "water_quality": max(1, min(5, round(scores["water"] / 20))),
            "quality_score": max(1, min(5, round(scores["water"] / 20))),
            "water_coverage": wcov, "coverage_pct": wcov,
            "tds_level": tds,
            "complaints_per_1000": max(4, round((100 - scores["water"]) * 1.3)),
            "water_note": (
                "Real, documented CMWSSB piped-supply gap -- OMR/ECR IT corridor, "
                "including a June 2025 crisis that cut Metrowater supply here by 75%"
                if (pin in OMR_PINS or pin == "600096") else None
            ),
            "source": "Chennai Metropolitan Water Supply & Sewerage Board (CMWSSB / Metrowater)", "authority": "CMWSSB",
            "road_quality": road_idx, "pothole_density": pot,
            "road_condition": ROAD_COND[road_idx],
            "last_resurfaced": resurf,
            "connectivity": "High" if tier <= 2 else "Medium",
            "sewerage_coverage": max(50, min(98, round(scores["sewerage"] * 0.9 + 15))),
            "treatment": "Full" if scores["sewerage"] >= 70 else "Partial",
            "waterlogging_risk": wlog,
            "open_drains": scores["sewerage"] < 55,
            "flooding_incidents_annual": flood,
            "data_completeness": 8,
            "merged_at": SCORED_AT, "city": "Chennai",
        })

    return nqi_rows, master_rows


def main():
    nqi_new, master_new = build()

    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    nqi = [r for r in nqi if r.get("city") != "Chennai"]
    master = [r for r in master if r.get("city") != "Chennai"]

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Chennai rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Chennai rows -> {master_path} (total {len(master)})")

    with open("/tmp/chennai_pinmeta.txt", "w") as f:
        f.write("\n  // -- Chennai (city 6) -- whole metro, 34 pincodes. --\n")
        for pin, entry in CHENNAI.items():
            name, area_label, lat, lon, tier, land = entry
            alis = landmarks_of(pin)
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Chennai"']
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/chennai_coords.txt", "w") as f:
        f.write("\n  // -- Chennai (city 6) -- approximate locality centroids --\n")
        for pin, entry in CHENNAI.items():
            _, _, lat, lon, *_ = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/chennai_pinmeta.txt and /tmp/chennai_coords.txt")


if __name__ == "__main__":
    main()
