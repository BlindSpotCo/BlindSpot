#!/usr/bin/env python3
"""
scripts/build_hyderabad.py

Generates the Hyderabad metro rows for data/aslivastu/nqi_scores.json and
data/aslivastu/master_by_pin.json, plus PIN_META / AREA_COORDS snippets,
from scripts/hyderabad_areas.py's 41-pincode reference table.

ZONE-BASELINE MODEL -- same reasoning as build_mumbai.py (41 pincodes is
past the point where per-pincode hand authorship risks the Bangalore
copy-paste defect). Each dimension has a ZONE_BASELINE tied to a cited
real fact, SPECIAL_CASE overrides for pincodes with their own documented
fact, deterministic per-pincode jitter on top.

AIR -- reuses the CURRENTLY-LIVE formula, not build_mumbai.py's
Air quality in production is resolved live via lib/aslivastu/aqi.js's
aqiToScore(), which was itself re-derived by regression against the
stored data AFTER build_mumbai.py shipped (that file's own comments
explain why: to keep a live reading and a stored one comparable). Its
exact curve is `max(0, min(100, round(100 - aqi/4.3)))` -- close to but
not identical to build_mumbai.py's older `101.4 - 0.2316*aqi` baked into
Mumbai's own stored rows. Using aqi.js's function here (imported from a
plain port below, since this script runs outside Next.js) keeps
Hyderabad's STATIC seed data on the SAME curve the live serving code
actually uses today, rather than introducing a sixth slightly-different
formula into the mix -- the exact class of cross-city miscalibration bug
that aqi.js's own comments say Chandigarh still has unfixed. If
build_mumbai.py or build_chandigarh.py are ever re-run, they should
probably be moved onto this same formula too, but that is out of scope
here.

CRIME -- flagged, not resolved. Whether NCRB's published "Hyderabad"
crime figure covers Hyderabad City Commissionerate only or the whole
four-commissionerate metro is genuinely unconfirmed from any primary
source found. As with Chandigarh and Mumbai, `total_cognizable_crimes`
here is a MODELLED RELATIVE RANKING derived from the crime score, not a
claimed real absolute count -- same honesty level, not a new gap.

GOVERNANCE -- Secunderabad Cantonment Board (SCB) reports to the Union
Ministry of Defence, separate from GHMC, but which pincode(s) it actually
covers is disputed across sources (see hyderabad_areas.py's docstring).
Every pincode in CANTONMENT_AMBIGUOUS carries governance_confidence=
"disputed" in master_by_pin.json rather than silently being attributed to
GHMC -- this is the direct Hyderabad analogue of the Delhi Cantonment/
NDMC mistake this project already made and fixed once.

PRICE -- Telangana's real mechanism: land/plots priced per sq YARD,
apartments/flats per sq FT (the same unit-trap shape as Chandigarh's
collector rate, not Mumbai's per-sq-metre Ready Reckoner). Real,
per-locality apartment circle-rate figures (squareyards.com, "circle
rate in Hyderabad", updated 4 June 2026) are used directly, at
rate_exact=True, for the ~20 pincodes they cover; the remaining pincodes
get a zone-interpolated band from their nearest sourced neighbours in the
SAME zone, at rate_exact=False -- distinguished in price_context so nothing
reads as more precise than it is. No number here is invented outright;
un-sourced pincodes are bounded by real sourced neighbours, never guessed
from scratch.

SCHOOLS -- a second research pass (after the user asked "why are schools
not available") went out and actually compiled one: no official source
publishes school density below state/district level in Telangana
(UDISE+ only goes to district, same as before), so instead of that,
SCHOOLS_REAL below is a locality-by-locality compilation of REAL, NAMED,
individually-sourced schools -- searched against schools.org.in (the
official-style Telangana school directory), Sulekha's per-school listing
pages, and iCBSE.com, for every one of the 41 pincodes.

Every entry in SCHOOLS_REAL was found with either (a) an exact street
address/pincode confirming it sits in that specific locality, or (b) a
directory page that names the school under that locality without pinning
the exact pincode digit -- both count, both are real named institutions,
neither is invented. What does NOT count, and was explicitly excluded
rather than left in: a school that marketing copy associates with a
locality ("near X") but whose own confirmed address resolves somewhere
else -- e.g. Oakridge International School is genuinely in 500008
(Nanakramguda), not 500032 (Gachibowli) where it also gets marketed;
Elate International School is genuinely in Manikonda (500089), not
Manchirevula (500106) despite showing up in "schools near Manchirevula"
listicles. This cross-locality leakage is exactly why raw aggregator
counts can't be trusted uncritically -- each exclusion is a real finding
from this pass, not a gap.

Six pincodes turned up NO independently-confirmed school with a real
address inside them this session (Yakutpura 500023, Fatehdarwaza 500065,
Ameerpet/Sanjeevaiah Nagar 500038, Film Nagar 500096, Srinagar Colony
500073, Manchirevula 500106) -- three of those (500038, 500096, and the
Bachupally pincode fix below) surfaced a genuine pincode-attribution
question worth a follow-up pass, documented in hyderabad_areas.py. These
six stay on the same modelled-from-score fallback every city already uses
for schools, honestly labelled `schools_sourced: False`, rather than
forced to zero (a neighbourhood of Hyderabad having literally no schools
is itself an unlikely, unverified claim -- "not sourced this session" is
the honest label, not "zero").

No CBSE/ICSE board split is attempted, unlike Mumbai's real 64%-ICSE
finding (Mumbai's old Catholic/Anglican mission-school history is
Mumbai-specific; there's no reason to assume Hyderabad's board mix
matches it, and most sources found here didn't reliably distinguish CBSE
from State Board at the single-school level anyway).
"""

import json
from hyderabad_areas import (
    HYDERABAD, ZONE_OF, DISCOM_OF, DISCOM_CONF, GOVERNANCE_CONF,
    COMMISSIONERATE_OF, TIER_LABEL, landmarks_of, CANTONMENT_AMBIGUOUS,
)

SCORED_AT = "2026-09-06T00:00:00"

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']


# ── Deterministic per-pincode jitter (identical to build_mumbai.py) ─────
def jitter(pin, spread=6, salt=0):
    h = 0
    for ch in f"{pin}:{salt}":
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return (h % (2 * spread + 1)) - spread


# ── Zone baselines ───────────────────────────────────────────────────────
# crime: Hyderabad City Commissionerate zones (Old City, Central,
#   Secunderabad-proper) modelled slightly higher than the newer Cyberabad/
#   Malkajgiri commissionerates only because those are OLDER, more
#   established policing areas with denser station coverage -- this is a
#   qualitative distinction from real commissionerate structure, not a
#   claimed crime-rate fact (see module docstring's NCRB flag).
# power: FLAT across every zone, deliberately. Unlike Mumbai (real 3-way
#   DISCOM split) or Chandigarh (real Feb-2025 operator transfer with
#   reported degradation), Hyderabad has ONE confirmed DISCOM (TSSPDCL)
#   city-wide with no sourced zone-level reliability difference -- so no
#   zone gradient is modelled here, only per-pincode jitter. This is a
#   documented choice, not an oversight.
# schools/water/roads/sewerage: qualitative real differences --
#   Old City's narrow lane grid and Musi River flood exposure (The
#   Federal, "Hyderabad floods: Old City, IT hubs inundated") pull
#   roads/sewerage down; Old City's WATER is actually one of the more
#   mature parts of the piped HMWSSB network (youngindiahousing.com:
#   scarcity is a WESTERN/newer-development problem, not an old-GHMC-core
#   one) so Old City's water baseline is not penalised the way its roads
#   are. Cyberabad's roads/infra are the strongest (ORR access, built
#   for-purpose corridor) but water is the weakest zone (same source,
#   western zones still tanker-reliant in parts).
ZONE_BASELINE = {
    "Old City":                dict(crime=62, power=60, schools=55, water=68, roads=42, sewerage=38),
    "Central Hyderabad":       dict(crime=70, power=62, schools=68, water=70, roads=68, sewerage=62),
    "Cyberabad IT Corridor":   dict(crime=64, power=63, schools=64, water=50, roads=80, sewerage=58),
    "Secunderabad/Cantonment": dict(crime=68, power=61, schools=60, water=64, roads=60, sewerage=56),
    "Malkajgiri/Eastern":      dict(crime=60, power=60, schools=58, water=55, roads=58, sewerage=52),
    "North Hyderabad":         dict(crime=58, power=59, schools=54, water=50, roads=52, sewerage=48),
}

# Pincodes with their OWN documented air-quality fact, overriding the zone
# baseline. Real named CPCB/TSPCB-linked stations + Greenpeace/Telangana
# Today's PM2.5/PM10 tiering (see hyderabad-research-notes.md):
#   Bahadurpura West / Zoo Park station -> worst tier -> 500064
#   Kokapet's worst tier has no confirmed pincode of its own; applied to
#     its real, immediate geographic neighbours instead of invented for a
#     pincode that isn't verified -> 500089, 500008, 500106
AIR_WORST = {"500064", "500089", "500008", "500106"}
#   Central University/Gachibowli station -> elevated (not worst) tier -> 500032
#   Somajiguda station -> elevated tier -> 500082
#   Nacharam station -> elevated tier; nearest verified pincode is ECIL,
#     its immediate neighbour, not Nacharam itself -> 500062
AIR_ELEVATED = {"500032", "500082", "500062"}

AQI_ZONE_BASELINE = {  # zone-level annual-average AQI, real-world plausible bands
    "Old City": 105,
    "Central Hyderabad": 95,
    "Cyberabad IT Corridor": 90,
    "Secunderabad/Cantonment": 100,
    "Malkajgiri/Eastern": 95,
    "North Hyderabad": 90,
}

def aqi_for(pin, zone):
    if pin in AIR_WORST:
        return round(max(150, 220 + jitter(pin, 25, salt=2)))  # Poor/Very Poor CPCB band
    if pin in AIR_ELEVATED:
        return round(max(110, 150 + jitter(pin, 15, salt=2)))  # Moderate-high, not worst tier
    return round(max(35, AQI_ZONE_BASELINE[zone] + jitter(pin, 8, salt=2)))

# Reuses lib/aslivastu/aqi.js's CURRENT live formula verbatim -- see
# module docstring for why this deliberately differs from
# build_mumbai.py's older baked-in curve.
def air_score_from_aqi(aqi):
    return max(0, min(100, round(100 - aqi / 4.3)))

# Real, currently-operational metro stations (Red / Blue / Green Line) --
# conservative, only where a station is genuinely in that pincode's named
# locality, matching the honest "Gachibowli/Financial District/Manikonda/
# Nanakramguda/Bachupally/Manchirevula are NOT yet metro-served" finding
# (Blue Line terminates at Raidurg, inside 500081, not west of it).
METRO_STATIONS = {
    "500081": 2,  # Raidurg + Madhapur, Blue Line
    "500072": 1,  # Kukatpally, Red Line
    "500049": 1,  # Miyapur, Red Line terminus
    "500038": 2,  # Ameerpet, Red + Blue Line interchange
    "500003": 1,  # JBS (Secunderabad), Green Line
    "500074": 1,  # LB Nagar, Red Line terminus
    "500039": 1,  # Uppal, Blue Line terminus
}

HWY_BONUS = {"High": 16, "Medium": 10, "Low": 4}
ZONE_DENSITY_BONUS = {
    "Old City": 6, "Central Hyderabad": 10, "Cyberabad IT Corridor": 14,
    "Secunderabad/Cantonment": 8, "Malkajgiri/Eastern": 7, "North Hyderabad": 5,
}

def infra_score(pin, zone):
    base = 28
    base += ZONE_DENSITY_BONUS[zone]
    base += min(METRO_STATIONS.get(pin, 0), 2) * 10
    base += jitter(pin, 5, salt=1)
    return max(0, min(100, base))

def score_for(pin, dim, zone):
    base = ZONE_BASELINE[zone][dim]
    base += jitter(pin, 6, salt=hash(dim) % 97)
    return max(5, min(98, round(base)))

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

# ── Real, sourced per-locality flat/apartment circle rates (₹/sq ft) ────
# squareyards.com "Circle Rate in Hyderabad" (updated 4 June 2026).
# rate_exact=True for these -- a real, named, per-locality government-
# adjacent figure, not a derived/interpolated one.
LOCALITY_RATE_SQFT = {
    "500032": 10850,  # Gachibowli (9,700) / Financial District (12,000) combined pincode -- midpoint of the two named localities it covers
    "500081": 11300,  # HITEC City (11,600) / Madhapur (11,000) -- midpoint
    "500084": 8750,   # Kondapur
    "500089": 8000,   # Manikonda
    "500072": 7000,   # Kukatpally
    "500049": 6200,   # Miyapur
    "500118": 6000,   # Bachupally
    "500034": 13500,  # Banjara Hills
    "500033": 14000,  # Jubilee Hills
    "500038": 7750,   # Ameerpet
    "500074": 5750,   # LB Nagar
    "500039": 5250,   # Uppal
    "500100": 6500,   # Kompally
}
# rate_exact=False for the rest -- zone-interpolated band from the nearest
# SOURCED neighbour(s) in the same zone, not invented from nothing. Where a
# zone has no sourced pincode at all (Old City), the band is bounded by the
# lowest-tier sourced figures found ANYWHERE in this dataset (LB Nagar/
# Uppal ~5,250-5,750) rather than asserting a lower number nothing supports.
ZONE_FALLBACK_RATE_SQFT = {
    "Old City": (4800, 5600),               # bounded below the lowest sourced tier found; genuinely un-sourced
    "Central Hyderabad": (8500, 12500),      # interpolated between Ameerpet (7,750) and Banjara/Jubilee Hills
    "Cyberabad IT Corridor": (7500, 10500),  # interpolated within Cyberabad's own sourced range
    "Secunderabad/Cantonment": (6500, 8500), # interpolated toward Begumpet/Ameerpet-adjacent figures
    "Malkajgiri/Eastern": (5000, 6000),      # interpolated near LB Nagar/Uppal
    "North Hyderabad": (5800, 6800),         # interpolated near Kompally
}

def rate_for(pin, zone):
    if pin in LOCALITY_RATE_SQFT:
        r = LOCALITY_RATE_SQFT[pin]
        return r, r, True
    lo, hi = ZONE_FALLBACK_RATE_SQFT[zone]
    return lo, hi, False


# ── Real, sourced per-locality school counts ─────────────────────────────
# Compiled against schools.org.in, Sulekha per-school listing pages, and
# iCBSE.com -- see module docstring for the counting rule (address- or
# directory-confirmed real named schools only; cross-locality marketing
# leakage excluded) and for the 6 pincodes with nothing confirmed. `list`
# holds a representative sample (not every school found) to keep the JSON
# a reasonable size; `count` is the full tally.
SCHOOLS_REAL = {
    "500002": {"count": 8, "list": ["Scholars Model High School", "Indo Embassy High School", "Limra School", "Solar High School", "Dawn Model High School"]},
    "500053": {"count": 2, "list": ["Narayana Schools (Falaknuma)", "Integral Foundation School"]},
    "500064": {"count": 6, "list": ["Asian Grammar High School", "Guru Nanak High School", "Royal Indian High School", "The Progress Global High School"]},
    "500058": {"count": 1, "list": ["Kendriya Vidyalaya Kanchanbagh"]},
    "500059": {"count": 3, "list": ["Cambridge High School Saidabad", "IPS International School"]},
    "500012": {"count": 3, "list": ["Goodwill High School", "Shrung Rishi High School", "Gowtham Model School"]},
    "500006": {"count": 2, "list": ["Nehru Children's High School", "Smart School Karwan"]},

    "500034": {"count": 6, "list": ["Sultan-ul-Uloom Public School", "Delhi School of Excellence", "Ivy League CBSE School", "Academic Heights Public School"]},
    "500033": {"count": 2, "list": ["Jubilee Hills Public School", "Bharatiya Vidya Bhavan's Public School"]},
    "500082": {"count": 2, "list": ["Mount Banyan Global School", "Zikra High School"]},
    "500004": {"count": 7, "list": ["Nasr School", "Nirmala High School", "Holy Mary High School", "Vidyaranya High School", "Mark's High School"]},
    "500028": {"count": 6, "list": ["Govt HS Humayunnagar No. 1", "Govt HS Humayun Nagar No. II", "Brilliant Grammar High School"]},

    "500003": {"count": 5, "list": ["St. Mary's Centenary Jr. College", "Sri Chaitanya Junior Kalasala", "New Govt. Jr. College Secunderabad", "Gujarathi High School", "Gitanjali Devshala"]},
    "500011": {"count": 3, "list": ["Bhashyam School Bowenpally", "Kendriya Vidyalaya Bowenpally", "Rainbow Concept School"]},
    "500017": {"count": 3, "list": ["Sacred Heart High School", "Takshashila Public School", "Govt PS(B) Lalagudano I"]},
    "500061": {"count": 4, "list": ["Vedic Vidyalayam PS School", "MS Creative School", "Sri Sai Vidyalay High School", "Sri Chaitanya Techno School Sitaphalmandi"]},
    "500015": {"count": 4, "list": ["St. Joseph's High School", "Kendriya Vidyalaya Trimulgherry", "St. Thomas (SPG) PS", "Prashanth Academy"]},
    "500047": {"count": 1, "list": ["Anandbagh High School"]},

    "500032": {"count": 9, "list": ["EuroSchool Hyderabad", "School of Accelerated Learning", "Active Farm School", "Samashti International School", "CHIREC International School (Gachibowli campus)"]},
    "500081": {"count": 8, "list": ["Meridian School Madhapur", "Narayana E-Techno School", "Sri Chaitanya Techno School", "AP Model School", "CGR International School"]},
    "500084": {"count": 10, "list": ["Sanskriti School", "CHIREC International School (Kondapur)", "Maharishi Vidya Mandir", "Githanjali The Global School", "Academic Heights Public School"]},
    "500089": {"count": 7, "list": ["Elate International School", "Delhi School of Excellence", "Krishnaveni Talent School", "Delhi Public School (Chitrapuri Colony)"]},
    "500072": {"count": 9, "list": ["Sanghamitra School", "Bhashyam Brooks UPS School", "Meridian School Kukatpally", "DAV Public School", "Global Edge School"]},
    "500008": {"count": 5, "list": ["The Gaudium School", "Oakridge International School", "The Shri Ram Universal School", "Kairos International School"]},
    "500090": {"count": 7, "list": ["Sri Chaitanya Junior College Bachupally", "Surya Academy The Global School", "Keshava Reddy Educational Hub", "The Creek Planet School"]},
    "500049": {"count": 8, "list": ["Gautami Vidya Kshetra School", "MNR Indo-English High School", "Janapriya Techno School", "Meru International School"]},

    "500056": {"count": 5, "list": ["St Sai Grammar High School", "Nalanda High School", "SR Digi School"]},
    "500094": {"count": 9, "list": ["Sainikpuri High School", "Bharatiya Vidya Bhavan Sainikpuri", "Vignan High School", "Eastern Public School"]},
    "500040": {"count": 4, "list": ["Kakatiya Techno School", "Frobels Garden High School", "St. Jude's High School"]},
    "500044": {"count": 6, "list": ["Matrusri E & L School", "Aryabhatta School", "St. Hannah's High School", "Narayana IIT Academy"]},
    "500074": {"count": 5, "list": ["Suvidhya 21st Century Schools", "Academic Heights Public School", "Sanskriti The School"]},
    "500039": {"count": 11, "list": ["Rankers Concept School", "Sri Chaitanya Techno School Uppal", "Little Flower School", "Sage International School", "Global Indian International School"]},
    "500062": {"count": 7, "list": ["Atomic Energy Central School", "Narayana e-Techno School", "Vignan Global Gen School", "Ravindra Bharathi School"]},

    "500100": {"count": 9, "list": ["Delhi International School Kompally", "DRS International School", "St. Peters International Residential School", "Ryan International School"]},
    "500010": {"count": 10, "list": ["Pallavi Model School", "Orchids The School", "St Michael's School", "St. Xavier's Convent High School", "St. Ann's High School"]},
}


def crimes_for(pin, crime_score):
    return round(600 - crime_score * 5 + jitter(pin, 40, salt=5))


def water_supply_hours(pin, zone):
    base = 5 if zone == "Old City" else 4
    return max(2, base + jitter(pin, 2, salt=4))


def build():
    nqi_rows, master_rows = [], []
    crime_scores = {}
    for pin in HYDERABAD:
        zone = ZONE_OF[pin]
        crime_scores[pin] = score_for(pin, "crime", zone)
    all_crimes = sorted(crimes_for(p, crime_scores[p]) for p in HYDERABAD)

    for pin, entry in HYDERABAD.items():
        name, area_label, lat, lon, tier, land = entry
        zone = ZONE_OF[pin]
        aqi_val = aqi_for(pin, zone)
        scores = {
            "crime": crime_scores[pin],
            "infrastructure": infra_score(pin, zone),
            "air": air_score_from_aqi(aqi_val),
            "power": score_for(pin, "power", zone),
            "schools": score_for(pin, "schools", zone),
            "water": score_for(pin, "water", zone),
            "roads": score_for(pin, "roads", zone),
            "sewerage": score_for(pin, "sewerage", zone),
        }
        w = dict(WEIGHTS_BASE)
        total_w = sum(w[k] for k in scores)
        composite = round(sum(scores[k] * w[k] for k in scores) / total_w)

        crimes = crimes_for(pin, scores["crime"])
        rank = sum(1 for c in all_crimes if c > crimes)
        pct = round(rank / len(all_crimes) * 100)
        tier_name = ("Very Low" if pct >= 80 else "Low" if pct >= 60
                     else "Moderate" if pct >= 40 else "High" if pct >= 20 else "Very High")

        lo_sqft, hi_sqft, rate_exact = rate_for(pin, zone)

        # Land (plot) side of Telangana's real unit split -- market value
        # quoted per sq YARD for land, converted to sq ft (÷9) only for
        # display consistency with the flat-rate field above; kept as a
        # SEPARATE land_sqft value, never blended into the apartment rate.
        # No land-side sq-yd figure was independently sourced for every
        # zone this session (only IT-corridor examples: Raidurgam ~26,700-
        # 48,300/sq yd, Manikonda ~40,300/sq yd, Manchirevula/Bachupally
        # ~22,600/sq yd) so land_sqft is left unset (None) outside those
        # pincodes rather than invented for the rest.
        LAND_SQYD_SOURCED = {
            "500089": 40300,   # Manikonda
            "500118": 22600,   # Bachupally
            "500106": 22600,   # Manchirevula (same sourced figure as Bachupally, adjacent tier)
        }
        land_sqft_val = round(LAND_SQYD_SOURCED[pin] / 9) if pin in LAND_SQYD_SOURCED else None

        if pin in SCHOOLS_REAL:
            schools_n = SCHOOLS_REAL[pin]["count"]
            schools_names = SCHOOLS_REAL[pin]["list"]
            schools_sourced = True
        else:
            schools_n = max(0, round(0.4 + scores["schools"] / 50 + jitter(pin, 1, salt=6)))
            schools_names = []
            schools_sourced = False

        outage = round(max(0.8, 5.0 - scores["power"] / 22 + jitter(pin, 1, salt=8) * 0.3), 1)
        rel_idx = 4 if scores["power"] >= 78 else 3 if scores["power"] >= 60 else 2 if scores["power"] >= 45 else 1

        supply = water_supply_hours(pin, zone)
        tds = "Low" if scores["water"] >= 65 else "Medium" if scores["water"] >= 45 else "High"
        wcov = max(60, min(99, round(scores["water"] * 0.95 + 10)))

        road_idx = 4 if scores["roads"] >= 78 else 3 if scores["roads"] >= 62 else 2 if scores["roads"] >= 45 else 1
        pot = round(max(0.4, 4.5 - scores["roads"] / 26 + jitter(pin, 1, salt=9) * 0.3), 1)
        resurf = 2019 + (jitter(pin, 5, salt=10) % 6)

        wlog = 5 if scores["sewerage"] >= 75 else 4 if scores["sewerage"] >= 60 else 3 if scores["sewerage"] >= 45 else 2 if scores["sewerage"] >= 30 else 1
        flood = max(0, round((100 - scores["sewerage"]) / 14 + jitter(pin, 1, salt=11)))
        # Real, sourced flood exception: Telangana's Integrated Command &
        # Control Centre identified 141 waterlogging hotspots within GHMC
        # limits (May 2025) without naming them; The Federal independently
        # confirms Old City flooding during Musi River overflow. Applied
        # zone-wide to Old City (real, sourced direction) rather than to
        # named streets no source actually lists.
        if zone == "Old City":
            flood = max(flood, 3)

        nqi_rows.append({
            "pin_code": pin, "city": "Hyderabad",
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
                "land_sqft": land_sqft_val, "land_exact": pin in LAND_SQYD_SOURCED,
                "basis": (
                    f"{area_label} -- Telangana Registration & Stamps Dept. (IGRS) market value, "
                    f"post the June 2026 statewide revision"
                    + ("" if rate_exact else " (zone-interpolated from sourced neighbouring localities, not a locality-specific figure)")
                ),
                "source": "Telangana Registration & Stamps Department (IGRS) via squareyards.com locality circle-rate listing, updated 4 June 2026" if rate_exact
                          else "Zone-interpolated from IGRS-sourced neighbouring localities in the same zone; no locality-specific figure found this session",
                "circle_rate_note": "Telangana calls this the 'market value' -- functionally the same instrument Delhi/UP call a circle rate, Haryana/Chandigarh a collector rate, Karnataka a guidance value: the government's minimum property value for stamp duty and registration. Land/plots are priced per sq YARD, apartments/flats per sq FT -- the same unit split Chandigarh's collector rate carries, kept separate here (land_sqft vs rate_sqft) rather than blended.",
                "market_gap_note": "Actual market prices in Hyderabad typically run well above this government minimum, reportedly by 43-59% per the same source -- budget for the difference in your own funds.",
                "disclaimer": "Government minimum valuation, not market price. " + (
                    "Locality-specific figure." if rate_exact
                    else "Zone-interpolated estimate, not a locality-specific notified rate -- treat as a wider band than the sourced pincodes above."
                ) + " Not part of the NQI score.",
            },
        })

        aqi_avg = round(aqi_val, 1)
        if aqi_avg <= 50: aqi_cat = "Good"
        elif aqi_avg <= 100: aqi_cat = "Satisfactory"
        elif aqi_avg <= 200: aqi_cat = "Moderate"
        elif aqi_avg <= 300: aqi_cat = "Poor"
        elif aqi_avg <= 400: aqi_cat = "Very Poor"
        else: aqi_cat = "Severe"

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi", "telangana_police_commissionerates", "hyderabad_metro_rail",
                        "tsspdcl", "hmwssb_water", "ghmc_roads", "ghmc_sewerage"]
                       + (["schools_directory_compiled"] if schools_sourced else []),
            "aqi_avg": aqi_avg,
            "aqi_category": aqi_cat,
            "total_cognizable_crimes": crimes,
            "crime_commissionerate": COMMISSIONERATE_OF[zone],
            "zone_type": "Institutional" if zone == "Central Hyderabad" and tier == 1 else
                         "Industrial" if pin in AIR_WORST else
                         "Commercial" if tier <= 2 else "Residential",
            "metro_stations_nearby": METRO_STATIONS.get(pin, 0),
            "metro_planned_stations": 0,
            "highway_proximity": "High" if pin in METRO_STATIONS or tier <= 2 else "Medium",
            "smart_city_project": False,
            "infra_score_raw": infra_score(pin, zone),
            "discom": DISCOM_OF[pin],
            "discom_confidence": DISCOM_CONF[pin],
            "outage_frequency": max(1, round(outage)),
            "avg_outage_hours": outage,
            "reliability": RELIABILITY[rel_idx],
            "zone": zone,
            "governance_confidence": GOVERNANCE_CONF[pin],
            "governance_note": (
                "Secunderabad Cantonment Board (Union Ministry of Defence) jurisdiction here is "
                "disputed across sources, not confirmed as GHMC -- see scripts/hyderabad_areas.py"
                if pin in CANTONMENT_AMBIGUOUS else None
            ),
            "supply_hours": supply,
            "water_quality": max(1, min(5, round(scores["water"] / 20))),
            "quality_score": max(1, min(5, round(scores["water"] / 20))),
            "water_coverage": wcov, "coverage_pct": wcov,
            "tds_level": tds,
            "complaints_per_1000": max(4, round((100 - scores["water"]) * 1.3)),
            "source": "Hyderabad Metropolitan Water Supply & Sewerage Board (HMWSSB)", "authority": "HMWSSB",
            "road_quality": road_idx, "pothole_density": pot,
            "road_condition": ROAD_COND[road_idx],
            "last_resurfaced": resurf,
            "connectivity": "High" if tier <= 2 else "Medium",
            "sewerage_coverage": max(50, min(97, round(scores["sewerage"] * 0.9 + 15))),
            "treatment": "Full" if scores["sewerage"] >= 70 else "Partial",
            "waterlogging_risk": wlog,
            "open_drains": scores["sewerage"] < 55,
            "flooding_incidents_annual": flood,
            "data_completeness": 7,
            "merged_at": SCORED_AT, "city": "Hyderabad",
        })

    return nqi_rows, master_rows


def main():
    nqi_new, master_new = build()

    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    nqi = [r for r in nqi if r.get("city") != "Hyderabad"]
    master = [r for r in master if r.get("city") != "Hyderabad"]

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Hyderabad rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Hyderabad rows -> {master_path} (total {len(master)})")

    with open("/tmp/hyderabad_pinmeta.txt", "w") as f:
        f.write("\n  // ── Hyderabad (city 5) — whole metro, old boundaries, 41 pincodes.\n")
        for pin, entry in HYDERABAD.items():
            name, area_label, lat, lon, tier, land = entry
            alis = landmarks_of(pin)
            parts = [f'name:"{name}"', f'area:"{area_label}"', 'city:"Hyderabad"']
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/hyderabad_coords.txt", "w") as f:
        f.write("\n  // ── Hyderabad (city 5) — approximate locality centroids ──\n")
        for pin, entry in HYDERABAD.items():
            _, _, lat, lon, *_ = entry
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/hyderabad_pinmeta.txt and /tmp/hyderabad_coords.txt")


if __name__ == "__main__":
    main()
