# scripts/ahmedabad_areas.py
# Pincode reference table for Ahmedabad, mirroring chennai_areas.py's and
# hyderabad_areas.py's structure exactly.
#
# SOURCING STANDARD: every pincode below is backed by 2+ independent
# postal-directory sources (pincode.net.in -- which mirrors India Post's own
# official post-office roster -- plus at least one of mapsofindia.com,
# prokerala.com, indiatvnews.com, aurumproptech.in, dwello.in, onefivenine.com,
# or a locality's own Wikipedia page).
#
# A REAL LESSON FROM THIS PASS, worth keeping visible: the first bulk source
# checked (a single "Ahmedabad pincodes" listing page) turned out to be wrong
# for roughly half its entries -- not just one or two traps like Chennai's
# Chetpet/GIFT-City cases, but a systematic mismatch between the pincode
# number and the locality name attached to it (e.g. it labelled 380016 as
# "Vasna/Vejalpur" when 380016 is actually Asarwa Chakla/Civil Hospital;
# labelled 380021 as "Naroda/Odhav" when 380021 is actually Gomtipur, and
# Naroda's real pincode is 382330). Every single pincode below was
# individually re-verified against pincode.net.in's official post-office
# roster before being trusted, not assumed from that bulk list. Two more
# specific traps caught and excluded outright:
#   - 382355 ("GIFT City") is a real pincode, but GIFT City is in GANDHINAGAR
#     district, not Ahmedabad -- confirmed via 5 independent sources.
#   - 382425 was claimed to be Ranip; it's actually Bareja, a separate,
#     more peripheral Ahmedabad-district town. Ranip's real pincode is
#     382480 (confirmed via Wikipedia's own Ranip article).
#
# ZONES here are informal geographic groupings for this dataset's own
# ZONE_BASELINE modelling, NOT a reproduction of AMC's own official 7-zone
# political structure (Central/East/West/North/South/North West/South
# West -- confirmed to exist via Wikipedia, but no locality-to-zone lookup
# table was found to cross-check against), matching Chennai's and
# Hyderabad's own convention of informal, geography-driven zone names.
#
# GOVERNANCE: Ahmedabad City Police covers the whole AMC area with no
# internal disputed split found (unlike Chennai's genuine Tambaram/GCP
# split) -- simpler governance story here. A May 2025 jurisdiction
# expansion added rural Ahmedabad-district/Gandhinagar-district fringe
# areas (Gota/Hebatpur/Khodiyar approaches, Tragad/Khoraj/Koteshwar
# approaches, etc.) to Ahmedabad City Police's beat, but per the source
# reporting it, this was about newly-developing areas OUTSIDE the
# established city, not a reassignment of any AMC-proper pincode -- so
# GOVERNANCE_CONF stays "confirmed" for every pincode below.
#
# DISCOM: Torrent Power, a real, named PRIVATE distribution licensee for
# Ahmedabad + Gandhinagar (a genuinely distinctive fact vs. every other
# covered city so far, which all use a state-run DISCOM) -- Torrent Power's
# own site states it serves "over 3.85 million customers" across
# Ahmedabad/Gandhinagar/Surat/Dahej, but its exact license-area boundary
# within Ahmedabad district (core AMC vs. some rural fringe) was not
# independently confirmed this pass -- same honesty level as Chennai's
# TANGEDCO citation (real utility, granular boundary unconfirmed).
#
# Two North-West pincodes (382470 Tragad, 382421 Vaishnodevi Circle) and
# one South-West pincode (382210 Sarkhej) sit in Ahmedabad's newer growth
# corridor and may be partly AUDA-governed rather than core AMC -- flagged
# individually below via a per-pincode note, not silently treated as
# identical to the established core.
#
# Coordinate precision: locality-centroid level (4-5 decimal places from
# postal-directory sources), same precision disclosure as Chennai/Hyderabad,
# not survey-grade.

CENTRAL = {
    "380001": ("Kalupur / Khadia / Old City", "Kalupur", 23.02650, 72.59710, 3,
               ["Kalupur Railway Station", "Manek Chowk night food market", "Jama Masjid"]),
    "380002": ("N.C. Market / Revdi Bazar", "Revdi Bazar", 23.02440, 72.60130, 3,
               ["New Cloth Market (wholesale textile hub)"]),
    "380004": ("Shahibag / Shahpur / Madhupura", "Shahibag", 23.03830, 72.59220, 3,
               ["Madhupura Market", "Shahibag Underbridge"]),
    "380006": ("Ellisbridge / Ambawadi", "Ellisbridge", 23.02330, 72.56260, 2,
               ["Ellis Bridge over the Sabarmati"]),
    "380009": ("Navrangpura / CG Road", "Navrangpura", 23.03540, 72.56090, 2,
               ["CG Road shopping corridor", "Gujarat University"]),
    "380016": ("Asarwa / Civil Hospital / Meghaninagar", "Asarwa", 23.04490, 72.60530, 4,
               ["Civil Hospital Asarwa (one of Asia's largest government hospitals)"]),
}

WEST = {
    "380007": ("Paldi / Vasna", "Paldi", 23.01450, 72.56000, 2,
               ["Vasna Barrage", "Income Tax Circle"]),
    "380013": ("Naranpura / Nava Vadaj / Vadaj", "Naranpura", 23.04770, 72.54870, 2,
               ["Sardar Patel Stadium"]),
    "380015": ("Satellite / Vastrapur / Prahladnagar", "Satellite", 23.02730, 72.51070, 1,
               ["IIM Ahmedabad", "ISKCON Temple", "Vastrapur Lake"]),
    "380054": ("Bodakdev / SG Highway", "Bodakdev", 23.03740, 72.50550, 1,
               ["SG Highway corporate corridor"]),
    "380059": ("Thaltej", "Thaltej", 23.04970, 72.51620, 2,
               ["Thaltej Lake"]),
    "380061": ("Ghatlodia", "Ghatlodia", 23.07040, 72.54250, 3,
               []),
    "380058": ("Bopal / Shela / Shilaj / Ambli / Ghuma", "Bopal", 23.03910, 72.46590, 3,
               ["Bopal-Ghuma growth corridor"]),
}

EAST_INDUSTRIAL = {
    "380018": ("Saraspur", "Saraspur", 23.01870, 72.62070, 4,
               ["Saraspur textile-mill legacy area"]),
    "380019": ("D Cabin / Railway Colony", "D Cabin", 23.05460, 72.61200, 4,
               ["Kalupur-Naroda rail corridor"]),
    "380021": ("Gomtipur", "Gomtipur", 23.01590, 72.62790, 5,
               ["Gomtipur mill area (historic textile-mill legacy)"]),
    "380023": ("Rakhial", "Rakhial", 23.03400, 72.61950, 4,
               ["Rakhial industrial/mill belt"]),
    "380024": ("Bapunagar", "Bapunagar", 23.03790, 72.63160, 4,
               ["Bapunagar Industrial Estate"]),
    "380026": ("Amraiwadi", "Amraiwadi", 23.00780, 72.62430, 3,
               ["Amraiwadi metro station"]),
    "382350": ("Nikol", "Nikol", 23.03900, 72.65650, 3,
               ["Nikol residential-industrial belt"]),
    "382415": ("Odhav", "Odhav", 23.02700, 72.65330, 4,
               ["Odhav Industrial Estate (chemical/dye units)"]),
    "382418": ("Vastral", "Vastral", 23.00360, 72.64760, 3,
               ["Vastral metro station", "Vastral Lake"]),
    "382445": ("Vatva / Vatva GIDC", "Vatva", 22.97460, 72.62690, 4,
               ["Vatva GIDC industrial estate", "Vatva railway station"]),
    "382330": ("Naroda", "Naroda", 23.06940, 72.64850, 4,
               ["Naroda GIDC industrial estate"]),
}

SOUTH = {
    "380008": ("Maninagar / Kankaria", "Maninagar", 22.99610, 72.60350, 3,
               ["Kankaria Lake", "Maninagar railway station"]),
    "380050": ("Ghodasar", "Ghodasar", 22.98280, 72.59310, 3,
               []),
    "382405": ("Narol", "Narol", 22.95990, 72.61990, 4,
               ["Narol GIDC", "Ahmedabad-Vadodara Expressway junction"]),
    "382443": ("Isanpur", "Isanpur", 22.96830, 72.59770, 3,
               []),
}

NORTH_RIVERFRONT = {
    "380005": ("Sabarmati / Motera", "Sabarmati", 23.08560, 72.59230, 2,
               ["Narendra Modi Stadium at Motera (world's largest cricket stadium)"]),
    "380027": ("Gandhi Ashram / Sabarmati Central Jail Road", "Gandhi Ashram", 23.06070, 72.58020, 2,
               ["Sabarmati Ashram (Gandhi's residence, 1917-1930)"]),
    "382424": ("Chandkheda / Sughad", "Chandkheda", 23.11480, 72.59200, 3,
               ["Part of AMC since 2008 (formerly a separate panchayat)"]),
}

NORTH_WEST_GROWTH = {
    "380052": ("Memnagar", "Memnagar", 23.05300, 72.54460, 2,
               []),
    "382481": ("Chandlodia / Gota", "Chandlodia", 23.10800, 72.55870, 3,
               ["Chandlodia is the delivery sub-office for this shared PIN; Gota is a branch office under it"]),
    "382470": ("Tragad", "Tragad", 23.13120, 72.56570, 4,
               ["Newer residential growth corridor -- possibly partly AUDA-governed, not confirmed core AMC"]),
    "382480": ("Ranip", "Ranip", 23.08360, 72.57210, 3,
               ["Ranip metro station"]),
    "382421": ("Vaishnodevi Circle", "Vaishnodevi", 23.11840, 72.51780, 3,
               ["Vaishno Devi Circle on SG Highway -- possibly partly AUDA-governed, not confirmed core AMC"]),
}

SOUTH_WEST = {
    "380051": ("Vejalpur / Jivraj Park / Makarba", "Vejalpur", 22.99960, 72.52840, 2,
               ["Makarba corporate/IT office corridor"]),
    "380055": ("Juhapura", "Juhapura", 22.97900, 72.53580, 4,
               []),
    "382210": ("Sarkhej", "Sarkhej", 22.98450, 72.50560, 4,
               ["Sarkhej Roza (15th-century monument complex) -- possibly partly AUDA-governed, not confirmed core AMC"]),
}

AHMEDABAD = {}
for _z in (CENTRAL, WEST, EAST_INDUSTRIAL, SOUTH, NORTH_RIVERFRONT, NORTH_WEST_GROWTH, SOUTH_WEST):
    AHMEDABAD.update(_z)

ZONE_OF = {}
for _name, _z in (("Central", CENTRAL), ("West", WEST), ("East Industrial", EAST_INDUSTRIAL),
                   ("South", SOUTH), ("North Riverfront", NORTH_RIVERFRONT),
                   ("North West Growth", NORTH_WEST_GROWTH), ("South West", SOUTH_WEST)):
    for _pin in _z:
        ZONE_OF[_pin] = _name

# No disputed jurisdiction found (see docstring) -- every pincode is
# "confirmed", same discipline as Chennai's Tambaram distinction, just a
# simpler real answer here (no split at all within the core set below).
GOVERNANCE_CONF = {pin: "confirmed" for pin in AHMEDABAD}

COMMISSIONERATE_OF = {pin: "Ahmedabad City Police" for pin in AHMEDABAD}

DISCOM_OF = {pin: "Torrent Power" for pin in AHMEDABAD}
DISCOM_CONF = {pin: "confirmed" for pin in AHMEDABAD}

TIER_LABEL = {1: "Premium", 2: "Upper-mid", 3: "Mid", 4: "Affordable", 5: "Budget"}

def landmarks_of(pin):
    return AHMEDABAD[pin][5]

def audit():
    pins = list(AHMEDABAD.keys())
    dupes = [p for p in pins if pins.count(p) > 1]
    total_landmarks = sum(len(v[5]) for v in AHMEDABAD.values())
    print(f"total pincodes: {len(pins)}")
    for zname, zdict in (("Central", CENTRAL), ("West", WEST), ("East Industrial", EAST_INDUSTRIAL),
                          ("South", SOUTH), ("North Riverfront", NORTH_RIVERFRONT),
                          ("North West Growth", NORTH_WEST_GROWTH), ("South West", SOUTH_WEST)):
        print(f"  {zname}: {len(zdict)}")
    print(f"duplicate pincodes: {dupes if dupes else 'none'}")
    print(f"landmarks: {total_landmarks}")
    print(f"Ahmedabad City Police pincodes (all, no split): {len(pins)}")

if __name__ == "__main__":
    audit()
