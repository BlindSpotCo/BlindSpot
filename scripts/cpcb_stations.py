#!/usr/bin/env python3
"""
scripts/cpcb_stations.py

Shared real-CPCB-station AQI interpolation for every BlindSpot city,
replacing the deterministic-hash "jitter" that previously stood in for
per-pincode air-quality variation: Mumbai's AQI_ZONE_BASELINE + jitter(),
Hyderabad's identical pattern, Chandigarh's hand-typed per-sector aqi=NN
values (no real source behind the spread -- they tracked each sector's
crime figure, not its air), and Delhi/Bangalore's equally fabricated
pre-existing zone-bucketed numbers (Bangalore's stored aqi_avg had only
14 distinct values across 66 pincodes, clustered at 58 and 62 -- a
giveaway of zone-baseline-plus-jitter, not real per-pincode data).

METHOD
Each city below carries a short list of REAL, named, currently-operating
government air-quality monitoring stations (CPCB / state-board CAAQMS --
or, for Chandigarh, the only 3 continuous stations that exist at all),
each with a real reported AQI reading. CPCB does not publish a clean
per-station ANNUAL average anywhere accessible in this pass's research --
its public bulletins are single-day snapshots and its annual reports
aggregate to city level. Where more than one dated reading was found for
a station, the figure used here is the plain mean of every dated reading
found (dates listed inline) -- disclosed as that, not presented as an
annual average it isn't. Sources are CPCB's own NCR bulletins
(cpcb.nic.in), KSPCB's monthly CAAQM bulletins (Bengaluru), and dated
news coverage that itself cites CPCB/state-board station readings
(Business Standard, Deccan Chronicle, The Tribune, Hyderabad Mail,
Question of Cities) -- see the per-station comment for which.

A pincode's AQI is then the inverse-distance-weighted mean of its k
nearest real stations (idw_aqi() below) -- closer real stations count
for more, using each pincode's own centroid coordinate already used
elsewhere in this codebase (lib/aslivastu/areaCoords.js; mumbai_areas.py
/ hyderabad_areas.py / chandigarh_sectors.py carry the same coordinates
for their own cities). This is the "honest distance-weighted
interpolation" this pass replaces jitter with: the per-pincode variation
is real geographic proximity to real readings, not a hash.

This is intentionally the offline counterpart of lib/aslivastu/aqi.js's
own live /api/aqi path, which resolves a reading from a MODELLED grid
(Google Air Quality) specifically because a station-distance approach
leaves coverage gaps far from any station (that file's own comment: 27
of 268 pins had no reading at all under an earlier Delhi-only station
mapping, systematically flattering the worst-served areas). Station
interpolation is still the right call for this STATIC snapshot pipeline
-- there is no live-grid API budget for build-time regeneration of 5
cities' worth of historical rows -- but it inherits that same
coverage-gap risk in areas far from every station. Chandigarh is the
sharpest case: its own pollution-control committee has publicly
confirmed the network is capped at 3 stations with no plan to expand
(The Tribune, "CPCC shelves plans on more air monitoring units"), so
interpolation there is necessarily coarse and is disclosed as such in
that city's own station list below, rather than presented with the same
confidence as Delhi's 47-station network.

SCORE CURVE
Uses the exact same AQI -> score curve as lib/aslivastu/aqi.js's
aqiToScore() (score = round(100 - aqi/4.3)) and the same AQI_BANDS
category cutoffs, for every city. Previously Chandigarh's hand-typed
rows were scored on a visibly different, roughly-twice-as-punishing
curve (~110 - 0.43*aqi) -- aqi.js's own comment already flagged this as
"a real cross-city comparability bug... flagged for a separate
rescoring pass." This pass is that rescoring pass: every city now
produces the same score for the same AQI, and a live /api/aqi reading
will match a stored one for the same input.
"""
import math

AQI_PER_POINT = 4.3  # matches lib/aslivastu/aqi.js's AQI_PER_POINT exactly


def aqi_to_score(aqi):
    v = max(0.0, min(500.0, float(aqi)))
    return max(0, min(100, round(100 - v / AQI_PER_POINT)))


def aqi_category(aqi):
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Satisfactory"
    if aqi <= 200: return "Moderate"
    if aqi <= 300: return "Poor"
    if aqi <= 400: return "Very Poor"
    return "Severe"


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def idw_aqi(lat, lon, stations, k=3, power=2.0, min_km=0.3):
    """stations: iterable of (name, lat, lon, aqi, note).
    Returns (interpolated_aqi, nearest_station_name, nearest_km) so
    callers can log/inspect which real station is doing the driving."""
    k = min(k, len(stations))
    ranked = sorted(
        ((_haversine_km(lat, lon, s[1], s[2]), s[0], s[3]) for s in stations),
        key=lambda t: t[0],
    )[:k]
    weights = [1.0 / (max(d, min_km) ** power) for d, _, _ in ranked]
    total_w = sum(weights)
    aqi = sum(w * a for w, (_, _, a) in zip(weights, ranked)) / total_w
    return aqi, ranked[0][1], ranked[0][0]


# ── MUMBAI (18 real stations) ───────────────────────────────────────────
# Primary source: Business Standard's Dec 14, 2025 same-morning sweep
# (https://www.business-standard.com/india-news/mumbai-s-bandra-covered-
# in-haze-as-aqi-hits-moderate-level-of-154-125121400117_1.html) -- the
# most complete single-day, multi-station snapshot found. Where a station
# wasn't in that sweep, filled from an Apr 12 2024 aggregator snapshot
# (aqi.in) or a Nov 2024 Question of Cities piece citing MPCB station
# data (questionofcities.org/city-averages-not-good-enough-to-measure-
# air-pollution). Two stations (Chembur, Deonar) had readings from two
# dates -- averaged, noted inline.
MUMBAI_STATIONS = [
    ("Colaba (MPCB)",                    18.9100, 72.8200, 56,  "Apr'24"),
    ("Worli (MPCB)",                     18.9936, 72.8128, 106, "Dec'25"),
    ("Mazgaon (SAFAR)",                  18.9670, 72.8421, 91,  "Dec'25"),
    ("Byculla (BMC)",                    18.9767, 72.8380, 132, "undated BMC statement, range 125-140"),
    ("Bandra Reclamation (MPCB)",        19.0627, 72.8461, 154, "Dec'25"),
    ("Bandra Kurla Complex (SAFAR)",     19.0535, 72.8464, 157, "Dec'25"),
    ("Vile Parle West (MPCB)",           19.1086, 72.8362, 69,  "Apr'24"),
    ("Chakala-Andheri East (SAFAR)",     19.1107, 72.8608, 114, "Dec'25"),
    ("CSMIA Airport T2 (MPCB)",          19.1008, 72.8746, 88,  "Apr'24"),
    ("Malad West (SAFAR)",               19.1971, 72.8220, 51,  "Dec'25"),
    ("Kandivali East (MPCB)",            19.2058, 72.8682, 92,  "Nov'24"),
    ("Borivali East (MPCB)",             19.2243, 72.8658, 85,  "Apr'24"),
    ("Powai (MPCB)",                     19.1375, 72.9151, 93,  "Apr'24"),
    ("Sion (MPCB)",                      19.0470, 72.8746, 86,  "Apr'24"),
    ("Kurla (MPCB)",                     19.0863, 72.8888, 126, "Dec'25"),
    ("Ghatkopar (BMC)",                  19.0837, 72.9210, 161, "Dec'25"),
    ("Khindipada-Bhandup West (SAFAR)",  19.1653, 72.9221, 63,  "Apr'24"),
    ("Chembur RCF Colony (MPCB)",        19.0365, 72.8954, 175, "avg of Dec'25 (182) & Nov'24 (167)"),
    ("Deonar (SAFAR)",                   19.0495, 72.9230, 101, "avg of Apr'24 (82) & Nov'24 (119)"),
]

# ── DELHI NCR (47 real stations: Delhi + Gurugram + Noida/Gr.Noida +
#    Ghaziabad + Faridabad) ──────────────────────────────────────────────
# NOT YET APPLIED to Delhi's stored data (see scripts/patch_delhi_aqi.py's
# docstring) -- this list averages to a mean AQI of ~333, skewed by
# pollution-season dates, well above Delhi's commonly-cited annual
# average. Kept here as real, sourced research for a follow-up pass that
# re-anchors it against real annual-average figures.
# Primary source: a same-morning, ~24-station Delhi sweep at Nov 12 2025
# 8am (republicworld.com, citing CPCB data), during a severe winter
# pollution episode. Because that single morning would otherwise skew
# every Delhi station toward the "Severe" band -- not representative of
# typical conditions -- every station below is the MEAN of all dated
# real readings found for it (CPCB's own NCR bulletin PDFs for Jan 1
# 2025, Feb 20 2025, Feb 23 2025 and Dec 26 2022, plus theprint.in Nov 17
# 2025 and india.com Oct 21 2025 where available), spanning both a
# pollution episode and calmer months -- disclosed as a mean-of-real-
# snapshots, not a formal annual average CPCB doesn't publish.
DELHI_STATIONS = [
    ("Wazirpur (DPCC)",                 28.6998, 77.1655, 459, "1 reading, Nov'25"),
    ("Alipur (DPCC)",                   28.8153, 77.1530, 431, "1 reading, Nov'25"),
    ("Ashok Vihar (DPCC)",               28.6954, 77.1817, 439, "1 reading, Nov'25"),
    ("Bawana (DPCC)",                   28.7762, 77.0511, 439, "avg of Nov'25 (451) & Nov'25 (427)"),
    ("Burari Crossing (IMD)",            28.7257, 77.2012, 326, "avg of Nov'25 (439) & Feb'25 (212)"),
    ("Jahangirpuri (DPCC)",              28.7328, 77.1706, 323, "avg of Nov'25 (446) & Feb'25 (~199)"),
    ("Narela (DPCC)",                   28.8228, 77.1020, 324, "avg of Nov'25 (437) & Feb'25 (210)"),
    ("Rohini (DPCC)",                    28.7325, 77.1199, 442, "1 reading, Nov'25"),
    ("DTU Shahbad Daulatpur (CPCB)",     28.7500, 77.1113, 373, "1 reading, Nov'25"),
    ("ITO (CPCB)",                       28.6286, 77.2411, 390, "avg of Nov'25 (433) & Oct'25 (347)"),
    ("Chandni Chowk (SAFAR)",            28.6568, 77.2272, 416, "avg of Nov'25 (449) & Nov'25 (383)"),
    ("Lodhi Road (IMD)",                 28.5918, 77.2273, 312, "avg of Nov'25 (309) & Oct'25 (315)"),
    ("JLN Stadium (DPCC)",               28.5803, 77.2338, 422, "1 reading, Nov'25"),
    ("Mandir Marg (DPCC)",               28.6364, 77.2011, 328, "1 reading, Oct'25"),
    ("Pusa (IMD)",                       28.6361, 77.1733, 358, "avg of Oct'25 (351) & Nov'25 (365)"),
    ("R K Puram (DPCC)",                 28.5633, 77.1869, 399, "avg of Nov'25 (432) & Nov'25 (366)"),
    ("Sirifort (CPCB)",                  28.5504, 77.2159, 393, "avg of Nov'25 (403) & Jan'25 (382)"),
    ("Aya Nagar (IMD)",                  28.4707, 77.1099, 405, "1 reading, Nov'25"),
    ("CRRI Mathura Road (IMD)",          28.5512, 77.2736, 428, "1 reading, Nov'25"),
    ("Karni Singh Shooting Range (DPCC)",28.4986, 77.2648, 429, "1 reading, Nov'25"),
    ("Okhla Phase-2 (DPCC)",             28.5308, 77.2713, 348, "avg of Nov'25 (418) & Jan-Feb'25 range (~278)"),
    ("Nehru Nagar (DPCC)",               28.5679, 77.2505, 422, "avg of Nov'25 (440) & Jan'25 (404)"),
    ("IGI Airport T3 (IMD)",             28.5628, 77.1180, 395, "1 reading, Nov'25"),
    ("Anand Vihar (DPCC)",               28.6476, 77.3158, 388, "avg of Nov'25/Jan'25/Oct'25 (438,384,341)"),
    ("Patparganj (DPCC)",                28.6238, 77.2872, 408, "avg of Nov'25 (436) & Jan'25 (380)"),
    ("Sonia Vihar (DPCC)",               28.7105, 77.2495, 434, "1 reading, Nov'25"),
    ("IHBAS Dilshad Garden (CPCB)",      28.6812, 77.3025, 307, "1 reading, Nov'25"),
    ("Punjabi Bagh (DPCC)",              28.6740, 77.1310, 411, "avg of Nov'25 (437) & Nov'25 (384)"),
    ("Shadipur (CPCB)",                  28.6515, 77.1473, 392, "1 reading, Nov'25"),
    ("Dwarka Sector-8 (DPCC)",           28.5710, 77.0719, 389, "avg of Nov'25 (422) & Nov'25 (356)"),
    ("NSIT Dwarka (CPCB)",               28.6091, 77.0325, 267, "avg of Nov'25/Nov'25/Dec'22 (215,225,362)"),
    ("Najafgarh (DPCC)",                 28.5702, 76.9338, 384, "1 reading, Nov'25"),
    ("Mundka (DPCC)",                    28.6847, 77.0766, 337, "avg of Nov'25/Feb'25/Oct'25 (442,218,350)"),
    # Gurugram
    ("Sector-51, Gurugram (HSPCB)",      28.4227, 77.0667, 208, "avg of Feb'25 (131) & Dec'22 (285)"),
    ("Vikas Sadan, Gurugram (HSPCB)",    28.4501, 77.0263, 282, "1 reading, Dec'22"),
    ("Teri Gram, Gurugram (HSPCB)",      28.4275, 77.1465, 175, "1 reading, Feb'25"),
    ("Gwal Pahari, Gurugram (IMD)",      28.4483, 77.0210, 272, "1 reading, Jan'25; locality coord, not exact station"),
    # Noida / Greater Noida
    ("Sector-1, Noida (UPPCB)",          28.5898, 77.3101, 100, "1 reading, Feb'25"),
    ("Sector-62, Noida (IMD)",           28.6245, 77.3577, 232, "avg of Jan/Feb/Feb/Dec'22 (330,148,102,348)"),
    ("Sector-116, Noida (UPPCB)",        28.5692, 77.3938, 242, "avg of Feb'25 (133) & Dec'22 (351)"),
    ("Knowledge Park-III, Gr. Noida (UPPCB)", 28.4727, 77.4820, 370, "1 reading, Dec'22"),
    ("Knowledge Park-V, Gr. Noida (UPPCB)",   28.5571, 77.4537, 186, "avg of Jan/Feb/Feb'25 (307,157,94)"),
    # Ghaziabad
    ("Vasundhara, Ghaziabad (UPPCB)",   28.6603, 77.3573, 226, "avg of Jan/Feb/Feb/Dec'22 (238,191,131,342)"),
    ("Indirapuram, Ghaziabad (UPPCB)",  28.6462, 77.3581, 309, "1 reading, Jan'25"),
    ("Loni, Ghaziabad (UPPCB)",          28.7573, 77.2788, 127, "avg of Feb'25 (147) & Feb'25 (106)"),
    # Faridabad
    ("Sector-16A, Faridabad (HSPCB)",   28.4088, 77.3099, 360, "1 reading, Dec'22"),
    ("New Industrial Town, Faridabad (HSPCB)", 28.3907, 77.3006, 150, "1 reading, Feb'25"),
    ("Sector 30, Faridabad (HSPCB)",     28.4417, 77.3217, 114, "1 reading, Feb'25"),
    ("Sector 11, Faridabad (HSPCB)",     28.3761, 77.3157, 259, "1 reading, Jan'25"),
]

# ── BANGALORE (9 real stations) ─────────────────────────────────────────
# Source: KSPCB's own monthly CAAQM bulletin for January 2026 (the most
# recent available), hosted on Bengaluru's open-data portal
# (data.opencity.in) -- gives each station's min-max AQI for the month;
# the figure used here is that range's midpoint. Cross-checked against
# Greenpeace India's "Beyond North India" report (Dec 2024), which
# confirms Bengaluru runs 13 government CAAQM stations total; the other
# 4 (Hombegowda Nagar, Bapuji Nagar, BTM Layout, Shivapura) report only
# annual NO2, not a composite AQI, so are left out of interpolation
# rather than converted from one pollutant's sub-index alone (composite
# AQI is the MAX across pollutant sub-indices, and NO2 alone would
# understate it).
BANGALORE_STATIONS = [
    ("City Railway Station / Majestic (KSPCB)",      12.9757, 77.5661, 94,  "Jan'26, range 88-99"),
    ("Nisarga Bhavan, Saneguruvanahalli (KSPCB)",     12.9903, 77.5431, 60,  "Jan'26, range 51-69"),
    ("Hebbal, Veterinary College (KSPCB)",            13.0292, 77.5859, 99,  "Jan'26, range 38-160"),
    ("Jayanagar 5th Block (KSPCB)",                   12.9210, 77.5849, 94,  "Jan'26, range 42-145"),
    ("Silk Board / HSR Layout (KSPCB)",               12.9173, 77.6228, 94,  "Jan'26, range 48-140"),
    ("RVCE Mailasandra, Kengeri (KSPCB)",              12.9214, 77.5025, 101, "Jan'26, range 69-132"),
    ("Jigani Industrial Area, Anekal (KSPCB)",         12.7816, 77.6299, 85,  "Jan'26, range 57-112"),
    ("Kasturi Nagar RTO (KSPCB)",                      13.0039, 77.6642, 81,  "Jan'26, range 66-95"),
    ("Peenya Industrial Area / NTTF (CPCB)",           13.0270, 77.4941, 89,  "Jan'26, range 51-127"),
]

# ── HYDERABAD (13 real stations) ────────────────────────────────────────
# Primary source: Deccan Chronicle's Dec 24, 2025 sweep (same source that
# named Kompally "worst air pollution in Hyderabad" that day); backfilled
# from Hyderabad Mail's Nov 25, 2024 station-level reporting where Dec'25
# was missing. Ramachandrapuram had only a winter-average PM2.5 figure
# (24.9 ug/m3, CSE/Down To Earth's Oct'24-Jan'25 study) -- converted to
# an AQI-equivalent via CPCB's own PM2.5 sub-index breakpoints (linear
# within the 0-30ug/m3 band -> 0-50 AQI band), disclosed as a PM2.5-
# derived approximation, not a directly reported AQI.
HYDERABAD_STATIONS = [
    ("Sanathnagar (TSPCB)",              17.4559, 78.4332, 254, "1 reading, Nov'24"),
    ("New Malakpet (TSPCB)",             17.3721, 78.5086, 89,  "1 reading, Dec'25"),
    ("Zoo Park / Bahadurpura (TSPCB)",   17.3497, 78.4514, 146, "avg of Dec'25 (130) & Nov'24 (162)"),
    ("Somajiguda (TSPCB)",               17.4171, 78.4574, 187, "1 reading, Dec'25"),
    ("Central University, Gachibowli (TSPCB)", 17.4601, 78.3344, 131, "avg of Dec'25 (129) & Nov'24 (133)"),
    ("Kokapet (TSPCB)",                  17.3936, 78.3392, 77,  "weak: undated aggregator reading"),
    ("Bollaram Industrial Area (TSPCB)", 17.5409, 78.3585, 156, "weak: undated aggregator reading"),
    ("ICRISAT Patancheru (TSPCB)",       17.5184, 78.2788, 150, "avg of Dec'25 (131) & Nov'24 (168)"),
    ("IDA Pashamylaram (TSPCB)",         17.5317, 78.2189, 237, "avg of 6 readings, Nov'24-Dec'25 (97,166,341,339,318,158)"),
    ("Nacharam TSIIC IALA (TSPCB)",      17.4294, 78.5694, 77,  "1 reading, Dec'25"),
    ("Kompally Municipal Office (TSPCB)",17.5449, 78.4869, 278, "1 reading, Dec'25 -- worst in city that day"),
    ("ECIL Kapra (TSPCB)",               17.4704, 78.5670, 90,  "avg of Dec'25 (88) & Nov'24 (91)"),
    ("IITH Kandi (TSPCB)",               17.5857, 78.1262, 73,  "1 reading, Dec'25"),
    ("Ramachandrapuram (TSPCB)",         17.5285, 78.2862, 42,  "PM2.5-derived, winter'24-25 avg 24.9ug/m3"),
]

# ── CHANDIGARH (3 real stations -- the network's entire size) ───────────
# Chandigarh Pollution Control Committee has confirmed, and shelved plans
# to expand beyond, its 3 continuous stations (The Tribune, "CPCC shelves
# plans on more air monitoring units"). Sector 22's coordinate is a
# third-party locality geocode (CPCB doesn't publish the exact monitor
# coordinate); Sector 25 and Sector 53 have no published coordinate at
# all, so each is placed at its own sector's established pincode
# centroid from chandigarh_sectors.py (160011 covers Sector 25 as a
# secondary/"nearby" sector per that file's own confidence flag; 160047
# covers Sectors 44-56 including Kajheri, which news coverage places
# Sector 53's station in). With only 3 real anchors for the whole city,
# this is necessarily coarse -- disclosed here rather than hidden behind
# invented per-sector precision the way the old PROFILE table's aqi=NN
# values were (those tracked each sector's crime figure, not real air
# data).
CHANDIGARH_STATIONS = [
    ("Sector 22 (CPCC)",  30.7330, 76.7712, 289, "avg of same-evening readings 257 & 321, Jan'24; locality geocode"),
    ("Sector 25 (CPCC)",  30.7530, 76.7790, 114, "recent 2-day aggregator range 77-151, midpoint; pincode-160011 centroid proxy"),
    ("Sector 53 / Forest Nursery (CPCC)", 30.7150, 76.7700, 186, "avg of Jan'24 (323) & recent 2-day range midpoint (49); pincode-160047 centroid proxy"),
]

# -- CHENNAI (8 real TNPCB/CPCB CAAQMS stations, 5 with an independently
#    found dated reading this pass) ------------------------------------
# Source for the station NAMES: Citizen Matters' TNPCB explainer
# (citizenmatters.in) confirms 8 real, currently-operating CAAQMS
# stations -- Kathivakkam, Manali, Royapuram, Kodungaiyur, Koyambedu,
# Perungudi, Velachery, Alandur. Real dated READINGS were independently
# found for only 5 of those 8 this session: Royapuram (aqi.in, 19 Oct
# 2025), Kodungaiyur (aqi.in, 19 Oct 2025), and Manali/Perungudi/
# Arumbakkam (The Federal, "Why has Chennai's AQI breached 160 despite
# the beach?", Dec 2025 -- reported as approximate ranges, "nearing
# 170"/"exceeding 170"/"nearly 200", not exact single-station figures,
# during what that piece calls Chennai's worst December air quality in 6
# years). Arumbakkam is a REAL named station too (confirmed via
# aqicn.org's Chennai network page) even though it wasn't in Citizen
# Matters' 8 -- added as a genuine 6th interpolation anchor rather than
# left out for not matching that one list.
#
# Kathivakkam, Koyambedu, Velachery and Alandur are real, confirmed
# operating stations (Velachery's own aqicn.org page exists: "Velachery
# Res. Area, Chennai") but no independently dated reading for any of the
# four was found this session -- repeated fetches of aqi.in's per-station
# dashboard pages (which worked for Royapuram/Kodungaiyur) hit
# robots.txt blocks for these four specifically. Rather than invent a
# number or silently drop these real stations from the record, they're
# EXCLUDED from CHENNAI_STATIONS' interpolation list below (so no pincode
# reading depends on a guessed figure) and flagged here as a named,
# open follow-up -- same honesty standard as Hyderabad's Kokapet/Bollaram
# "weak: undated aggregator reading" stations, one step more
# conservative (excluded rather than included-but-weak, since no
# aggregator reading at all was found for these four, weak or otherwise).
#
# Only 6 of Chennai's real stations feed interpolation this pass --
# coarser than Hyderabad's 13 or Mumbai's 18, closer to Bangalore's 9.
# Disclosed, not hidden.
CHENNAI_STATIONS = [
    ("Royapuram (TNPCB)",    13.1100, 80.2950, 107, "1 reading, 13 Oct 2025 (aqi.in)"),
    ("Kodungaiyur (TNPCB)",  13.1450, 80.2550, 156, "1 reading, 19 Oct 2025 (aqi.in)"),
    ("Manali (CPCB)",        13.1710, 80.2600, 170, "approximate, Dec 2025 (The Federal, 'nearing 170')"),
    ("Perungudi (TNPCB)",    12.9630, 80.2420, 200, "approximate, Dec 2025 (The Federal, 'nearly 200')"),
    ("Arumbakkam (TNPCB)",   13.0750, 80.2100, 170, "approximate, Dec 2025 (The Federal, 'nearing 170')"),
]
# Kathivakkam, Koyambedu, Velachery, Alandur -- real stations, no dated
# reading found this session. Not included above. See comment block.
CHENNAI_STATIONS_UNREAD = ["Kathivakkam (TNPCB)", "Koyambedu (TNPCB)",
                           "Velachery (TNPCB)", "Alandur (TNPCB)"]

# Ahmedabad: 6 real, named CPCB/GPCB stations found (aqicn.org's Ahmedabad
# station list: Maninagar, Rakhial, Gyaspur, SVPI Airport Hansol, SAC ISRO
# Satellite, Phase-4 GIDC Vatva). Only 3 gave a clean current single reading
# (aqicn.org mostly returned "Not Available" for live values, with a
# historical 2-day range shown instead for 2 more); Phase-4 GIDC Vatva's
# exact page 404'd on direct fetch and was not chased further (a slug
# guess, not the confirmed URL from the station-list page -- didn't
# retry with a fabricated alternate).
#
# Real disambiguation trap caught here, same class as Chennai's Chetpet
# case: Wikipedia's own "Gyaspur" article is a DIFFERENT Gyaspur in
# Ghaziabad district, Uttar Pradesh, not Ahmedabad's. Confirmed the real
# Ahmedabad Gyaspur via its postal directory pincode (382405, the same
# PIN as Narol -- indiatvnews, mapsofindia, prokerala, dwello.in all
# agree) before using its coordinates.
AHMEDABAD_STATIONS = [
    ("Maninagar (CPCB)",             22.99610, 72.60350, 108, "1 reading, page timestamp 23 Jun 2026 (aqicn.org)"),
    ("Gyaspur (CPCB)",               22.95990, 72.61990,  72, "1 reading, page timestamp 23 Jun 2026 (aqicn.org)"),
    ("SVPI Airport Hansol (CPCB)",   23.07722, 72.63472,  71, "1 reading, page timestamp 23 Jun 2026 (aqicn.org)"),
    ("Rakhial (CPCB)",               23.03400, 72.61950,  82, "approximate, 2-day PM2.5 range 63-102 (aqicn.org), midpoint used"),
    ("SAC ISRO Satellite (CPCB)",    23.02730, 72.51070,  98, "approximate, 2-day PM2.5 range 67-130 (aqicn.org), midpoint used"),
]
# Phase-4 GIDC Vatva -- real, named station, no reading found this session
# (direct page fetch 404'd; not chased with a guessed alternate URL).
AHMEDABAD_STATIONS_UNREAD = ["Phase-4 GIDC Vatva (CPCB)"]

# Kolkata (WBPCB / CPCB). Only 2 stations had genuinely clean, distinct,
# dated readings this pass -- Jadavpur and Rabindra Sarobar's IQAir pages
# returned values/timestamps IDENTICAL to Victoria's (same AQI, same
# pollutant breakdown, same weather fields), which reads as a
# station-data-unavailable fallback rather than two independent live
# readings -- excluded rather than used, since using them would trip the
# same zero-variance/placeholder-data smell the project's own validator
# checks for. Fort William, Bidhannagar (Salt Lake ATI), and Rabindra
# Bharati University are real named WBPCB stations with coordinates but
# no usable dated reading found. Presidency University showed a reading
# (75) but only via the same aggregator page that also carried a
# confirmed-wrong "Flora Fountain, Kolkata" entry (Flora Fountain is
# actually in Mumbai, not Kolkata -- excluded entirely, not even listed
# here) -- not independently re-confirmed, so left unread rather than
# trusted on a single compromised source. With only 2 usable stations,
# IDW interpolation will be coarse across this city -- same disclosure
# as Chandigarh's 3-station case.
KOLKATA_STATIONS = [
    ("Victoria (WBPCB)",       22.54480, 88.34040, 49, "US AQI, PM2.5 8.8ug/m3, 19:30 IST 25 Sep 2026 (IQAir)"),
    ("BITM / Ballygunge (WBPCB)", 22.53680, 88.36380, 65, "US AQI, PM2.5 16.6ug/m3, 09:30 IST 2 Jul 2026 (IQAir)"),
]
KOLKATA_STATIONS_UNREAD = [
    "Jadavpur (WBPCB)", "Rabindra Sarobar (WBPCB)", "Fort William (WBPCB)",
    "Bidhannagar / Salt Lake ATI (WBPCB)", "Rabindra Bharati University B.T. Road (WBPCB)",
    "Presidency University (WBPCB)",
]
