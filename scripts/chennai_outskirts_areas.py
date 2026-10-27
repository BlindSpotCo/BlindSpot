#!/usr/bin/env python3
"""
scripts/chennai_outskirts_areas.py

Pincode reference table for Sriperumbudur, a major automotive/
electronics industrial hub just outside Chennai's existing covered
footprint. Found the same way Howrah was this pass (Task #11's re-check
of Delhi NCR/Chennai/Kolkata/Pune for remaining outskirts gaps): tested
resolveCoveredCity() against real nearby-town names and confirmed
Sriperumbudur had no pincode and no alias, unlike Chennai's own
Tambaram belt (Tambaram/Chromepet/Pallavaram/Pallikaranai), which this
project had already closed in an earlier pass -- a genuine remaining
gap, not a re-discovery of already-covered ground.

UNLIKE CHENNAI'S OWN TAMBARAM BELT: Sriperumbudur isn't a Chennai-
adjacent municipal split or a disputed police boundary -- it's a
separate town in a DIFFERENT district (Kanchipuram, not Chennai
district), ~40km from Chennai's core, that real-estate interest treats
as part of the Chennai metro story anyway because of its sheer
industrial weight: Hyundai (since 1999), and by 2008 a Special Economic
Zone with over US$2 billion invested (Wikipedia), on the Chennai-
Bangalore highway with proximity to Chennai port cited as a key
advantage. lib/aslivastu/cityAliases.js's Chennai entry
(['chennai', 'madras']) made no promise about it before this file.

SOURCING
- Pincode/coordinates: Wikipedia's own Sriperumbudur infobox (602105;
  12.9667N 79.9450E, from 12 58'00"N 79 56'42"E), cross-checked against
  a second independent source (indiatvnews.com's pincode page).
- Jurisdiction (municipal): Wikipedia's own infobox lists it as a
  Municipality, while the page's cited references separately describe
  it as a town panchayat -- genuine terminology inconsistency across
  sources, disclosed rather than resolved by picking one. District:
  Kanchipuram. Taluk: Sriperumbudur taluk (confirmed via its own
  Wikipedia page, headquartered at Sriperumbudur town).
- Police: Sriperumbudur Police Station, under Kancheepuram District
  Police (confirmed via a mappls.com listing giving the exact station
  name, district and pincode match) -- NOT Greater Chennai Police,
  since Sriperumbudur sits well outside Chennai district -- tagged
  VERIFIED.
- Power: TANGEDCO -- the SAME confirmed, sole, state-wide utility
  scripts/chennai_areas.py already uses for all 34 existing Chennai
  pincodes (its own docstring: "TANGEDCO is the single, confirmed
  state-wide utility for all of [Tamil Nadu]"). No separate licensee
  the way Mumbai's Metro-cess split or GIFT City's own power company
  required elsewhere this project -- genuinely simpler here.
- Water: TWAD Board (Tamil Nadu Water Supply and Drainage Board), the
  standard state authority for areas outside a major city corporation's
  own water utility -- confirmed as a real, active state board
  (twadboard.tn.gov.in), but no Sriperumbudur-specific capacity/
  reliability report found this pass -- tagged INFERRED (general state
  authority, not an area-specific confirmation).
- Schools: see SCHOOL_NAMES in build_chennai_outskirts.py. Ryan
  International School, Sriperumbudur cleared a second independent
  source (the school's own Facebook page and official group listing,
  cross-checked against Justdial, icbse.com and edustoke.com all
  agreeing on the ETA Globevill/Mambakkam Village/602106 address) --
  that pincode is itself one off from this file's 602105 anchor (a
  genuinely close, same-town-cluster pincode, not a mismatch), disclosed
  via distance_km rather than claimed as exactly on-pincode. A
  "Srimathi Sundaravalli Memorial School" candidate was found and
  excluded: its own Wikipedia page places it in Perungalathur, Chennai,
  roughly 20km+ from Sriperumbudur by its own listed coordinates --
  too far to call "near," not guessed into inclusion.
- AQI: real IDW interpolation against scripts/cpcb_stations.py's own
  CHENNAI_STATIONS list, same method used throughout this project --
  genuinely coarse for Sriperumbudur since the existing 8-station
  network sits inside Chennai proper, disclosed via nearest-station
  distance on the master_by_pin row.
- Metro: a real check against scripts/metro_stations.py's own
  CHENNAI_STATIONS Metro registry -- confirmed 0 within 2km (Chennai
  Metro's western reach does not extend anywhere near Sriperumbudur).

STAMP DUTY: no Tamil Nadu Chennai-vs-Kanchipuram intra-state split
found this pass -- Tamil Nadu's guideline-value stamp duty reads as
statewide in every source checked. No lib/compare/derive.js change made
for this tranche.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped): any other pincode within Sriperumbudur taluk beyond this
single town-centre pincode (the taluk includes a large SIPCOT
industrial-park footprint and several adjoining villages under their
own, neighbouring pincodes); and a firmer, government-sourced
resolution of the municipality-vs-town-panchayat terminology
inconsistency found in Sriperumbudur's own Wikipedia sourcing.
"""

V, I = "verified", "inferred"

CHENNAI_OUTSKIRTS = {
    "602105": ("Sriperumbudur", "West Chennai industrial corridor (Kanchipuram district, SIPCOT auto/electronics hub)", 12.9667, 79.9450, 3, [
        ("Sriperumbudur", V),
    ]),
}

MUNI_OF = {
    "602105": "Sriperumbudur Municipality (also described as a town panchayat in some sources, see docstring) -- Kanchipuram district, Sriperumbudur taluk",
}

GOVERNANCE_CONF = {
    "602105": "disputed",  # municipality vs. town panchayat terminology inconsistency across sources, see docstring
}

POLICE_OF = {
    "602105": ("Sriperumbudur Police Station, Kancheepuram District Police -- not Greater Chennai Police", V),
}

WATER_OF = {
    "602105": ("TWAD Board (Tamil Nadu Water Supply and Drainage Board) -- standard state authority for the area, no Sriperumbudur-specific capacity/reliability report found this pass", I),
}

DISCOM = "TANGEDCO (Tamil Nadu Generation and Distribution Corporation)"  # same confirmed sole state-wide utility as all 34 existing Chennai pincodes

ALL_AREAS = dict(CHENNAI_OUTSKIRTS)


def locs_of(entry):
    return [x for x, _ in entry[5]]


def audit():
    all_pins = list(ALL_AREAS)
    dupes = [p for p in all_pins if all_pins.count(p) > 1]
    missing_muni = [p for p in all_pins if p not in MUNI_OF]
    missing_police = [p for p in all_pins if p not in POLICE_OF]
    missing_water = [p for p in all_pins if p not in WATER_OF]
    missing_gov = [p for p in all_pins if p not in GOVERNANCE_CONF]
    print(f"total pincodes      : {len(all_pins)}")
    print(f"duplicate pincodes  : {dupes or 'none'}")
    print(f"missing authority   : muni={missing_muni or 'none'} police={missing_police or 'none'} water={missing_water or 'none'} governance={missing_gov or 'none'}")
    ok = not dupes and not missing_muni and not missing_police and not missing_water and not missing_gov
    print("\n" + ("AUDIT PASS" if ok else "AUDIT FAIL"))
    return ok


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
