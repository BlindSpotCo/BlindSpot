#!/usr/bin/env python3
"""
scripts/chennai_areas.py

The Chennai metro pincode reference table -- 6th covered city, built to
the same "verified but partial" standard as mumbai_areas.py /
hyderabad_areas.py / chandigarh_sectors.py: 33 real, individually-sourced
pincodes across 6 zones, not exhaustive metro coverage. Extend the same
way -- 2+ independent postal-directory sources per pincode, or don't add
it yet.

SOURCING (this pass)
Pincodes cross-checked against 2+ of: madrasi.info, codepin.in,
aurumproptech.in, pincode.net.in, dwello.in, allindiapincode.net,
Wikipedia locality infoboxes, connectingtamilnadu.com. One real error
caught and fixed before shipping: Wikipedia's plain "Chetpet" page
resolves to a different town in Tiruvannamalai district (PIN 606801),
NOT Chennai's Chetpet near Nungambakkam (confirmed 600031 across 5
independent sources) -- the disambiguated "Chetpet (Chennai)" page is
the right one, this file used the verified 600031 throughout.

Lat/lon centroids below are general-knowledge locality coordinates, NOT
independently geocoded against a mapping API this session -- same
disclosed-precision level as Chandigarh's station coordinates in
cpcb_stations.py. Good enough for zone-level AQI interpolation and map
pins, not survey-grade.

SCHOOLS -- NOT YET SOURCED, open follow-up
Unlike Hyderabad's SCHOOLS_REAL (a dedicated second research pass),
no real named-school compilation was done for Chennai this pass.
build_chennai.py will run every pincode on the modelled-from-score
fallback (schools_sourced=False) until that pass happens -- same honest
gap Hyderabad shipped with before its own schools pass, not hidden.

GOVERNANCE / CRIME JURISDICTION -- genuine, but NOT the same shape as
Hyderabad's SCB problem
Tambaram is a real, separate Municipal Corporation (split back out from
Greater Chennai Corporation in 2021) with its own separate police
jurisdiction, Tambaram City Police -- distinct from Greater Chennai
Police (GCP), which covers the rest of this file's pincodes. Unlike
Hyderabad's Secunderabad Cantonment Board, this is NOT a disputed or
ambiguous boundary -- it's a clean corporation-line split, confirmed via
Tambaram City Police's own Wikipedia page. So COMMISSIONERATE_OF below
correctly attributes the Tambaram-belt zone to "Tambaram City Police"
rather than folding it into GCP (the direct Chennai analogue of the
Delhi Cantonment / Hyderabad SCB attribution mistake this project has
now caught three times), but GOVERNANCE_CONF is "confirmed" everywhere,
not "disputed" -- there's no genuine ambiguity here to flag.

POWER -- TANGEDCO is the single, confirmed state-wide utility for all of
Tamil Nadu including Chennai (Tamil Nadu Generation and Distribution
Corporation handles both generation and distribution as one entity,
unlike most states) -- flat DISCOM_OF/DISCOM_CONF, same pattern as
Hyderabad's single-TSSPDCL case. See build_chennai.py's docstring for
why the exact current Ministry of Power letter grade is flagged, not
used directly, this pass.

PRICE -- Tamil Nadu's Registration Department calls its government
minimum property value the "guideline value" (TNREGINET). Real, dated
per-locality figures were found for T Nagar (Usman Road, ₹27,500/sqft),
Mylapore (Kutchery Road, ₹22,000), Anna Nagar (2nd Ave, ₹15,900), Adyar
(Sardar Patel Rd, ₹15,400), Velachery (₹13,200), and the OMR IT corridor
(₹4,000-6,500) via squareyards.com (dated "updated 4 June 2026", the
underlying TN government revision date itself not independently pinned
down this session) -- used directly, at rate_exact=True, in
build_chennai.py. Every other pincode's tier below is an INFORMED
ESTIMATE from general market knowledge of the area (a premium/mid/value
qualitative call), not an individually sourced figure -- the same
qualitative level Hyderabad's own tier column carried for its
non-LOCALITY_RATE_SQFT pincodes.

STRUCTURE
pincode -> (display_name, area_label, lat, lon, price_tier, [landmarks])
price_tier: 1 Premium .. 5 Value.
"""

# -- North Chennai / Industrial belt ---------------------------------------
# Manali is Chennai's real oil-refining/petrochemical hub (CPCL Manali
# Refinery); Kathivakkam sits by North Chennai Thermal Power Station;
# Thiruvottiyur is adjacent to Ennore Port. Real, named industrial
# anchors, not a generic "industrial zone" label -- and the reason this
# belt independently shows the worst real AQI readings found (see
# cpcb_stations.py's CHENNAI_STATIONS).
NORTH_INDUSTRIAL = {
    "600068": ("Manali", "North Chennai", 13.1710, 80.2600, 5,
               ["CPCL Manali Refinery", "Manali petrochemical complex"]),
    "600057": ("Kathivakkam", "North Chennai", 13.2200, 80.3150, 5,
               ["North Chennai Thermal Power Station vicinity"]),
    "600019": ("Thiruvottiyur", "North Chennai", 13.1600, 80.3000, 5,
               ["Ennore Port vicinity"]),
    "600081": ("Tondiarpet", "North Chennai", 13.1250, 80.2850, 4,
               []),
    "600013": ("Royapuram", "North Chennai", 13.1100, 80.2950, 4,
               ["Royapuram fishing harbour"]),
}

# -- Central Chennai --------------------------------------------------------
# Mature core, real Green Line metro coverage (Anna Nagar/Koyambedu/
# Arumbakkam/Vadapalani-adjacent corridor); Nungambakkam and Anna Nagar
# are genuinely premium, not just "central by default".
CENTRAL = {
    "600008": ("Egmore", "Central Chennai", 13.0732, 80.2609, 2,
               ["Egmore Railway Station", "Government Museum"]),
    "600034": ("Nungambakkam", "Central Chennai", 13.0569, 80.2425, 1,
               ["Nungambakkam High Road"]),
    "600010": ("Kilpauk", "Central Chennai", 13.0780, 80.2410, 2,
               ["Kilpauk Medical College"]),
    "600031": ("Chetpet", "Central Chennai", 13.0700, 80.2430, 2,
               ["Chetpet metro (Green Line)"]),
    "600040": ("Anna Nagar", "Central Chennai", 13.0850, 80.2101, 1,
               ["Anna Nagar Tower Park", "Anna Nagar East/Tower metro (Green Line)"]),
    "600024": ("Kodambakkam", "Central Chennai", 13.0500, 80.2250, 3,
               ["Kodambakkam film studios (Kollywood)"]),
    "600107": ("Koyambedu", "Central Chennai", 13.0700, 80.1950, 3,
               ["CMBT bus terminus", "Koyambedu wholesale market", "Koyambedu metro (Green Line)"]),
    "600106": ("Arumbakkam", "Central Chennai", 13.0750, 80.2100, 3,
               ["Arumbakkam metro (Green Line)"]),
}

# -- South Chennai (established) --------------------------------------------
# Highest real guideline values found this session (T Nagar/Mylapore/
# Adyar) -- genuinely the most expensive belt, not an assumption.
SOUTH_ESTABLISHED = {
    "600017": ("T Nagar", "South Chennai", 13.0418, 80.2341, 1,
               ["Pondy Bazaar", "Panagal Park"]),
    "600004": ("Mylapore", "South Chennai", 13.0339, 80.2619, 1,
               ["Kapaleeshwarar Temple"]),
    "600020": ("Adyar", "South Chennai", 13.0012, 80.2565, 1,
               ["Adyar River", "Besant Nagar Beach vicinity"]),
    "600018": ("Alwarpet", "South Chennai", 13.0330, 80.2540, 1,
               []),
    "600032": ("Guindy", "South Chennai", 13.0100, 80.2200, 2,
               ["Guindy National Park", "Guindy metro (Blue Line)"]),
    "600015": ("Saidapet", "South Chennai", 13.0210, 80.2230, 2,
               ["Saidapet metro (Blue Line)"]),
    "600083": ("Ashok Nagar", "South Chennai", 13.0380, 80.2100, 2,
               []),
    "600078": ("KK Nagar", "South Chennai", 13.0380, 80.1980, 2,
               []),
}

# -- IT Corridor / OMR-ECR ---------------------------------------------------
# Real, heavily documented CMWSSB piped-water gap (Citizen Matters:
# "two decades of broken promises"; a June 2025 crisis cut Metrowater
# supply to OMR/Sholinganallur by 75%) -- applied as a real water-score
# penalty in build_chennai.py, not modelled from nothing. Perungudi also
# carries Chennai's old solid-waste dumpyard, a real, named environmental
# fact independent of the water story.
IT_CORRIDOR = {
    "600096": ("Perungudi", "IT Corridor", 12.9630, 80.2420, 3,
               ["Perungudi IT SEZ", "Perungudi dumpyard vicinity"]),
    "600042": ("Velachery", "IT Corridor", 12.9790, 80.2210, 3,
               ["Phoenix MarketCity", "Velachery MRTS"]),
    "600119": ("Sholinganallur", "IT Corridor", 12.9010, 80.2280, 4,
               ["OMR IT corridor"]),
    "600097": ("Thoraipakkam", "IT Corridor", 12.9420, 80.2380, 4,
               ["OMR IT corridor"]),
    "603103": ("Siruseri", "IT Corridor", 12.8280, 80.2270, 4,
               ["SIPCOT IT Park Siruseri"]),
}
# Semmenchery shares Sholinganallur's postal pincode (600119, confirmed
# via aurumproptech.in) rather than having its own -- same real-sharing
# pattern as Hyderabad's Alwal/Bolarum. Kept as an alias, not a second
# fabricated pincode entry.
SEMMENCHERY_ALIAS_OF = "600119"

# -- West Chennai -------------------------------------------------------------
WEST = {
    "600116": ("Porur", "West Chennai", 13.0380, 80.1580, 3,
               ["Porur Lake"]),
    "600026": ("Vadapalani", "West Chennai", 13.0500, 80.2120, 2,
               ["Vadapalani Murugan Temple", "Vadapalani metro (Green Line)"]),
    "600087": ("Valasaravakkam", "West Chennai", 13.0410, 80.1780, 3,
               []),
    "600056": ("Poonamallee", "West Chennai", 13.0480, 80.1090, 4,
               []),
}

# -- Tambaram belt (separate corporation + separate police jurisdiction) ----
TAMBARAM_BELT = {
    "600045": ("Tambaram", "Tambaram belt", 12.9250, 80.1270, 4,
               ["Tambaram Railway Station", "Tambaram City Municipal Corporation (separate from GCC)"]),
    "600044": ("Chromepet", "Tambaram belt", 12.9510, 80.1420, 3,
               []),
    "600043": ("Pallavaram", "Tambaram belt", 12.9680, 80.1500, 3,
               ["Chennai Airport vicinity"]),
    "600100": ("Pallikaranai", "Tambaram belt", 12.9370, 80.2130, 3,
               ["Pallikaranai Marsh (Ramsar wetland)"]),
}

CHENNAI = {**NORTH_INDUSTRIAL, **CENTRAL, **SOUTH_ESTABLISHED, **IT_CORRIDOR,
           **WEST, **TAMBARAM_BELT}

ZONE_OF = {}
for _pin in NORTH_INDUSTRIAL: ZONE_OF[_pin] = "North Chennai"
for _pin in CENTRAL: ZONE_OF[_pin] = "Central Chennai"
for _pin in SOUTH_ESTABLISHED: ZONE_OF[_pin] = "South Chennai"
for _pin in IT_CORRIDOR: ZONE_OF[_pin] = "IT Corridor"
for _pin in WEST: ZONE_OF[_pin] = "West Chennai"
for _pin in TAMBARAM_BELT: ZONE_OF[_pin] = "Tambaram belt"

# No disputed boundary found this session (see module docstring) --
# "confirmed" everywhere, unlike Hyderabad's CANTONMENT_AMBIGUOUS set.
GOVERNANCE_CONF = {pin: "confirmed" for pin in CHENNAI}

# Crime jurisdiction -- the real GCP / Tambaram City Police split.
COMMISSIONERATE_OF = {pin: ("Tambaram City Police" if pin in TAMBARAM_BELT
                             else "Greater Chennai Police") for pin in CHENNAI}

# TANGEDCO -- confirmed sole state-wide utility, see module docstring.
DISCOM_OF = {pin: "TANGEDCO (Tamil Nadu Generation and Distribution Corporation)" for pin in CHENNAI}
DISCOM_CONF = {pin: "confirmed" for pin in CHENNAI}

TIER_LABEL = {1: "Premium", 2: "Upper", 3: "Mid", 4: "Modest", 5: "Value"}


def landmarks_of(pin):
    return CHENNAI[pin][5]


def audit():
    zones = {}
    for pin in CHENNAI:
        zones.setdefault(ZONE_OF[pin], []).append(pin)
    print(f"total pincodes: {len(CHENNAI)}")
    for z, pins in zones.items():
        print(f"  {z}: {len(pins)}")
    dupes = [p for p in CHENNAI if list(CHENNAI.keys()).count(p) > 1]
    print("duplicate pincodes:", dupes or "none")
    n_land = sum(len(landmarks_of(p)) for p in CHENNAI)
    print(f"landmarks: {n_land}")
    tambaram = [p for p, c in COMMISSIONERATE_OF.items() if c == "Tambaram City Police"]
    print(f"Tambaram City Police pincodes ({len(tambaram)}):", tambaram)
    return not dupes


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
