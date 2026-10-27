#!/usr/bin/env python3
"""
scripts/bangalore_outskirts_areas.py

Pincode reference table for Bangalore's outskirts towns, just outside
BBMP (Bruhat Bengaluru Mahanagara Palike) limits: Devanahalli (site of
Kempegowda International Airport), Hoskote, Anekal (Electronic City
extension / Jigani industrial belt), and Nelamangala (NH48 junction).
Same "outskirts people actually mean when they say the city name" gap
already closed for Chandigarh Tricity and the Mumbai outskirts tranche
earlier in this project, repeated here per the user's instruction to do
this for every covered city.

UNLIKE MUMBAI: lib/aslivastu/cityAliases.js's Bangalore entry
(['bangalore', 'bengaluru']) made NO promise about these towns before
this file -- a clean additive gap, not a promise-without-data fix.

JURISDICTION, A GENUINELY RECENT WRINKLE: Karnataka's Cabinet approved
renaming Bangalore Rural district to Bengaluru North district on 2 July
2025 (confirmed via indiatvnews.com and thefederal.com). Devanahalli,
Hoskote and Nelamangala are therefore Bengaluru North district (the
successor to what most sources still call "Bangalore Rural"). Anekal
alone stays Bangalore Urban district. None of the four are BBMP --
each has its OWN municipal body (Town Municipal Council / City
Municipal Council), confirmed per-area below.

SOURCING
- Pincodes/coordinates: Wikipedia infoboxes for Devanahalli, Hoskote,
  Anekal and Nelamangala, cross-checked against indiatvnews.com's
  pincode pages (a second, independent source for every one of the 4).
- Jurisdiction: each town's own Wikipedia infobox (Devanahalli Town
  Municipal Council; Hoskote Town Municipal Council, also confirmed via
  two independent local business-directory listings of the actual TMC
  office address -- sulekha.com and justdial.com; Anekal Town Municipal
  Council; Nelamangala City Municipal Council).
- Police: NOT cleanly confirmed this pass. bangalorerural.nic.in's own
  police pages are ROBOTS_DISALLOWED, not retried. The one specific lead
  found -- a Devanahalli community account on X stating the local police
  station is administratively Bengaluru URBAN City Police despite sitting
  in Bengaluru Rural/North district, the largest station in Bengaluru
  Rural by floor area -- is a single social-media source, tagged
  INFERRED and flagged as low-confidence, not a government citation.
  Hoskote/Nelamangala are tagged as likely Bengaluru (Rural/North)
  District Police, also INFERRED. Anekal shows as "Anekal Rural" in one
  business-directory police-station listing (dwello.in), also INFERRED.
- Power: BESCOM, same DISCOM and same real anchor already used for all
  66 existing Bangalore pincodes (scripts/patch_bangalora_power.py's
  BESCOM_POWER_SCORE = 36, from the Ministry of Power's 14th Integrated
  Rating: grade C-, score 28.94/100, the lowest of any rated utility in
  the country) -- BESCOM's service area is wider than BBMP, covering
  these towns too, so the SAME real anchor is reused here rather than
  inventing a separate one.
- Water: the real, current, and most important finding this pass --
  BWSSB's jurisdiction was formally expanded to cover all of Bengaluru
  Urban district including Anekal taluk (asianetnews.com), but the same
  notification is explicit that newly added areas "will continue to
  depend on groundwater sources for the time being," no Cauvery
  timeline given. A real-estate buyer-checklist source (propnewz.com,
  2026) independently describes Devanahalli's outer pockets as having
  "partial Cauvery coverage and significant borewell-tanker dependency"
  and Anekal among the southern peripheral sub-markets with the worst
  groundwater scarcity, and puts a oft-cited "Cauvery Stage VI" project
  (which would eventually serve Devanahalli/Hoskote/Anekal) at "early
  planning," realistic 2030-2032 if approved without delay -- NOT yet
  approved per this source (a Devanahalli community X account separately
  claims Stage VI was just approved; treated as unconfirmed given the
  conflict, not asserted as fact). Hoskote is the one area with a
  resolved, dated, locally-sourced water story: a Deccan Herald article
  ("Hoskote reuses Bangalore's refuse, ends decades of thirst") describes
  the local body now providing 24/7 treated-groundwater supply from
  borewells recharged by treated sewage diverted into a nearby lake --
  genuinely NOT a Cauvery/BWSSB supply, but also not a current crisis.
  Nelamangala has no area-specific water source found this pass --
  flagged as the weakest-sourced of the four, modelled as
  borewell-dependent by the same general North-Bengaluru pattern as
  Devanahalli, not independently confirmed.
- AQI: real IDW interpolation against scripts/cpcb_stations.py's own
  9-station BANGALORE_STATIONS list (same method already used for
  Chandigarh and reused, not reinvented, here) -- genuinely coarse for
  these 4 points (11.8-25.4km to the nearest real station, since the
  network's own 9 stations sit inside or near BBMP), disclosed in
  build_bangalore_outskirts.py rather than presented as precise.
- Metro: a real check against scripts/metro_stations.py's own 83-station
  Namma Metro registry (same registry, same 1.5-2km radius method
  patch_metro.py already applies to Delhi NCR/Bangalore) confirms 0
  stations within 2km of all 4 pincodes -- the Blue Line extension
  toward Kempegowda International Airport (which would eventually reach
  Devanahalli) was not operational as of this pass.
- Schools: see SCHOOL_NAMES in build_bangalore_outskirts.py. Every
  school listed cleared a second independent source (an official school
  site, CBSE's own SARAS/OASIS affiliation registry, or multiple
  independent aggregator listings agreeing on the same address) -- one
  candidate (a "St. John's School" lead for Anekal with contradictory
  New Delhi vs Bengaluru address data) was found and explicitly excluded
  rather than guessed at.

RURAL-POCKET CHECK (same concern as Chandigarh's GMADA extension and
Mumbai's own check): Devanahalli taluka and Anekal taluk both genuinely
mix a built-up town/industrial core with surrounding agricultural
villages under the SAME pincode -- flagged here, same as the module
docstring flags it, rather than silently claimed as a uniformly urban
pincode. Hoskote and Nelamangala did not raise this flag as sharply in
this pass's research, but are also town-and-surrounding-taluk pincodes,
not purely urban cores -- worth a closer look in a later pass.

STAMP DUTY: Karnataka's guidance-value-based stamp duty (2-5%, slab-based
on property value) reads as uniform statewide in every source checked
this pass -- no BBMP-vs-outside-BBMP or Bengaluru-Urban-vs-North
distinction surfaced, unlike Maharashtra's real Metro-cess split for
Mumbai's outskirts. No derive.js comment added for this tranche; the
existing Bangalore entry (5.0/1.0) applies unchanged, pending a closer
look if a future pass finds otherwise.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped): any OTHER pincode within Devanahalli taluka, Hoskote taluka,
Anekal taluk or Nelamangala taluka beyond the single town-centre pincode
each area got this pass; BIAAPA's own planning-authority role for
Devanahalli specifically (its name surfaced only as a census-data
publisher citation, not confirmed as the active authority); and a firmer,
government-sourced confirmation of all 4 areas' police jurisdiction.
"""

V, I = "verified", "inferred"

# pincode -> (display name, area label, lat, lon, price tier, [(locality label, confidence)])
# price_tier: 1 Premium .. 5 Value, qualitative placement (not pinned to a
# cited guidance-value table this pass -- same disclaimer as every other
# outskirts tranche's own price_tier).

BANGALORE_OUTSKIRTS = {
    "562110": ("Devanahalli", "North Bengaluru (Kempegowda Int'l Airport)", 13.23, 77.70, 2, [
        ("Devanahalli", V),
    ]),
    "562114": ("Hoskote", "East Bengaluru (NH75 corridor)", 13.07, 77.80, 3, [
        ("Hoskote", V),
    ]),
    "562106": ("Anekal", "South Bengaluru (Electronic City extension / Jigani)", 12.70, 77.70, 3, [
        ("Anekal", V),
    ]),
    "562123": ("Nelamangala", "Northwest Bengaluru (NH48 junction)", 13.102, 77.374, 3, [
        ("Nelamangala", V),
    ]),
}

# pincode -> municipal corporation / planning authority
MUNI_OF = {
    "562110": "Devanahalli Town Municipal Council (Bengaluru North district)",
    "562114": "Hoskote Town Municipal Council (Bengaluru North district)",
    "562106": "Anekal Town Municipal Council (Bangalore Urban district)",
    "562123": "Nelamangala City Municipal Council (Bengaluru North district)",
}

# pincode -> (police authority, confidence) -- all INFERRED, see module docstring
POLICE_OF = {
    "562110": ("Bengaluru City Police (Devanahalli PS) -- administratively Bengaluru Urban despite sitting in Bengaluru North district", I),
    "562114": ("Bengaluru (Rural/North) District Police", I),
    "562106": ("Bengaluru (Rural-styled) District Police -- \"Anekal Rural\" per one directory listing", I),
    "562123": ("Bengaluru (Rural/North) District Police", I),
}

# pincode -> (water authority / source note, confidence)
WATER_OF = {
    "562110": ("Partial Cauvery (BWSSB Stage V) coverage, significant borewell/tanker dependency outside the covered pockets; Cauvery Stage VI (would serve this area) in early planning, not yet operational", I),
    "562114": ("Hoskote Town Municipal Council -- 24/7 treated-groundwater supply from local borewells (sewage-recharged lake scheme), not Cauvery/BWSSB", I),
    "562106": ("BWSSB (jurisdiction formally expanded to cover Anekal taluk) but actual supply still groundwater-dependent, no Cauvery timeline given", V),
    "562123": ("Nelamangala City Municipal Council -- no area-specific water source confirmed this pass, modelled as borewell-dependent", I),
}

DISCOM = "BESCOM"  # same DISCOM, same real anchor as all 66 existing Bangalore pincodes

ALL_AREAS = dict(BANGALORE_OUTSKIRTS)


def locs_of(entry):
    return [x for x, _ in entry[5]]


def audit():
    all_pins = list(ALL_AREAS)
    dupes = [p for p in all_pins if all_pins.count(p) > 1]
    missing_muni = [p for p in all_pins if p not in MUNI_OF]
    missing_police = [p for p in all_pins if p not in POLICE_OF]
    missing_water = [p for p in all_pins if p not in WATER_OF]
    print(f"total pincodes      : {len(all_pins)}")
    print(f"duplicate pincodes  : {dupes or 'none'}")
    print(f"missing authority   : muni={missing_muni or 'none'} police={missing_police or 'none'} water={missing_water or 'none'}")
    ok = not dupes and not missing_muni and not missing_police and not missing_water
    print("\n" + ("AUDIT PASS" if ok else "AUDIT FAIL"))
    return ok


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
