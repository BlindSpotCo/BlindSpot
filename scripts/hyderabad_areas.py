#!/usr/bin/env python3
"""
scripts/hyderabad_areas.py

The Hyderabad metro pincode reference table — "whole metro, old
boundaries" scope confirmed with Gurshaan: pre-trifurcation GHMC +
Cyberabad Corporation + Malkajgiri Corporation footprint as one coverage
area, including the full western IT corridor (Gachibowli, HITEC City,
Madhapur, Kondapur). Telangana's Feb 2026 GHMC trifurcation into three
corporations is a real, current administrative change, but BlindSpot
treats the metro as one coverage area the way people who live and work
here actually think about the city, not by the brand-new corporation
lines.

WHY THIS FILE EXISTS (same reasoning as mumbai_areas.py)
41 verified pincodes across 6 zones -- large enough that hand-authoring
every dimension per-pincode risks the exact Bangalore defect (copy-paste
constants) this project has already caught and fixed twice. Zone-baseline
model instead, same as Mumbai: each dimension keyed to a real cited fact
per zone, SPECIAL_CASE overrides for pincodes with their own documented
fact, deterministic per-pincode jitter on top.

HONEST COVERAGE GAP -- READ BEFORE EXTENDING THIS FILE
This is a verified-but-partial pincode list, not exhaustive metro
coverage. No single public source merges Hyderabad district + Rangareddy
+ Medchal-Malkajgiri postal data in one place; each pincode below was
independently confirmed against 2+ postal directories (india post-derived
sites: pincode.net.in, onefivenine.com, finkode.com, dwello.in,
aurumproptech.in, prokerala.com, codepin.in, nobroker.in, mapsofindia.com
-- specific sources noted per zone below). Known gaps: several real,
well-known localities (parts of the outer Cyberabad ring, further
Rangareddy expansion areas) don't have an independently-verified pincode
in this pass and are deliberately left out rather than guessed. Extend
this file with the same standard: 2+ independent postal-directory sources
per pincode, or don't add it yet.

SECUNDERABAD CANTONMENT BOARD (SCB) -- GENUINELY UNRESOLVED, DO NOT GUESS
SCB reports to the Union Ministry of Defence (Directorate General of
Defence Estates), legally separate from GHMC -- confirmed
(en.wikipedia.org/wiki/Secunderabad_Cantonment_Board;
dgde.gov.in/cantonments/web/396). But which pincode(s) it actually
governs is disputed across sources: Wikipedia's Tirumalagiri page names
500015; codepin.in names 500094; a third directory (pincodedata.com)
labels 500094 "Sainikpuri" and 500015 "Trimulgherry", neither tagged SCB
at all. Cantonment boundaries were drawn militarily, not along postal
lines, so SCB's real footprint likely straddles PARTS of several
pincodes rather than sitting cleanly inside one. This is the direct
Hyderabad analogue of the Delhi Cantonment/NDMC mistake already made
once in this dataset -- so every pincode in CANTONMENT_AMBIGUOUS below
carries governance_confidence="disputed" rather than a confident single
label, and any crime/administrative field sourced to "GHMC" for those
pins should be read with that caveat.

CRIME JURISDICTION -- ALSO FLAGGED, SEE build_hyderabad.py
Four real police commissionerates as of the 29-Dec-2025 reorganisation
(Hyderabad City / Cyberabad / Malkajgiri / Future City). Whether NCRB's
published citywide "Hyderabad" crime figure covers Hyderabad City
Commissionerate only or the whole four-commissionerate metro could not be
confirmed from any primary NCRB methodology document found this session
-- flagged, not resolved, same honesty standard as Chandigarh/Mumbai's
crime figures (modelled relative ranking, not a claimed absolute count).

STRUCTURE
pincode -> (display_name, area_label, lat, lon, price_tier, [landmarks])

price_tier: 1 Premium .. 5 Value, from Telangana Registration & Stamps
Dept (IGRS) real "market value" figures, post the 5-6 June 2026 statewide
revision (sources gave both dates -- worth reconciling against the actual
IGRS notification before this goes further; treated as the same event
here). Telangana calls it "market value", not "circle rate" -- see
build_hyderabad.py for the sq-yard (land) / sq-ft (flats) unit split,
the same trap Chandigarh's collector rate carried.
"""

# ── Old City (GHMC core, south of the Musi river) ───────────────────────
# Confirmed via pincode.net.in / mapsofindia.com / onefivenine.com.
# Lower price tier; The Federal ("Hyderabad floods: Old City, IT hubs
# inundated as Musi River overflows") independently confirms this belt's
# real, recurring monsoon flood exposure.
OLD_CITY = {
    "500002": ("Charminar", "Old City", 17.3616, 78.4747, 5,
               ["Charminar", "Laad Bazaar", "Mecca Masjid"]),
    "500053": ("Falaknuma", "Old City", 17.3400, 78.4740, 5,
               ["Falaknuma Palace"]),
    "500023": ("Yakutpura", "Old City", 17.3540, 78.4830, 5,
               []),
    "500064": ("Bahadurpura", "Old City", 17.3480, 78.4560, 5,
               ["Nehru Zoological Park"]),
    "500065": ("Fatehdarwaza", "Old City", 17.3650, 78.4880, 5,
               []),
    "500058": ("Kanchanbagh", "Old City", 17.3280, 78.4900, 5,
               ["DRDL"]),
    "500059": ("Saidabad", "Old City", 17.3450, 78.5010, 4,
               []),
    "500012": ("Begum Bazar", "Old City", 17.3800, 78.4780, 4,
               ["Begum Bazar wholesale market"]),
    "500006": ("Karwan", "Old City", 17.3700, 78.4600, 4,
               ["Karwan Sahu"]),
}

# ── Central Hyderabad (Banjara Hills / Jubilee Hills belt) ──────────────
# Confirmed via allindiapincode.net / mapsofindia.com / onefivenine.com.
# Mature premium belt -- munsifdaily.com's June 2026 coverage of the
# market-value revision notes these established residential colonies saw
# only a capped ~25% increase or none at all this cycle, the steepest
# jumps were in the IT corridor instead. Ameerpet (Sanjeevaiah/500038) is
# a genuine Red/Blue line metro interchange -- real, not modelled.
CENTRAL = {
    "500034": ("Banjara Hills", "Central", 17.4156, 78.4347, 1,
               ["Road No. 12", "KBR Park"]),
    "500033": ("Jubilee Hills", "Central", 17.4310, 78.4073, 1,
               ["Jubilee Hills Check Post", "Film Nagar Cultural Centre"]),
    "500082": ("Somajiguda", "Central", 17.4210, 78.4570, 2,
               ["Somajiguda Circle"]),
    # Schools data-collection pass note: every school found searching
    # "Ameerpet" resolved to postal pincode 500016, a neighbouring
    # pincode, not 500038 -- so no real per-school data is attributed to
    # 500038 specifically (see SCHOOLS_REAL in build_hyderabad.py, which
    # leaves this pincode on the modelled fallback rather than borrowing
    # 500016's real numbers). The metro interchange itself is a real,
    # physical Ameerpet-area landmark regardless of the postal-code line.
    "500038": ("Ameerpet / Sanjeevaiah Nagar", "Central", 17.4374, 78.4482, 2,
               ["Ameerpet metro interchange (Red + Blue Line)"]),
    "500004": ("Khairatabad", "Central", 17.4090, 78.4610, 2,
               ["Birla Mandir vicinity"]),
    "500028": ("Humayunnagar", "Central", 17.3980, 78.4520, 3,
               []),
    # Schools data-collection pass note: the one school found searching
    # "Film Nagar" (Bharatiya Vidya Bhavan's Public School) resolved to
    # postal pincode 500033 (shared with Jubilee Hills), not 500096 -- so
    # no real per-school data is attributed to 500096 specifically (see
    # SCHOOLS_REAL in build_hyderabad.py). Left on the modelled fallback
    # rather than guessed.
    "500096": ("Film Nagar", "Central", 17.4050, 78.4180, 1,
               ["Film Nagar"]),
    "500073": ("Srinagar Colony", "Central", 17.4290, 78.4460, 2,
               []),
}

# ── Western IT Corridor / Cyberabad ──────────────────────────────────────
# Confirmed via allindiapincode.net's dedicated IT-hub list / nobroker.in /
# pincode.net.in. Steepest real price growth of any zone (klmprojects.in,
# munsifdaily.com June 2026: e.g. Raidurgam govt. rate ₹26,700 -> ₹48,300
# per sq yd). Real, honest metro gap: Blue Line runs Raidurg <-> Nagole,
# so HITEC City/Madhapur/Kondapur ARE metro-served but Gachibowli itself,
# Financial District, Manikonda, Nanakramguda, Bachupally and Manchirevula
# are NOT -- the line terminates at Raidurg. Air quality: Telangana Today
# (citing Greenpeace) names Kokapet in the worst PM2.5/PM10 tier
# city-wide, most likely construction-dust-driven given the active
# development boom -- Kokapet has no independently-confirmed pincode of
# its own in this pass, so the flag is applied to its immediate
# geographic neighbours (Manikonda, Nanakramguda, Manchirevula) rather
# than invented for a pincode that isn't verified. Water: youngindia
# housing.com's reporting on west-Hyderabad tanker dependency (Kokapet /
# Narsingi not yet on piped HMWSSB supply, HMWSSB targeting full coverage
# only 2028-2030) is applied the same way, same neighbours.
CYBERABAD_IT = {
    # Manikonda / Nanakramguda / Manchirevula (500089 / 500008 / 500106)
    # are Kokapet's real, immediate geographic neighbours -- the air/water
    # special-case flags applied to them in build_hyderabad.py belong to
    # THIS comment, not to a fake "landmark" string; none of the three
    # carry an invented placeholder landmark below.
    "500032": ("Gachibowli / Financial District", "Cyberabad", 17.4400, 78.3489, 1,
               ["Financial District"]),  # not yet on the Blue Line -- nearest station is Raidurg
    "500081": ("HITEC City / Madhapur / Raidurg", "Cyberabad", 17.4483, 78.3915, 1,
               ["HITEC City", "Raidurg metro (Blue Line)", "Madhapur metro (Blue Line)"]),
    "500084": ("Kondapur / Kothaguda", "Cyberabad", 17.4615, 78.3626, 1,
               []),
    "500089": ("Manikonda", "Cyberabad", 17.4030, 78.3720, 2,
               []),
    "500072": ("Kukatpally", "Cyberabad", 17.4849, 78.4108, 2,
               ["Kukatpally metro (Red Line)", "KPHB"]),
    "500008": ("Nanakramguda", "Cyberabad", 17.4180, 78.3410, 1,
               []),
    # Corrected from an initially-sourced 500118 to 500090 during the
    # schools data-collection pass: multiple independent school-directory
    # listings (Sulekha, iCBSE.com) consistently give Bachupally's postal
    # pincode as 500090, not 500118 -- a real error caught and fixed
    # before shipping, not left in.
    "500090": ("Bachupally", "Cyberabad", 17.5210, 78.3600, 3,
               []),
    "500106": ("Manchirevula", "Cyberabad", 17.3750, 78.3550, 2,
               []),
    "500049": ("Miyapur", "Cyberabad", 17.4970, 78.3520, 2,
               ["Miyapur metro (Red Line terminus)"]),
}

# ── Secunderabad / Cantonment belt ──────────────────────────────────────
# Confirmed via finkode.com / dwello.in / mapsofindia.com. See module
# docstring -- governance is genuinely disputed for this whole belt, not
# just one pincode, so governance_confidence="disputed" applies to all of
# it rather than singling out a guessed SCB pincode.
CANTONMENT_AMBIGUOUS = {
    "500003": ("Secunderabad", "Cantonment belt", 17.4399, 78.4983, 2,
               ["Secunderabad Railway Station", "JBS metro (Green Line)"]),
    "500011": ("Bowenpally", "Cantonment belt", 17.4640, 78.4740, 3,
               []),
    "500017": ("Lallaguda", "Cantonment belt", 17.4470, 78.5040, 3,
               []),
    "500061": ("Sitaphalmandi", "Cantonment belt", 17.4270, 78.5040, 3,
               []),
    "500015": ("Trimulgherry", "Cantonment belt", 17.4720, 78.5000, 3,
               []),  # one of the disputed candidate SCB pincodes per Wikipedia's Tirumalagiri page -- see module docstring, not a real landmark
    "500047": ("Anandbagh", "Cantonment belt", 17.4750, 78.5150, 4,
               []),
}

# ── Eastern Hyderabad / Malkajgiri belt ──────────────────────────────────
# Confirmed via dwello.in / aurumproptech.in / prokerala.com / sulekha.com.
# LB Nagar is the real Red Line terminus, Uppal the real Blue Line
# terminus -- both major, genuine interchange/terminal stations, not
# modelled.
MALKAJGIRI_EAST = {
    "500056": ("Neredmet", "Malkajgiri belt", 17.4820, 78.5390, 3,
               []),
    "500094": ("Sainikpuri", "Malkajgiri belt", 17.4900, 78.5570, 3,
               []),  # pincodedata.com's own listing; disputed against SCB by codepin.in -- see module docstring, not a real landmark
    "500040": ("Moulali", "Malkajgiri belt", 17.4560, 78.5460, 3,
               []),
    "500044": ("Nallakunta", "Malkajgiri belt", 17.4050, 78.4960, 3,
               []),
    "500074": ("LB Nagar", "Malkajgiri belt", 17.3450, 78.5530, 3,
               ["LB Nagar metro (Red Line terminus)"]),
    "500039": ("Uppal", "Malkajgiri belt", 17.4000, 78.5590, 3,
               ["Uppal metro (Blue Line terminus)"]),
    "500062": ("ECIL", "Malkajgiri belt", 17.4670, 78.5670, 3,
               []),
}

# ── North Hyderabad ───────────────────────────────────────────────────────
# Confirmed via nobroker.in / codepin.in / indiapincodes.net (Kompally,
# Medchal-Malkajgiri district) and aurumproptech.in / dwello.in / finkode.com
# (Alwal). Alwal and Bolarum share one postal pincode (500010) rather than
# being two separate delivery areas -- both names kept as aliases instead
# of picking one arbitrarily.
NORTH = {
    "500100": ("Kompally", "North Hyderabad", 17.5460, 78.4890, 3,
               []),
    "500010": ("Alwal / Bolarum", "North Hyderabad", 17.5010, 78.5060, 4,
               []),
}

HYDERABAD = {**OLD_CITY, **CENTRAL, **CYBERABAD_IT, **CANTONMENT_AMBIGUOUS,
             **MALKAJGIRI_EAST, **NORTH}

ZONE_OF = {}
for _pin in OLD_CITY: ZONE_OF[_pin] = "Old City"
for _pin in CENTRAL: ZONE_OF[_pin] = "Central Hyderabad"
for _pin in CYBERABAD_IT: ZONE_OF[_pin] = "Cyberabad IT Corridor"
for _pin in CANTONMENT_AMBIGUOUS: ZONE_OF[_pin] = "Secunderabad/Cantonment"
for _pin in MALKAJGIRI_EAST: ZONE_OF[_pin] = "Malkajgiri/Eastern"
for _pin in NORTH: ZONE_OF[_pin] = "North Hyderabad"

# Governance confidence -- 'confirmed' everywhere except the cantonment
# belt, where SCB vs GHMC jurisdiction is genuinely disputed (see docstring).
GOVERNANCE_CONF = {}
for _pin in HYDERABAD:
    GOVERNANCE_CONF[_pin] = "disputed" if _pin in CANTONMENT_AMBIGUOUS else "confirmed"

# Crime commissionerate -- four real 2026 commissionerates. Applied at
# zone level per Siasat's area breakdown and Wikipedia's per-commissionerate
# pages; NOT claimed as the source of any specific crime count (see
# build_hyderabad.py and the module docstring's NCRB flag).
COMMISSIONERATE_OF = {
    "Old City": "Hyderabad City",
    "Central Hyderabad": "Hyderabad City",
    "Cyberabad IT Corridor": "Cyberabad",
    "Secunderabad/Cantonment": "Hyderabad City",  # Secunderabad proper; SCB areas disputed, see docstring
    "Malkajgiri/Eastern": "Malkajgiri",
    "North Hyderabad": "Malkajgiri",  # Medchal-Malkajgiri district
}

# TSSPDCL (Telangana Southern Power Distribution Co.) is the confirmed
# SOLE discom for the entire old-metro footprint -- Wikipedia + official
# tgsouthernpower.org. Unlike Mumbai, there is no real area-based split to
# model, so every pincode gets the same value at "confirmed" confidence.
DISCOM_OF = {pin: "TSSPDCL (Telangana Southern Power Distribution Co.)" for pin in HYDERABAD}
DISCOM_CONF = {pin: "confirmed" for pin in HYDERABAD}

TIER_LABEL = {1: "Premium", 2: "Upper", 3: "Mid", 4: "Modest", 5: "Value"}


def landmarks_of(pin):
    return HYDERABAD[pin][5]


def audit():
    zones = {}
    for pin in HYDERABAD:
        zones.setdefault(ZONE_OF[pin], []).append(pin)
    print(f"total pincodes: {len(HYDERABAD)}")
    for z, pins in zones.items():
        print(f"  {z}: {len(pins)}")
    dupes = [p for p in HYDERABAD if list(HYDERABAD.keys()).count(p) > 1]
    print("duplicate pincodes:", dupes or "none")
    n_land = sum(len(landmarks_of(p)) for p in HYDERABAD)
    print(f"landmarks: {n_land}")
    disputed = [p for p, c in GOVERNANCE_CONF.items() if c == "disputed"]
    print(f"governance-disputed pincodes ({len(disputed)}):", disputed)
    return not dupes


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
