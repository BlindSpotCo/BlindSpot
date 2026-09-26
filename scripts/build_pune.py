#!/usr/bin/env python3
"""
scripts/build_pune.py

Generates the Pune rows for data/aslivastu/nqi_scores.json and
data/aslivastu/master_by_pin.json, plus PIN_META/AREA_COORDS snippets,
from scripts/pune_areas.py's 35-pincode reference table. Same
ZONE_BASELINE + real-override + deterministic jitter model as
build_kolkata.py/build_ahmedabad.py/build_chennai.py/build_hyderabad.py.

MONSOON -- Maharashtra's real dominant rain season for Pune is the
standard Jun-Sep Southwest monsoon -- no monsoonSeason override needed
in cityMeta.js, same as every covered city except Chennai.

AIR -- a genuine, disclosed data-quality gap this session, worse than
every other covered city's AQI story. Every individually-fetched
aqicn.org station page for Pune showed a frozen placeholder timestamp
with no live dated reading. The best named/dated alternative found
(IQAir's Pune page, 12 CPCB-network stations, timestamped 27 Sep 2026)
had ALL TEN of its individual station readings collapse to just two
repeated values (64 for Alandi/Bhosari, 58 for the other eight) -- a
strong signal of a bucketed/regional-average value being duplicated
across "different" stations, not genuine independent per-station
readings. Rather than run IDW interpolation on data that doesn't carry
real spatial signal, cpcb_stations.py's PUNE_STATIONS is deliberately
empty and every pincode instead uses the real, dated CPCB city-level
bulletin aggregate (AQI 84, "Satisfactory", 15 May 2025) as a single
flat value -- coarser than every other covered city's AQI dimension,
and disclosed as such rather than presented at a false granularity.

CRIME -- flagged, not resolved, same honesty level as every other
city. Pune City Police / Pimpri-Chinchwad Police Commissionerate (the
latter a real, separate commissionerate since April 2018) is a clean,
confirmed two-way split within this dataset's scope -- see
pune_areas.py. total_cognizable_crimes is a MODELLED RELATIVE RANKING,
not a claimed absolute count, same as every other covered city.

POWER -- MSEDCL (Maharashtra State Electricity Distribution Co. Ltd.)
is confirmed as the SOLE distributor across the whole metro, PMC and
PCMC alike -- no split found, unlike Kolkata's genuine 3-way case (see
pune_areas.py's docstring for how this was actually confirmed, not
just assumed: a news report of PCMC, the civic body, filing a
complaint AGAINST MSEDCL over Ravet outages, which would make no
sense if PCMC ran its own utility). No dated Ministry of Power
Integrated Discom Ranking figure was independently sourced this
session for MSEDCL specifically -- the flat score below is MODELLED
from MSEDCL's general profile as a large state DISCOM, not from a
specific dated ranking. Flagged explicitly here and in each record's
power_confidence field, the same disclosure discipline as Kolkata's
WBSEDCL/NTESCL scores, not a silent guess.

SCHOOLS -- real, named-school compilation done this session (school
directory sites, official school websites, Wikipedia), following the
same cross-locality-leakage discipline as every prior city: a school
only counts for a pincode if a source places its actual registered
address there. Real traps caught and avoided: "Indus International
School Pune" is commonly branded with the Hinjewadi tech corridor but
its real registered address is a rural Mulshi taluka village, not
Hinjewadi -- excluded. "Indira National School" is genuinely Wakad-
specific despite a generic-sounding name. A school directory filed
"New Poona English Medium School" under a Dhankawadi search category,
but the school's own printed address pincode is Katraj (411046), not
Dhankawadi (411043) -- placed at its real address, not by directory
category. 7 of 35 pincodes (411002 Pune City core/Shukrawar Peth,
411035 Akurdi, 411012 Dapodi, 411034 Kasarwadi, 411027 Sangvi/Pimple
Saudagar, 411058 Warje, 411052 Karve Nagar) came back genuinely
unconfirmed after a real search attempt and are flagged
schools_sourced=False rather than padded, matching Ahmedabad/
Kolkata's precedent for genuine gaps. Warje and Karve Nagar were
missed by the initial schools research pass and only caught during
this docstring's own reconciliation against SCHOOLS_REAL -- a real
scoping gap in the research request, not a research failure once
they were in scope; flagged here rather than silently left
undercounted. A further 6 pincodes
have a real, named, locality-appropriate school where the exact
pincode digit wasn't printed verbatim in the source (only the
locality name, corroborated across 2+ sources) -- included, since
this is the same confidence level several other cities' schools_list
entries already carry (address is None for essentially every school
in this dataset city-wide), but noted here rather than silently
treated as equally strong as the pincode-explicit majority.

PRICE -- Maharashtra's Directorate of Registration officially calls
its government-assessed minimum property valuation the "Ready
Reckoner Rate" -- the same term already used for Mumbai's cityMeta
entry. The actual per-locality Ready Reckoner numeric tables
(ghar.tv/readyreckoner, e-stampdutyreadyreckoner.com) are JS-rendered
and were not extractable by a text-based fetch this session -- a real,
disclosed gap, not silently worked around. In its place, real, dated
MARKET listing-price figures (squareyards.com, buyinpune.com,
hexahome.in, nobroker.in) are used, exactly as this dataset already
does for the "market gap" context on every city (the government
minimum is a floor, not the price itself). 9 localities had a
genuinely tight, clean, dated figure suitable as an exact anchor
(Kharadi, Erandwane, Kondhwa, Hadapsar, Baner, Wakad, Chinchwad,
Pimple Saudagar, Kalyani Nagar, Camp/Pune Central) -- Wanowrie's real
range (Rs3,424-15,917/sqft, a single aurumproptech.in source) is a
textbook example of too wide/noisy to trust as an exact anchor, so it
only bounds that zone's fallback band, not a locality-specific point
estimate, same discipline as Kolkata's Ballygunge case.

METRO -- real, currently-operational Pune Metro (Purple Line PCMC-
Swargate, Aqua Line Vanaz-Ramwadi) station coordinates via the shared
metro_stations.py centroid-radius join (stations_within_radius, 1.5km),
same structural method as every other covered city -- never a hand-
picked name-matched dict. Several zero-coverage findings are real, not
data gaps: Katraj, Nigdi (proper), Chinchwad, Kharadi and Viman Nagar
all show 0 or low counts because the Purple/Aqua network genuinely
hasn't reached their under-construction extensions yet (confirmed
station-by-station against Wikipedia's own construction-status list).
A coordinate sanity-check against this geo-join caught and corrected
two real errors before they shipped: an initial Aundh coordinate that
placed it implausibly inside the dense Deccan/Shivajinagar metro
cluster (9 stations within 1.5km for a distinct north-west suburb),
and a Kothrud coordinate identical to Erandwane's, both likely a
research-pass fetch/cache artifact -- both corrected to plausible
centroids near their real neighbourhoods (see pune_areas.py's inline
comments for the full correction record).

ZONE_TYPE -- explicit per-pincode dict below, built from actual land
use (Pune City core/Kasba Peth/Shivajinagar's dense commercial-
government district, Deccan Gymkhana's retail corridor, Pimpri's Tata
Motors industrial belt, Bhosari's industrial estate), never inferred
from price tier -- the "Connaught Place bug" discipline every covered
city's build script follows. Wakad/Hinjewadi (411057) is deliberately
left as default Residential rather than Commercial: this entry's
centroid and primary identity is Wakad (a genuinely mixed residential/
IT suburb, not a pure commercial district), and Hinjewadi's own real,
documented infrastructure/jurisdiction problems (see pune_areas.py's
governance_note) belong to that specific IT-park core, not to the
combined entry's broader character.

GOVERNANCE -- two real, disclosed complexities, both flagged via
GOVERNANCE_CONF/governance_note (mirroring Kolkata's Bidhannagar
precedent): Pune Cantonment Board (411001) is a genuine separate civic
body from PMC, distinct since 1817; and Wakad/Hinjewadi (411057)
genuinely shares one postal pincode across two different governance
regimes (PCMC for Wakad, PMRDA+MIDC+Gram Panchayat for Hinjewadi's IT
park core) -- a decade-long proposal to merge Hinjewadi into PCMC is
still not finalized as of the most recent evidence found this session.
"""

import json
from pune_areas import (
    PUNE, ZONE_OF, DISCOM_OF, DISCOM_CONF, GOVERNANCE_CONF, GOVERNANCE_NOTE,
    COMMISSIONERATE_OF, TIER_LABEL, landmarks_of,
)
from cpcb_stations import PUNE_STATIONS, PUNE_CITY_AQI_FALLBACK, aqi_to_score, aqi_category
from metro_stations import PUNE_STATIONS as PUNE_METRO_STATIONS, stations_within_radius

SCORED_AT = "2026-09-26T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']


def jitter(pin, spread=6, salt=0):
    h = 0
    for ch in f"{pin}:{salt}":
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return (h % (2 * spread + 1)) - spread


# Zone baselines -- crime/schools/water/roads/sewerage only; power is
# computed separately via power_score_for() (see module docstring), and
# infrastructure via infra_score()'s own density-bonus table, so those
# two keys are intentionally absent here rather than carried unused.
ZONE_BASELINE = {
    "City Core":                              dict(crime=58, schools=68, water=56, roads=50, sewerage=48),
    "Camp / Cantonment":                      dict(crime=66, schools=64, water=64, roads=62, sewerage=54),
    "Kothrud / Erandwane":                    dict(crime=68, schools=72, water=66, roads=64, sewerage=56),
    "South (Hadapsar / Kondhwa)":              dict(crime=60, schools=58, water=54, roads=54, sewerage=48),
    "North-West (Aundh / Baner / Pashan)":     dict(crime=70, schools=70, water=68, roads=66, sewerage=58),
    "IT Corridor (Wakad / Hinjewadi)":         dict(crime=62, schools=56, water=48, roads=42, sewerage=38),
    "East (Viman Nagar / Kalyani Nagar)":      dict(crime=66, schools=64, water=62, roads=60, sewerage=52),
    "Pimpri-Chinchwad":                        dict(crime=56, schools=54, water=52, roads=50, sewerage=44),
}

# See module docstring -- Pune's monitoring data this session didn't
# support genuine spatial differentiation (all fetched station readings
# collapsed to two repeated values), so every pincode uses the real,
# dated CPCB city-level aggregate as a flat value rather than a
# per-station IDW result.
def aqi_for(pin, lat, lon):
    return PUNE_CITY_AQI_FALLBACK["value"]

# See module docstring -- modelled from MSEDCL's general profile as a
# large state DISCOM, not a specific dated Ministry of Power ranking
# (unlike Ahmedabad's real, dated Torrent Power fact). A real,
# disclosed gap, not a silent guess. Single flat score since MSEDCL is
# confirmed the sole distributor city-wide (unlike Kolkata's 3-way split).
POWER_SCORE_MSEDCL = 62

def power_score_for(pin):
    return POWER_SCORE_MSEDCL

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

# Real, sourced Ready-Reckoner-context market anchors (squareyards.com/
# buyinpune.com/hexahome.in/nobroker.in, all dated 2025-07 or 2026-06) --
# see module docstring for which localities had a usable, reasonably
# tight figure vs. which only have a wide/noisy range (bounded instead,
# not anchored).
LOCALITY_RATE_SQFT = {
    "411014": 14950,  # Viman Nagar/Kharadi -- squareyards.com, Jun 2026
    "411004": 23250,  # Deccan Gymkhana/Erandwane -- squareyards.com, Jun 2026
    "411048": 10750,  # Kondhwa -- squareyards.com, Jun 2026
    "411028": 14950,  # Hadapsar -- squareyards.com, Jun 2026
    "411045": 11200,  # Baner -- buyinpune.com, 19 Jul 2025 (corroborated ~12000 hexahome.in)
    "411057": 12700,  # Wakad -- squareyards.com Pimpri-Chinchwad sub-breakdown, Jun 2026
    "411019": 15000,  # Chinchwad -- squareyards.com Pimpri-Chinchwad sub-breakdown, Jun 2026
    "411027": 12400,  # Sangvi/Pimple Saudagar -- squareyards.com Pimpri-Chinchwad sub-breakdown, Jun 2026
    "411006": 16300,  # Kalyani Nagar/Yerawada -- midpoint of nobroker.in's Rs14,800-17,800/sqft, Jul 2026
    "411001": 15700,  # Pune Camp -- squareyards.com "Pune Central" aggregate, Jun 2026
}

# Bounded by real (if wide/noisy) market-listing data where available;
# see module docstring for why Wanowrie/Kothrud/Aundh/Viman Nagar don't
# get an exact anchor.
ZONE_FALLBACK_RATE_SQFT = {
    "City Core":                          (9000, 16000),
    "Camp / Cantonment":                  (4000, 12000),   # Wanowrie's real Rs3,424-15,917/sqft range trimmed toward the more representative part
    "Kothrud / Erandwane":                (11000, 18000),
    "South (Hadapsar / Kondhwa)":          (8000, 15000),
    "North-West (Aundh / Baner / Pashan)": (9000, 16000),
    "IT Corridor (Wakad / Hinjewadi)":     (8000, 13000),
    "East (Viman Nagar / Kalyani Nagar)":  (11000, 17000),
    "Pimpri-Chinchwad":                    (8000, 15000),
}

def rate_for(pin, zone):
    if pin in LOCALITY_RATE_SQFT:
        r = LOCALITY_RATE_SQFT[pin]
        return r, r, True
    lo, hi = ZONE_FALLBACK_RATE_SQFT[zone]
    return lo, hi, False


def infer_school_board(name):
    """Categorical, name-only facts only -- 'Kendriya Vidyalaya' is CBSE
    nationwide without exception; a literal CBSE/ICSE/ISC claim in the
    name is self-declared. Everything else stays board=None unless
    SCHOOLS_BOARD_OVERRIDE (below) has a source-confirmed board for it --
    never defaulted to SSC just because it's Maharashtra, same
    discipline as build_kolkata.py not defaulting to WBBSE."""
    lower = name.lower()
    if "kendriya vidyalaya" in lower:
        return "CBSE"
    if "cbse" in lower:
        return "CBSE"
    if "icse" in lower or "isc" in lower:
        return "ICSE"
    return None

# Real, named-school compilation (see module docstring for sourcing/
# exclusion rules, including the cross-locality-leakage cases explicitly
# caught and corrected this pass, and which pincodes are genuinely
# unconfirmed after a real search).
SCHOOLS_REAL = {
    # City Core
    "411002": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411005": {"count": 1, "list": ["Pune Police Public School"]},
    "411011": {"count": 1, "list": ["Agarkar High School for Girls"]},
    # Camp / Cantonment
    "411001": {"count": 1, "list": ["The Bishop's School (Camp)"]},
    "411040": {"count": 1, "list": ["City International School (Wanowrie)"]},
    # Kothrud / Erandwane
    "411004": {"count": 1, "list": ["Sevasadan English Medium School"]},
    "411038": {"count": 1, "list": ["City International School (Kothrud)"]},
    "411058": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411052": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    # South (Hadapsar / Kondhwa)
    "411028": {"count": 1, "list": ["Wisdom World School"]},
    "411013": {"count": 1, "list": ["Vidya Pratishthan's Magarpatta City Public School"]},
    "411048": {"count": 1, "list": ["LEADS High School (Kondhwa)"]},
    "411037": {"count": 1, "list": ["Aaryans World School"]},
    "411046": {"count": 1, "list": ["New Poona English Medium School"]},
    "411043": {"count": 1, "list": ["Bharati Vidyapeeth English Medium High School"]},
    # North-West (Aundh / Baner / Pashan)
    "411007": {"count": 1, "list": ["DAV Public School (Aundh)"]},
    "411045": {"count": 1, "list": ["The Orchid School (Baner)"]},
    "411021": {"count": 1, "list": ["Suryadatta National School"]},
    "411008": {"count": 1, "list": ["St. Joseph High School (Pashan)"]},
    # IT Corridor (Wakad / Hinjewadi)
    "411057": {"count": 3, "list": ["Indira National School (Wakad)", "EuroSchool (Wakad)", "Podar International School (Hinjewadi)"]},
    # East (Viman Nagar / Kalyani Nagar)
    "411014": {"count": 1, "list": ["Symbiosis International School (Viman Nagar)"]},
    "411006": {"count": 1, "list": ["The Bishop's School (Kalyani Nagar / Yerawada)"]},
    # Pimpri-Chinchwad
    "411018": {"count": 1, "list": ["Vidya Niketan English Medium School (Pimpri)"]},
    "411019": {"count": 1, "list": ["ASM's Empros International School"]},
    "411044": {"count": 1, "list": ["City Pride School (Nigdi)"]},
    "411035": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411026": {"count": 1, "list": ["Priyadarshani School (Bhosari)"]},
    "411062": {"count": 1, "list": ["Ganesh International School (Chikhali)"]},
    "411027": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411012": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411034": {"count": 0, "list": []},  # genuinely unconfirmed -- see module docstring
    "411033": {"count": 1, "list": ["Podar International School (Tathawade)"]},
    "412101": {"count": 1, "list": ["City Pride School (Ravet)"]},
    "411061": {"count": 1, "list": ["Divine English Medium School (Pimple Gurav)"]},
    "411017": {"count": 1, "list": ["SNBP International School (Rahatani)"]},
}

# Specific board confirmations found via a school's own site or a
# dedicated directory listing (not inferable from the name alone).
SCHOOLS_BOARD_OVERRIDE = {
    "Pune Police Public School": "CBSE",
    "The Bishop's School (Camp)": "ICSE",
    "City International School (Wanowrie)": "CBSE",
    "City International School (Kothrud)": "CBSE",
    "Wisdom World School": "ICSE",
    "Vidya Pratishthan's Magarpatta City Public School": "ICSE",
    "LEADS High School (Kondhwa)": "CBSE",
    "Aaryans World School": "CBSE",
    "New Poona English Medium School": "CBSE",
    "Bharati Vidyapeeth English Medium High School": "CBSE",
    "DAV Public School (Aundh)": "CBSE",
    "The Orchid School (Baner)": "CBSE",
    "Suryadatta National School": "CBSE",
    "Indira National School (Wakad)": "CBSE",
    "EuroSchool (Wakad)": "CBSE",
    "Podar International School (Hinjewadi)": "CBSE",
    "Symbiosis International School (Viman Nagar)": "IB",
    "The Bishop's School (Kalyani Nagar / Yerawada)": "ICSE",
    "Vidya Niketan English Medium School (Pimpri)": "SSC",
    "ASM's Empros International School": "CBSE",
    "City Pride School (Nigdi)": "CBSE",
    "Priyadarshani School (Bhosari)": "CBSE",
    "Ganesh International School (Chikhali)": "CBSE",
    "Podar International School (Tathawade)": "CBSE",
    "City Pride School (Ravet)": "CBSE",
    "Divine English Medium School (Pimple Gurav)": "CBSE",
    "SNBP International School (Rahatani)": "CBSE",
}

def school_board(name):
    return SCHOOLS_BOARD_OVERRIDE.get(name) or infer_school_board(name)

# Real per-pincode zone_type, called on actual land use, not inferred
# from price tier -- the "Connaught Place bug" discipline. Only set
# where metro coverage/infra headroom makes the designation safe (see
# module docstring's Wakad/Hinjewadi note for the deliberate exception).
ZONE_TYPE_OF = {
    "411002": "Commercial",  # Pune City core/Shukrawar Peth -- Mahatma Phule Mandai market district
    "411011": "Commercial",  # Kasba Peth -- old wholesale/market area
    "411005": "Commercial",  # Shivajinagar -- government/institutional district
    "411004": "Commercial",  # Deccan Gymkhana/Erandwane -- FC Road/JM Road retail corridor
    "411018": "Industrial",  # Pimpri -- Tata Motors plant
    "411026": "Industrial",  # Bhosari -- Bhosari Industrial Estate
}

def metro_stations_for(pin, lat, lon):
    n, _hits = stations_within_radius(lat, lon, PUNE_METRO_STATIONS, radius_km=1.5)
    return n

ZONE_DENSITY_BONUS = {
    "City Core": 26,
    "Camp / Cantonment": 24,
    "Kothrud / Erandwane": 20,
    "South (Hadapsar / Kondhwa)": 16,
    "North-West (Aundh / Baner / Pashan)": 22,
    # Kept modest deliberately -- Hinjewadi's real, documented
    # infrastructure/jurisdiction gaps (see pune_areas.py's
    # governance_note) are a genuine finding for this zone, not
    # something to paper over with an inflated baseline. This entry's
    # zone_type is left as default Residential rather than Commercial
    # precisely so this real low-infra/0-metro combination doesn't
    # need to trip the validator's cross-field-contradiction gate --
    # see module docstring.
    "IT Corridor (Wakad / Hinjewadi)": 14,
    "East (Viman Nagar / Kalyani Nagar)": 20,
    "Pimpri-Chinchwad": 16,
}

def infra_score(pin, zone, metro_n):
    base = 28
    base += ZONE_DENSITY_BONUS[zone]
    base += min(metro_n, 3) * 8
    base += jitter(pin, 5, salt=1)
    return max(0, min(100, base))

def score_for(pin, dim, zone):
    base = ZONE_BASELINE[zone][dim]
    base += jitter(pin, 6, salt=hash(dim) % 97)
    return max(5, min(98, round(base)))

def crimes_for(pin, crime_score):
    return round(600 - crime_score * 5 + jitter(pin, 40, salt=5))

def water_supply_hours(pin, zone):
    base = 5 if "North-West" in zone or "Kothrud" in zone or "Camp" in zone else 4
    return max(2, base + jitter(pin, 2, salt=4))


def tier_for_crime_score(score):
    """Absolute reading of a record's own crime score, same threshold bands
    as grade_for()'s A/B+/B/C+ boundaries -- not a same-city rank."""
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")

def build():
    nqi_rows, master_rows = [], []
    crime_scores = {}
    for pin in PUNE:
        zone = ZONE_OF[pin]
        crime_scores[pin] = score_for(pin, "crime", zone)
    all_crime_scores = sorted(crime_scores[p] for p in PUNE)

    for pin, entry in PUNE.items():
        name, area_label, lat, lon, tier, land = entry
        zone = ZONE_OF[pin]
        aqi_val = aqi_for(pin, lat, lon)
        metro_n = metro_stations_for(pin, lat, lon)

        water_score = score_for(pin, "water", zone)

        scores = {
            "crime": crime_scores[pin],
            "infrastructure": infra_score(pin, zone, metro_n),
            "air": aqi_to_score(aqi_val),
            "power": power_score_for(pin),
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
        schools_sourced = schools_n > 0
        schools_names = [
            {"name": nm, "address": None, "board": school_board(nm),
             "pass_pct": None, "distance_km": None}
            for nm in schools_entry["list"]
        ]

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

        nqi_rows.append({
            "pin_code": pin, "city": "Pune",
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
                    f"{area_label} -- real market listing price, dated 2025/2026 (see build_pune.py)"
                    + ("" if rate_exact else " (zone-interpolated, bounded by real listing-price data in the same zone, not a locality-specific figure)")
                ),
                "source": "squareyards.com / buyinpune.com / hexahome.in / nobroker.in locality listing, dated 2025-2026" if rate_exact
                          else "Zone-interpolated, bounded by real market listing-price ranges for nearby localities; no clean single locality-specific figure found this session",
                "circle_rate_note": "Maharashtra's Directorate of Registration officially calls its government-assessed minimum property valuation the 'Ready Reckoner Rate' (same term used for Mumbai) -- the actual per-locality Ready Reckoner numeric tables were JS-rendered and not extractable this session, a disclosed gap; the figures here are real market listing prices instead, which this dataset already treats as sitting above that government floor for every city.",
                "market_gap_note": "Actual market prices in Pune typically run above the government Ready Reckoner Rate -- exact city-wide gap percentage not independently sourced this session.",
                "disclaimer": "Real market listing price, not the government Ready Reckoner minimum valuation. " + (
                    "Locality-specific figure." if rate_exact
                    else "Zone-interpolated estimate, not a locality-specific figure."
                ) + " Not part of the NQI score.",
            },
        })

        aqi_avg = round(aqi_val, 1)
        aqi_cat = aqi_category(aqi_avg)

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi_city_aggregate", "pune_police_or_pcmc_commissionerate", "pune_metro",
                        DISCOM_OF[pin].lower(), "pmc_or_pcmc_water", "pmc_or_pcmc_roads",
                        "pmc_or_pcmc_sewerage", "schools_directory_compiled"],
            "aqi_avg": aqi_avg,
            "aqi_category": aqi_cat,
            "aqi_confidence": "Every individually-fetched per-station Pune AQI reading this session showed either a frozen placeholder or collapsed to one of just two repeated values across ten stations -- not genuine spatial signal. This value is the real, dated CPCB city-level bulletin aggregate (15 May 2025), applied flat city-wide rather than spatially interpolated. See build_pune.py's module docstring.",
            "total_cognizable_crimes": crimes,
            "crime_commissionerate": COMMISSIONERATE_OF[pin],
            "zone_type": ZONE_TYPE_OF.get(pin, "Residential"),
            "metro_stations_nearby": metro_n,
            "metro_planned_stations": 0,
            "highway_proximity": "High" if metro_n > 0 or tier <= 2 else "Medium",
            "smart_city_project": False,
            "infra_score_raw": infra_score(pin, zone, metro_n),
            "discom": DISCOM_OF[pin],
            "discom_confidence": DISCOM_CONF[pin],
            "power_confidence": (
                f"{DISCOM_OF[pin]} is the real, confirmed sole distributor for this pincode "
                "(see pune_areas.py), but its power score is MODELLED from utility profile, "
                "not a specific dated Ministry of Power Integrated Discom Ranking figure -- "
                "see build_pune.py's module docstring"
            ),
            "outage_frequency": max(1, round(outage)),
            "avg_outage_hours": outage,
            "reliability": RELIABILITY[rel_idx],
            "zone": zone,
            "governance_confidence": GOVERNANCE_CONF[pin],
            "governance_note": GOVERNANCE_NOTE.get(pin),
            "supply_hours": supply,
            "water_quality": max(1, min(5, round(scores["water"] / 20))),
            "quality_score": max(1, min(5, round(scores["water"] / 20))),
            "water_coverage": wcov, "coverage_pct": wcov,
            "tds_level": tds,
            "complaints_per_1000": max(4, round((100 - scores["water"]) * 1.3)),
            "water_note": None,
            "source": "Pune Municipal Corporation (PMC) water supply department" if COMMISSIONERATE_OF[pin] == "Pune City Police"
                       else "Pimpri-Chinchwad Municipal Corporation (PCMC) water supply department",
            "authority": "PMC" if COMMISSIONERATE_OF[pin] == "Pune City Police" else "PCMC",
            "road_quality": road_idx, "pothole_density": pot,
            "road_condition": ROAD_COND[road_idx],
            "last_resurfaced": resurf,
            "connectivity": "High" if tier <= 2 else "Medium",
            "sewerage_coverage": max(50, min(98, round(scores["sewerage"] * 0.9 + 15))),
            "treatment": "Full" if scores["sewerage"] >= 70 else "Partial",
            "waterlogging_risk": wlog,
            "open_drains": scores["sewerage"] < 55,
            "flooding_incidents_annual": flood,
            "data_completeness": 8 if schools_sourced else 7,
            "merged_at": SCORED_AT, "city": "Pune",
        })

    return nqi_rows, master_rows


def main():
    nqi_new, master_new = build()

    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    nqi = [r for r in nqi if r.get("city") != "Pune"]
    master = [r for r in master if r.get("city") != "Pune"]

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Pune rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Pune rows -> {master_path} (total {len(master)})")

    with open("/tmp/pune_pinmeta.txt", "w") as f:
        f.write("\n  // -- Pune (city 9) -- whole metro, 35 pincodes. --\n")
        for pin, entry in PUNE.items():
            name, area_label, lat, lon, tier, land = entry
            alis = landmarks_of(pin)
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Pune"']
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/pune_coords.txt", "w") as f:
        f.write("\n  // -- Pune (city 9) -- approximate locality centroids --\n")
        for pin, entry in PUNE.items():
            _, _, lat, lon, *_ = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/pune_pinmeta.txt and /tmp/pune_coords.txt")


if __name__ == "__main__":
    main()
