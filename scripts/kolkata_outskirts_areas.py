#!/usr/bin/env python3
"""
scripts/kolkata_outskirts_areas.py

Pincode reference table for Howrah, Kolkata's twin city across the
Hooghly, closing a gap found during Task #11's re-check of Delhi NCR/
Chennai/Kolkata/Pune for remaining outskirts gaps (not a gap the user
named directly, unlike every other tranche this pass -- found by
testing resolveCoveredCity() against a list of real nearby-city names
and noticing Howrah was the one genuine miss: no pincode, no alias,
nothing).

WHY THIS IS DIFFERENT FROM EVERY OTHER "OUTSKIRTS" TRANCHE THIS PASS:
Howrah is not a satellite town of Kolkata the way Devanahalli is of
Bangalore or Shamshabad is of Hyderabad -- it is the second most
populous city in West Bengal in its own right (Wikipedia: 1,077,075 in
the city proper, 2011 census), with its OWN municipal corporation,
OWN district, and (since 2011) its OWN separate police commissionerate.
It is grouped here the same way this project already groups Navi
Mumbai/Thane under "Mumbai" or Gandhinagar under "Ahmedabad": a
real-estate buyer searching "Kolkata" very plausibly means the whole
twin-city conurbation, and Howrah's own pincode series (711xxx) was
entirely unrepresented in COVERED_PREFIXES before this file, so a
geocoded Howrah result could not even surface as "covered" via the
postcode-prefix fallback the way Chennai's Tambaram belt or Kolkata's
own Salt Lake/New Town areas already can.

lib/aslivastu/cityAliases.js's Kolkata entry (['kolkata', 'calcutta'])
made NO promise about Howrah before this file -- a clean additive gap,
same shape as every other tranche.

SOURCING
- Pincode/coordinates: Howrah's own Wikipedia infobox lists PIN codes
  711101-711114, 711201-711204, 711302 and 711409, with 711101 (the
  head post office) as the natural single anchor for this pass, same
  "one town-centre pincode" scope as every other outskirts area added
  this project. Coordinates 22.58000N, 88.32944E, also from the
  infobox.
- Jurisdiction (municipal): Howrah Municipal Corporation -- genuinely
  notable, its last elected board ended December 2018 and it has been
  run by state-appointed administrators since, with the mayor's post
  vacant (Wikipedia's own infobox). Bally Municipality was re-merged
  into it in 2015 (66 wards total). Howrah district HQ; planning
  authority is KMDA (Kolkata Metropolitan Development Authority),
  since Howrah sits inside the Kolkata Metropolitan Area -- the same
  planning authority already cited for Kolkata proper.
- Police: Howrah City Police / Howrah Police Commissionerate, formed
  2011 by splitting out of the old Howrah Police District, 18 police
  stations, administratively separate from Kolkata Police (its own
  Wikipedia page confirms the 2011 formation and station count but
  does not explicitly describe its relationship to Kolkata Police
  beyond both being under West Bengal Police) -- tagged VERIFIED.
- Power: CESC -- NOT a newly-researched fact this pass. The EXISTING
  scripts/kolkata_areas.py module docstring already states "CESC's own
  license area spans 'Kolkata, Howrah and...'" (written during this
  project's earlier Kolkata work, before Howrah itself was ever added
  as a pincode) -- reused directly here rather than re-derived, same
  real licensee and the same POWER_SCORE_BY_DISCOM=78 anchor
  build_kolkata.py already uses for CESC-served Kolkata pincodes.
- Water: Howrah Municipal Corporation's own water supply -- Wikipedia
  notes the municipality began supplying filtered water citywide in
  1896, but gives no description of the CURRENT system's capacity or
  reliability. No current-state source found this pass -- tagged
  INFERRED (a real, confirmed authority, but an unconfirmed current
  service level), not asserted as either a crisis or a success story
  the way some other tranches' water findings were.
- Schools: see SCHOOL_NAMES in build_kolkata_outskirts.py. Delhi Public
  School, Howrah cleared a strong multi-source bar (its own official
  site's CBSE Mandatory Disclosures page naming affiliation #2430186
  and school code #15596, cross-checked against icbse.com,
  cbseschool.org and edubilla.com all agreeing on the Domjur/Howrah-
  Amta Road/711405 address) -- but that address is itself ~10km from
  this pincode's own 711101 core, disclosed via distance_km rather than
  claimed as on-pincode. A "Howrah Modern School" candidate at 711114
  was found and explicitly excluded: its own government-records listing
  states it is "Sanctioned but not Operational."
- AQI: real IDW interpolation against scripts/cpcb_stations.py's own
  KOLKATA_STATIONS list, same method used throughout this project --
  genuinely coarse for Howrah since the existing station list was
  built around Kolkata proper, disclosed via nearest-station distance
  on the master_by_pin row.
- Metro: a real check against scripts/metro_stations.py's own
  KOLKATA_STATIONS Metro registry -- the Kolkata Metro's Howrah
  Maidan/Esplanade (Purple Line / Green Line extension under the
  Hooghly) does reach INTO Howrah, but confirmed 0 stations within 2km
  of 711101 specifically (the city's historic core, not the riverside
  terminus end).

STAMP DUTY: no West Bengal Kolkata-vs-Howrah intra-state split found
this pass -- West Bengal's stamp duty/registration structure reads as
statewide in every source checked. No lib/compare/derive.js change
made for this tranche.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped): any other Howrah pincode beyond 711101 (the city spans
711101-711114, 711201-711204, 711302, 711409); Bally's own distinct
character post-2015-remerger; and a firmer, government-sourced
description of Howrah's CURRENT (not 1896-era) water supply system.
"""

V, I = "verified", "inferred"

HOWRAH_OUTSKIRTS = {
    "711101": ("Howrah", "Howrah city core (twin city across the Hooghly)", 22.58000, 88.32944, 3, [
        ("Howrah", V),
    ]),
}

MUNI_OF = {
    "711101": "Howrah Municipal Corporation (run by state-appointed administrators since Dec 2018, mayor's post vacant) -- Howrah district, KMDA planning authority",
}

GOVERNANCE_CONF = {
    "711101": V,
}

POLICE_OF = {
    "711101": ("Howrah City Police / Howrah Police Commissionerate (formed 2011, 18 police stations) -- administratively separate from Kolkata Police", V),
}

WATER_OF = {
    "711101": ("Howrah Municipal Corporation -- has supplied filtered water citywide since 1896; no current-state capacity/reliability source found this pass", I),
}

DISCOM = "CESC"  # same real licensee already disclosed for Howrah in scripts/kolkata_areas.py's own docstring

ALL_AREAS = dict(HOWRAH_OUTSKIRTS)


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
