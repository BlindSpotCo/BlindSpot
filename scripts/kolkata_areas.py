# scripts/kolkata_areas.py
# Pincode reference table for Kolkata, mirroring ahmedabad_areas.py's and
# chennai_areas.py's structure exactly.
#
# SOURCING STANDARD: every pincode below was independently cross-checked
# against 2+ sources (pincode.net.in's India Post roster where available,
# plus at least one of mapsofindia.com, pincodesinfo.in, aurumproptech.in,
# mappls.com, squareyards.com, or a locality's own Wikipedia page) before
# being trusted -- applying the Ahmedabad-pass lesson that a single bulk
# listing page can attach a wrong locality name to a real pincode number.
#
# A LOCALITY-NAME TRAP CAUGHT THIS PASS: Netaji Bhawan (Subhas Chandra
# Bose's Elgin Road house) is commonly described loosely as "in
# Bhowanipore" -- but its real pincode is 700020 (Elgin), not 700025
# (Bhowanipore proper). Corrected via aurumproptech's dedicated pincode
# page and mappls before this table was finalized -- the same class of
# error as Chennai's Chetpet and Ahmedabad's Gyaspur disambiguation traps.
#
# A PINCODE DELIBERATELY EXCLUDED: 700135, the literal "Rajarhat" post
# office name, looked like an obvious New Town/Rajarhat candidate but
# pincode.net.in shows it actually covers ~24 mostly RURAL post offices
# under the Barasat postal division (Akandakeshari, Bagu, Kamduni,
# Satbhaya, etc.) -- outer rural Rajarhat block, not the developed New
# Town corridor. Using it would have repeated the exact Ahmedabad mistake
# (a real pincode, wrong practical locality match). New Town/Rajarhat is
# represented below by its actual developed-area pincodes instead
# (700156, 700157, 700161).
#
# HOWRAH is deliberately out of scope -- it's a separate municipal
# corporation/district across the Hooghly, not part of Kolkata proper,
# even though CESC's own license area spans "Kolkata, Howrah and
# adjoining areas." Treated as its own future city, not folded in here.
#
# ZONES here are informal geographic groupings for this dataset's own
# ZONE_BASELINE modelling, not a reproduction of KMC's official
# borough/ward structure.
#
# GOVERNANCE -- a genuine, confirmed two-commissionerate split, not a
# disputed edge case: Kolkata Police covers the KMC area (Zones 1-7,
# pincodes in the 700001-700099 range). Bidhannagar Police Commissionerate
# -- a separate, independently constituted force, not a Kolkata Police
# division -- covers Salt Lake/Bidhannagar and New Town/Rajarhat (Zones 8
# and 9) in full. Source: Bidhannagar Police Commissionerate's own site
# and Wikipedia page. Zones 8/9 are ALSO administratively in North 24
# Parganas district, inside Bidhannagar Municipal Corporation, not the
# Kolkata Municipal Corporation boundary, even though colloquially
# considered "part of Kolkata" -- flagged per-pincode via GOVERNANCE_CONF
# as "confirmed-separate-jurisdiction" rather than folded silently into
# the Kolkata Police entries.
#
# POWER -- a genuine THREE-way split, more complex than a simple
# CESC-vs-WBSEDCL binary:
#   - CESC (Calcutta Electric Supply Corporation), a private licensee,
#     covers the whole KMC area -- confirmed via CESC's own "About Us"
#     page -- Zones 1-7 (all 700001-700099 pincodes below).
#   - WBSEDCL (West Bengal State Electricity Distribution Company) runs
#     its own "Bidhannagar Division I and II" -- confirmed via WBSEDCL's
#     own structure -- covering Salt Lake proper: 700064, 700091, 700106.
#   - NTESCL (New Town Electric Supply Company Limited), a 50:50 WBSEB/
#     WBHIDCO joint venture incorporated 2003 and still active as of a
#     2019 litigation record, serves New Town's Action Areas I-III
#     specifically: 700156, 700161.
#   - 700102 (Kestopur) and 700157 (Hatiara) sit geographically between
#     WBSEDCL's Bidhannagar division and NTESCL's Action-Area-specific
#     remit -- no primary source named a utility for these two
#     specifically, so DISCOM_CONF is "modelled" (best real-world
#     inference: WBSEDCL, matching the general Bidhannagar-periphery
#     pattern) rather than "confirmed" for just these two pincodes. Never
#     silently treated as equally certain to the other 42.
#
# Coordinate precision: locality-centroid level (4-5 decimal places,
# several cross-checked directly against real metro-station coordinates
# in the same locality), same disclosure as Chennai/Ahmedabad -- not
# survey-grade.

NORTH_OLD_CITY = {
    "700001": ("BBD Bagh / Council House Street", "BBD Bagh", 22.56970, 88.34940, 3,
               ["Kolkata GPO", "Writers' Buildings"]),
    "700003": ("Baghbazar", "Baghbazar", 22.59850, 88.36600, 3,
               ["Baghbazar Ghat"]),
    "700004": ("Shyambazar", "Shyambazar", 22.60140, 88.37250, 3,
               ["R.G. Kar Medical College", "Shyambazar 5-Point Crossing"]),
    "700006": ("Jorasanko", "Jorasanko", 22.58850, 88.36200, 3,
               ["Jorasanko Thakurbari (Rabindranath Tagore's ancestral house)"]),
    "700007": ("Barabazar / College Square", "Barabazar", 22.57450, 88.36200, 3,
               ["College Square"]),
    "700009": ("Sovabazar", "Sovabazar", 22.59610, 88.36530, 3,
               ["Sovabazar Rajbari"]),
    "700037": ("Belgachia", "Belgachia", 22.60580, 88.38640, 4,
               ["Belgachia Metro Station"]),
}

CENTRAL_CBD = {
    "700013": ("Dharmatala / Esplanade", "Dharmatala", 22.56260, 88.35290, 3,
               ["New Market vicinity"]),
    "700016": ("Park Street", "Park Street", 22.55500, 88.35030, 1,
               ["Park Street", "St. Xavier's College"]),
    "700017": ("Park Circus", "Park Circus", 22.54700, 88.36900, 3,
               ["Park Circus seven-point crossing"]),
    "700069": ("Esplanade", "Esplanade", 22.56440, 88.35170, 2,
               ["Esplanade Metro Station"]),
    "700071": ("Middleton Row", "Middleton Row", 22.55250, 88.35200, 1,
               ["Victoria Memorial Hall"]),
    "700087": ("New Market", "New Market", 22.56000, 88.35200, 3,
               ["New Market (Hogg Market)"]),
}

SOUTH_BALLYGUNGE_ALIPORE = {
    "700019": ("Ballygunge / Gariahat", "Ballygunge", 22.52850, 88.36500, 1,
               ["Gariahat Market"]),
    "700020": ("Elgin", "Elgin", 22.53800, 88.35200, 1,
               ["Netaji Bhawan (Subhas Chandra Bose museum)"]),
    "700025": ("Bhowanipore", "Bhowanipore", 22.52650, 88.34250, 2,
               ["Lansdowne Market"]),
    "700026": ("Kalighat", "Kalighat", 22.51670, 88.34610, 2,
               ["Kalighat Kali Temple"]),
    "700027": ("Alipore", "Alipore", 22.53500, 88.33000, 1,
               ["Alipore Zoological Garden"]),
    "700029": ("Rashbehari / Gole Park", "Rashbehari", 22.51110, 88.35140, 2,
               ["Rabindra Sarobar (Dhakuria Lake)"]),
    "700053": ("New Alipore", "New Alipore", 22.51000, 88.32300, 2,
               ["India Government Mint, Kolkata"]),
}

SOUTH_TOLLYGUNGE_JADAVPUR = {
    "700032": ("Jadavpur", "Jadavpur", 22.49930, 88.36920, 3,
               ["Jadavpur University"]),
    "700033": ("Tollygunge", "Tollygunge", 22.49470, 88.34500, 3,
               ["Tollygunge Club"]),
    "700045": ("Lake Gardens", "Lake Gardens", 22.50500, 88.35000, 2,
               ["Lake Gardens"]),
    "700047": ("Garia", "Garia", 22.46000, 88.39500, 4,
               ["Garia B.T. Road"]),
    "700068": ("Jodhpur Park", "Jodhpur Park", 22.50200, 88.36000, 2,
               ["Jodhpur Park"]),
    "700094": ("Panchasayar / Baishnabghata-Patuli", "Panchasayar", 22.47500, 88.39000, 3,
               ["Baishnab Ghata Patuli Township"]),
}

SOUTH_WEST_BEHALA = {
    "700008": ("Barisha", "Barisha", 22.48500, 88.32000, 4,
               ["Barisha"]),
    "700034": ("Behala", "Behala", 22.48750, 88.31330, 4,
               ["Behala Chowrasta / Behala Municipal Market"]),
    "700060": ("Parnasree", "Parnasree", 22.49500, 88.31500, 4,
               ["Parnasree Pally"]),
    "700063": ("Thakurpukur", "Thakurpukur", 22.46420, 88.30750, 4,
               ["Chittaranjan National Cancer Institute (Thakurpukur campus)"]),
}

PORT_DOCKYARD = {
    "700023": ("Khidderpore", "Khidderpore", 22.54500, 88.32500, 4,
               ["Kolkata Port Trust / Khidirpur Dock Gates"]),
    "700024": ("Garden Reach", "Garden Reach", 22.53500, 88.30500, 5,
               ["Garden Reach Shipbuilders & Engineers (GRSE) HQ"]),
}

EAST_BYPASS = {
    "700015": ("Tangra", "Tangra", 22.54500, 88.39000, 4,
               ["Tangra Chinatown"]),
    "700039": ("Tiljala / Topsia", "Tiljala", 22.53000, 88.38000, 4,
               ["Picnic Garden"]),
    "700042": ("Kasba", "Kasba", 22.51500, 88.38000, 4,
               ["Kasba Industrial Estate"]),
    "700046": ("Gobinda Khatick Road", "Gobinda Khatick Road", 22.53500, 88.39500, 3,
               ["Science City Kolkata"]),
    "700099": ("Mukundapur", "Mukundapur", 22.49500, 88.39800, 3,
               ["AMRI Hospitals, Mukundapur"]),
}

# A genuine, confirmed separate jurisdiction (Bidhannagar Police +
# WBSEDCL/NTESCL, North 24 Parganas district, not KMC) -- see docstring.
SALT_LAKE_BIDHANNAGAR = {
    "700064": ("Salt Lake Sector I", "Salt Lake Sector I", 22.58500, 88.40500, 2,
               ["City Centre I Mall"]),
    "700091": ("Salt Lake Sector III", "Salt Lake Sector III", 22.58640, 88.42140, 2,
               ["Karunamoyee (Metro Station; Sech Bhawan govt. complex)"]),
    "700102": ("Kestopur", "Kestopur", 22.60500, 88.42000, 3,
               ["Kestopur"]),
    "700106": ("Salt Lake Sector V", "Salt Lake Sector V", 22.58140, 88.42970, 2,
               ["Nicco Park / Webel Bhavan IT hub"]),
}

NEW_TOWN_RAJARHAT = {
    "700156": ("New Town", "New Town", 22.58500, 88.46500, 2,
               ["New Town Ecospace / Rajarhat P.S."]),
    "700157": ("Hatiara", "Hatiara", 22.61500, 88.44500, 3,
               ["Chinar Park (VIP Road landmark)"]),
    "700161": ("New Town Action Area II", "New Town Action Area II", 22.60000, 88.47500, 3,
               ["Eco Park (Bengal's largest urban park)"]),
}

KOLKATA = {}
for _z in (NORTH_OLD_CITY, CENTRAL_CBD, SOUTH_BALLYGUNGE_ALIPORE, SOUTH_TOLLYGUNGE_JADAVPUR,
           SOUTH_WEST_BEHALA, PORT_DOCKYARD, EAST_BYPASS, SALT_LAKE_BIDHANNAGAR, NEW_TOWN_RAJARHAT):
    KOLKATA.update(_z)

_ZONE_NAMES = (
    ("North Kolkata / Old City", NORTH_OLD_CITY),
    ("Central / CBD", CENTRAL_CBD),
    ("South (Ballygunge / Bhowanipore / Alipore / Kalighat)", SOUTH_BALLYGUNGE_ALIPORE),
    ("South (Tollygunge / Jadavpur / Garia)", SOUTH_TOLLYGUNGE_JADAVPUR),
    ("South-West (Behala / Thakurpukur)", SOUTH_WEST_BEHALA),
    ("Port / Dockyard (Khidderpore / Garden Reach)", PORT_DOCKYARD),
    ("East (EM Bypass belt)", EAST_BYPASS),
    ("Salt Lake / Bidhannagar", SALT_LAKE_BIDHANNAGAR),
    ("New Town / Rajarhat", NEW_TOWN_RAJARHAT),
)

ZONE_OF = {}
for _name, _z in _ZONE_NAMES:
    for _pin in _z:
        ZONE_OF[_pin] = _name

_SALT_LAKE_NEW_TOWN_PINS = set(SALT_LAKE_BIDHANNAGAR) | set(NEW_TOWN_RAJARHAT)

# Confirmed two-commissionerate split (see docstring) -- not a disputed
# boundary, a real, clean, named separate force for Zones 8-9.
GOVERNANCE_CONF = {
    pin: ("confirmed-separate-jurisdiction" if pin in _SALT_LAKE_NEW_TOWN_PINS else "confirmed")
    for pin in KOLKATA
}

COMMISSIONERATE_OF = {
    pin: ("Bidhannagar Police Commissionerate" if pin in _SALT_LAKE_NEW_TOWN_PINS else "Kolkata Police")
    for pin in KOLKATA
}

_WBSEDCL_PINS = {"700064", "700091", "700106"}
_NTESCL_PINS = {"700156", "700161"}
_WBSEDCL_MODELLED_PINS = {"700102", "700157"}  # see docstring -- no primary source named these two

DISCOM_OF = {}
DISCOM_CONF = {}
for pin in KOLKATA:
    if pin in _WBSEDCL_PINS:
        DISCOM_OF[pin] = "WBSEDCL"
        DISCOM_CONF[pin] = "confirmed"
    elif pin in _NTESCL_PINS:
        DISCOM_OF[pin] = "NTESCL"
        DISCOM_CONF[pin] = "confirmed"
    elif pin in _WBSEDCL_MODELLED_PINS:
        DISCOM_OF[pin] = "WBSEDCL"
        DISCOM_CONF[pin] = "modelled"
    else:
        DISCOM_OF[pin] = "CESC"
        DISCOM_CONF[pin] = "confirmed"

TIER_LABEL = {1: "Premium", 2: "Upper-mid", 3: "Mid", 4: "Affordable", 5: "Budget"}

def landmarks_of(pin):
    return KOLKATA[pin][5]

def audit():
    pins = list(KOLKATA.keys())
    dupes = [p for p in pins if pins.count(p) > 1]
    total_landmarks = sum(len(v[5]) for v in KOLKATA.values())
    print(f"total pincodes: {len(pins)}")
    for zname, zdict in _ZONE_NAMES:
        print(f"  {zname}: {len(zdict)}")
    print(f"duplicate pincodes: {dupes if dupes else 'none'}")
    print(f"landmarks: {total_landmarks}")
    print(f"Kolkata Police pincodes: {sum(1 for p in pins if COMMISSIONERATE_OF[p] == 'Kolkata Police')}")
    print(f"Bidhannagar Police Commissionerate pincodes: {sum(1 for p in pins if COMMISSIONERATE_OF[p] == 'Bidhannagar Police Commissionerate')}")
    print(f"CESC pincodes: {sum(1 for p in pins if DISCOM_OF[p] == 'CESC')}")
    print(f"WBSEDCL pincodes: {sum(1 for p in pins if DISCOM_OF[p] == 'WBSEDCL')} (modelled: {sum(1 for p in pins if DISCOM_OF[p] == 'WBSEDCL' and DISCOM_CONF[p] == 'modelled')})")
    print(f"NTESCL pincodes: {sum(1 for p in pins if DISCOM_OF[p] == 'NTESCL')}")

if __name__ == "__main__":
    audit()
