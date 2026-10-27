#!/usr/bin/env python3
"""
scripts/mumbai_outskirts_areas.py

Pincode reference tables for the Mumbai Metropolitan Region (MMR) towns
just outside Greater Mumbai/BMC limits: Navi Mumbai (Vashi/Nerul), the
Mira-Bhayandar twin city, Kalyan-Dombivli, Thane's own core, and Panvel.
This is the Mumbai equivalent of the Chandigarh Tricity expansion done
earlier in this project -- the same "outskirts people actually mean when
they say the city name" gap, repeated for every covered city per the
user's instruction.

WHY THIS EXISTS AS ITS OWN FILE, NOT MERGED INTO mumbai_areas.py
lib/aslivastu/cityAliases.js ALREADY lists 'navi mumbai' and 'thane' as
aliases that resolve free-text search to the "Mumbai" city key, with ZERO
pincode data behind that claim before this file -- build_mumbai.py's own
94/96-pincode table (scripts/mumbai_areas.py) covers only Greater Mumbai/
BMC wards, pincodes 400001-400104. Every area below is its OWN municipal
corporation (Navi Mumbai Municipal Corporation, Mira-Bhayandar Municipal
Corporation, Kalyan-Dombivli Municipal Corporation, Thane Municipal
Corporation, Panvel Municipal Corporation), not BMC/MCGM -- genuinely
different governments, same shape of problem the Chandigarh Tricity
expansion solved for Mohali/Panchkula sharing the "Chandigarh" key. Kept
separate so that distinction stays visible in the source rather than
silently merging five different municipal corporations' data into one
table.

UNLIKE CHANDIGARH: every area here is still Maharashtra, so there is no
multi-STATE stamp-duty problem (unlike Mohali/Panchkula's genuinely
different Punjab/Haryana rates). There IS a genuine intra-state split
worth flagging: Mumbai and Navi Mumbai pay 6% stamp duty (male buyer) +
1% registration, but Thane, Kalyan-Dombivli, Mira-Bhayandar, Panvel and
Vasai-Virar all carry an extra 1% Metro-cess surcharge, i.e. 7% + 1% --
confirmed independently via two sources (see build_mumbai_outskirts.py's
own docstring). lib/compare/derive.js's single `Mumbai` key cannot
represent that split without a larger change to dutyFor()'s own by-city
lookup, so it is flagged there as a comment only, same "disclosed, not
silently applied" philosophy as every other derive.js entry.

SOURCING (each cross-checked against Wikipedia's own infobox for that
place, the strongest single source used throughout this pass; a second
source is named where Wikipedia didn't carry the fact)
- Pincodes/coordinates: Wikipedia infoboxes for Vashi, Nerul, Mira Road,
  Bhayandar, Mira-Bhayandar, Kalyan, Dombivli, Thane and Panvel, fetched
  directly this pass (not a secondary aggregator).
- Jurisdiction (municipal corporation): Wikipedia pages for each
  corporation (NMMC/CIDCO, MBMC, KDMC, TMC, Panvel Municipal Corporation).
  MBMC is confirmed administrator-run since 27 Aug 2022 (elected term
  ended, OBC-reservation litigation delayed re-election) -- flagged the
  same way Chandigarh's UT governance quirks were flagged.
- Police: Navi Mumbai Police Commissionerate (Zone 1 Vashi / Zone 2
  Panvel, confirmed via the Commissionerate's own history page) covers
  Navi Mumbai and Panvel. Mira-Bhayander Vasai-Virar (MBVV) Police
  Commissionerate (Wikipedia names the commissioner directly) covers
  Mira-Bhayandar. Thane Police Commissionerate covers Thane city outright
  (V). Kalyan-Dombivli's own police status is the one jurisdiction fact
  NOT cleanly confirmed this pass -- a Thane Traffic Police "D.C.P. Zone
  III, Kalyan" page and two ExcelCity police-station listings
  (Dombivli/Thakurli stations under "Kalyan-Dombivali") both point at
  Thane Police Commissionerate rather than a separate Kalyan force, but
  no single source states this in so many words -- tagged INFERRED, not
  verified, same honesty level as Mohali's own un-sourced per-sector
  collector rate.
- Power: MSEDCL (Mahavitaran) state-wide, EXCLUDING Thane's own Shil/
  Mumbra/Kalwa sub-divisions, where Torrent Power holds a distribution
  franchise (confirmed via a Jan 2019 trade-press report) -- not an issue
  for the 3 Thane pincodes below, which are Thane Bazar/Naupada/Vartak
  Nagar, nowhere near that franchise boundary. MSEDCL's real national
  standing: ranked 49th of 54 DISCOMs, score 16.63/100, grade C (up from
  C-minus), in the Ministry of Power's 14th Integrated Rating Report
  (Jan 2026) -- the real anchor for POWER_SCORE below, same "no jitter,
  cited rating" principle build_mumbai.py already uses for BEST/Tata.
- Water: CIDCO/NMMC (Morbe Dam) for Navi Mumbai; KDMC drawing from the
  Ulhas River (confirmed via multiple news reports of KDMC pipeline
  disruptions specifically naming that river) for Kalyan-Dombivli; the
  respective municipal corporations themselves for Mira-Bhayandar, Thane
  and Panvel, without an independently-sourced hours/day figure this pass
  -- flagged, not invented.
- Schools: see SCHOOL_NAMES in build_mumbai_outskirts.py. Cross-checked
  against a second source (official school site, CBSE's own SARAS/OASIS
  affiliation registry, or an independent Wikipedia page) wherever
  possible; anything that did not clear a second source was left out
  rather than included anyway (the same discipline Chandigarh's Tricity
  schools research used after the "why no schools research for schools"
  correction).

RURAL-POCKET CHECK (same concern as Chandigarh's GMADA extension sharing
140306 with ~36 unrelated villages): none of the 14 pincodes below raised
that flag -- Vashi, Nerul, Kalyan, Dombivli, Mira Road, Bhayandar, Thane
Bazar, Naupada, Vartak Nagar and Panvel City/New Panvel are all fully
built-out municipal nodes, not rural fringe.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped -- see Task #12-style follow-up notes in build_mumbai_outskirts.py):
Vasai-Virar (its own Thane-district-vs-Palghar-district boundary needs
resolving per pincode, and no school there cleared independent
verification this pass); Panvel's other three infobox pincodes
(410217/410208/410218 -- two lower-quality aggregators gave CONFLICTING
locality attributions for Kharghar/Kamothe/Kalamboli/Taloja/Ulwe, so none
of those specific locality names are asserted here); Kalyan-Dombivli's
421201/421202 (Wikipedia's Dombivli infobox lists them but doesn't split
them by side/locality, unlike 421203/421204 which have real school
addresses pinning them to Dombivli East); and Thane's own remaining
400603-400605/400607-400615 range.
"""

V, I = "verified", "inferred"

# pincode -> (display name, area label, lat, lon, price tier, [(locality label, confidence)])
# price_tier: 1 Premium .. 5 Value (qualitative placement, same disclaimer
# as mohali_sectors.py -- NOT pinned to a cited Ready Reckoner Rate table
# the way build_mumbai.py's own RRR_SQM_BY_TIER bands are).

NAVI_MUMBAI = {
    "400703": ("Vashi", "Navi Mumbai (CIDCO Node 1)", 19.08, 73.01, 2, [
        ("Vashi", V),
    ]),
    "400706": ("Nerul", "Navi Mumbai (CIDCO Node)", 19.033, 73.020, 2, [
        ("Nerul", V),
    ]),
}

MIRA_BHAYANDAR = {
    "401107": ("Mira Road", "North Mira-Bhayandar", 19.28, 72.86, 3, [
        ("Mira Road", V),
    ]),
    "401101": ("Bhayandar West", "South Mira-Bhayandar", 19.31, 72.85, 3, [
        ("Bhayandar West", V),
    ]),
    # Wikipedia's Bhayandar infobox gives one coordinate for the whole
    # article, not split East vs West -- same treatment as Mohali's
    # interpolated 160059.
    "401105": ("Bhayandar East", "South Mira-Bhayandar", 19.31, 72.85, 3, [
        ("Bhayandar East", I),
    ]),
}

KALYAN_DOMBIVLI = {
    # Kalyan's own Wikipedia infobox gives ONE coordinate for the whole
    # article (19.24, 73.13), not split West/S.O./East -- same
    # single-point-for-multiple-pincodes treatment as Mira-Bhayandar
    # above and Chandigarh's own Tricity work.
    "421301": ("Kalyan West", "West Kalyan", 19.24, 73.13, 4, [
        ("Kalyan West", V),
    ]),
    "421304": ("Kalyan (S.O.)", "Central Kalyan", 19.24, 73.13, 4, [
        ("Kalyan S.O.", I),
    ]),
    "421306": ("Kalyan East", "East Kalyan", 19.24, 73.13, 4, [
        ("Kalyan East", I),
    ]),
    # Dombivli's Wikipedia infobox lists 421201/421202/421203/421204
    # together with one coordinate (19.218433, 73.086718), also not split
    # by pincode. 421203/421204 are included because real, independently-
    # sourced school addresses pin them specifically to "Dombivli East" --
    # 421201/421202 are NOT included here for lack of that same anchor
    # (see module docstring's "not yet covered").
    "421203": ("Dombivli East (MIDC Residential Zone)", "North Dombivli", 19.218433, 73.086718, 4, [
        ("Dombivli East", V),
    ]),
    "421204": ("Dombivli East (Palava)", "East Dombivli / Palava", 19.218433, 73.086718, 4, [
        ("Palava", V),
    ]),
}

THANE_CORE = {
    # Thane's own Wikipedia infobox gives one city-wide coordinate
    # (19.19722, 72.97222) for the whole 400601-15 PIN range -- used here
    # for 400601/400602 since no individually-sourced point was found for
    # either this pass. Vartak Nagar has its OWN sourced article/infobox
    # coordinate, used directly.
    "400601": ("Thane Bazar / Thane Railway Station", "Central Thane", 19.19722, 72.97222, 3, [
        ("Thane Bazar", V),
    ]),
    "400602": ("Naupada / Gokhale Road", "Central Thane", 19.19722, 72.97222, 3, [
        ("Naupada", I),
    ]),
    "400606": ("Vartak Nagar", "West Thane", 19.21, 72.96, 3, [
        ("Vartak Nagar", V),
    ]),
}

PANVEL = {
    "410206": ("Panvel City / New Panvel (Sector 10)", "Panvel", 18.99444, 73.11389, 3, [
        ("Panvel City", V), ("New Panvel Sector 10", V),
    ]),
}

ALL_AREAS = {**NAVI_MUMBAI, **MIRA_BHAYANDAR, **KALYAN_DOMBIVLI, **THANE_CORE, **PANVEL}

# pincode -> municipal corporation / planning authority (for master_by_pin's
# "authority" field)
MUNI_OF = {
    **{p: "Navi Mumbai Municipal Corporation (NMMC) / CIDCO" for p in NAVI_MUMBAI},
    **{p: "Mira-Bhayandar Municipal Corporation (MBMC) -- administrator-run since Aug 2022" for p in MIRA_BHAYANDAR},
    **{p: "Kalyan-Dombivli Municipal Corporation (KDMC)" for p in KALYAN_DOMBIVLI},
    **{p: "Thane Municipal Corporation (TMC)" for p in THANE_CORE},
    **{p: "Panvel Municipal Corporation (PMC) / CIDCO" for p in PANVEL},
}

# pincode -> (police authority, confidence)
POLICE_OF = {
    **{p: ("Navi Mumbai Police Commissionerate, Zone 1 (Vashi)", V) for p in NAVI_MUMBAI},
    **{p: ("Mira Bhayander Vasai Virar (MBVV) Police Commissionerate", V) for p in MIRA_BHAYANDAR},
    **{p: ("Thane Police Commissionerate (Zone III, Kalyan)", I) for p in KALYAN_DOMBIVLI},
    **{p: ("Thane Police Commissionerate", V) for p in THANE_CORE},
    **{p: ("Navi Mumbai Police Commissionerate, Zone 2 (Panvel)", V) for p in PANVEL},
}

# pincode -> water authority / source note
WATER_OF = {
    **{p: "CIDCO / NMMC water supply (Morbe Dam)" for p in NAVI_MUMBAI},
    **{p: "Mira-Bhayandar Municipal Corporation water supply dept." for p in MIRA_BHAYANDAR},
    **{p: "KDMC water supply (Ulhas River)" for p in KALYAN_DOMBIVLI},
    **{p: "Thane Municipal Corporation water supply dept." for p in THANE_CORE},
    **{p: "Panvel Municipal Corporation / CIDCO water supply" for p in PANVEL},
}

# Stamp duty group, for the derive.js comment flag only (NOT applied to
# any numeric value in this script -- see module docstring).
SEVEN_PCT_GROUP = set(MIRA_BHAYANDAR) | set(KALYAN_DOMBIVLI) | set(THANE_CORE) | set(PANVEL)
SIX_PCT_GROUP = set(NAVI_MUMBAI)


def locs_of(entry):
    return [x for x, _ in entry[5]]


def audit():
    """Basic sanity check: no duplicate pincodes across the 5 areas, every
    pincode has a municipal authority, police authority and water note."""
    all_pins = list(ALL_AREAS)
    dupes = [p for p in all_pins if all_pins.count(p) > 1]
    missing_muni = [p for p in all_pins if p not in MUNI_OF]
    missing_police = [p for p in all_pins if p not in POLICE_OF]
    missing_water = [p for p in all_pins if p not in WATER_OF]
    print(f"total pincodes      : {len(all_pins)}")
    print(f"  Navi Mumbai       : {len(NAVI_MUMBAI)}")
    print(f"  Mira-Bhayandar    : {len(MIRA_BHAYANDAR)}")
    print(f"  Kalyan-Dombivli   : {len(KALYAN_DOMBIVLI)}")
    print(f"  Thane core        : {len(THANE_CORE)}")
    print(f"  Panvel            : {len(PANVEL)}")
    print(f"duplicate pincodes  : {dupes or 'none'}")
    print(f"missing authority   : muni={missing_muni or 'none'} police={missing_police or 'none'} water={missing_water or 'none'}")
    print(f"7% stamp-duty group : {len(SEVEN_PCT_GROUP)} pincodes")
    print(f"6% stamp-duty group : {len(SIX_PCT_GROUP)} pincodes")
    ok = not dupes and not missing_muni and not missing_police and not missing_water
    print("\n" + ("AUDIT PASS" if ok else "AUDIT FAIL"))
    return ok


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
