#!/usr/bin/env python3
"""
scripts/ahmedabad_outskirts_areas.py

Pincode reference table for Gandhinagar, Gujarat's state capital, just
outside the AMC/AUDA footprint covered by scripts/ahmedabad_areas.py's
39 Ahmedabad pincodes. Same "outskirts people actually mean when they
say the city name" gap already closed for Chandigarh Tricity, Mumbai
outskirts, Bangalore outskirts and Hyderabad outskirts earlier in this
project, repeated here per the user's instruction to do this for every
covered city.

UNLIKE EVERY OTHER TRANCHE SO FAR: Gandhinagar is not a satellite town
or industrial belt of Ahmedabad -- it is its OWN city, Gujarat's
capital, with its own district, municipal corporation and (per its own
very recent reorganisation) its own police commissioner's office. It
sits ~25km from Ahmedabad's core, connected by the Ahmedabad-Gandhinagar
corridor and (per this project's own existing cityAliases.js pattern
elsewhere) reasonably counted as part of the same metro region for a
real-estate buyer's purposes, the same way Navi Mumbai/Thane are grouped
under "Mumbai" rather than kept as a wholly separate city key.

lib/aslivastu/cityAliases.js's Ahmedabad entry (['ahmedabad', 'amdavad'])
made NO promise about Gandhinagar before this file -- a clean additive
gap.

TWO PINCODES, DELIBERATELY DIFFERENT IN CHARACTER:
1. Gandhinagar proper (382010) -- the planned sector-grid capital city
   itself, governed by Gandhinagar Municipal Corporation.
2. GIFT City (382050) -- Gujarat International Finance Tec-City, a
   purpose-built financial SEZ+DTA development between Ahmedabad and
   Gandhinagar, with its OWN governing company and its OWN power and
   water utilities, distinct from both AMC/Torrent-retail and GMC. Real
   estate interest in GIFT City (as a workplace-adjacent residential
   market) is high enough, and its administration different enough
   from Gandhinagar proper, to warrant its own entry rather than being
   folded into Gandhinagar's.

SOURCING
- Gandhinagar (382010): Wikipedia's own infobox (23.223N 72.65E; the
  article's own population figures disagree between infobox 292,167
  and body text 208,299, both 2011 census -- disclosed, not resolved).
  District: Gandhinagar district (Gandhinagar is simultaneously the
  district HQ, the state capital, and its own municipal corporation).
- GIFT City (382050): a genuinely messy pincode trail -- older
  real-estate/directory sources (indiatvnews.com, prokerala.com,
  icbse.com, w3badi.com) still show 382355 (served via the nearby
  Dabhoda post office, per Dabhoda's own Wikipedia page: "near to the
  under-construction GIFT City"), but SIX independently-run current
  pincode-lookup sites (pincodedata.com, aipincodes.in, infin8bytes.com,
  mypincode.co.in, pincode.nears.me, pin.codes.in) all now show a
  dedicated "Gift City S.O." post office at 382050, and a listed
  company's own investor-relations PDF ("PIN Code Change Intimation",
  shareindia.com -- not independently readable this pass, robots-
  disallowed) corroborates that GIFT City's own address changed
  pincode. Treated as 382355 -> 382050 (superseded, not a conflict to
  resolve by picking one source over another). English Wikipedia's own
  GIFT City infobox shows yet a THIRD figure, 382426 -- not corroborated
  by any other source found this pass, treated as a likely Wikipedia
  infobox error rather than a third real code.
- Jurisdiction (municipal): Gandhinagar Municipal Corporation, formed
  16 March 2010 following a 2009 Gujarat High Court ruling (Wikipedia),
  326 sq km, 33 wards. GIFT City is NOT under GMC -- it is governed by
  Gujarat International Finance Tec-City Company Ltd (GIFTCL, itself
  working through Gujarat Urban Development Company Ltd), split into a
  GIFT IFSC zone and a GIFT DTA (Domestic Tariff Area) zone, with GIFT
  SEZ Ltd as the SEZ developer (English Wikipedia's GIFT City page).
- Police: Gandhinagar -- the state's Feb 2020 budget announced a
  dedicated Police Commissioner's office for Gandhinagar (deshgujarat.
  com, 26 Feb 2020), distinct from the district SP who continues
  covering rural areas; a separate, more recent finding (Gujarat
  Samachar) has Ahmedabad City Police's own jurisdiction expanded into
  PARTS of Gandhinagar's rural areas, a different and seemingly
  overlapping expansion not reconciled against the Gandhinagar
  Commissioner's own boundary in any source checked this pass -- both
  tagged INFERRED, not independently dated/confirmed as currently
  operational. GIFT City specifically -- Dabhoda Police Station
  currently covers it (deshgujarat.com, 18 Nov 2021: the Gandhinagar
  district police asked the state home department for a DEDICATED
  GIFT City police station, headed by a PI, covering the surrounding
  institutional zone too; the article says approval was "likely... in
  the upcoming budget next year" but no source found this pass
  confirms it was actually approved or opened) -- tagged VERIFIED for
  Dabhoda PS as the CURRENT jurisdiction, since that is what the most
  recent dated source actually confirms, not the proposed replacement.
- Power: BOTH areas are served by Torrent Power, but via two distinct
  real mechanisms, not guessed as uniform. Gandhinagar proper: Torrent
  Power's own official site names its license area "Ahmedabad -
  Gandhinagar License Area" (torrentpower.com) -- the SAME licensee
  already used for all 39 existing Ahmedabad pincodes, confirmed
  directly from the company's own page, not assumed from Ahmedabad's
  proximity. GIFT City: a SEPARATE, real, GERC-regulated distribution
  licensee, GIFT Power Company Limited (GIFT PCL) -- confirmed via a
  real Gujarat Electricity Regulatory Commission tariff order for GIFT
  PCL -- not Torrent Power retail and not UGVCL, a genuinely distinct
  finding from every other outskirts tranche in this project, where the
  area in question shares its host city's existing utility.
- Water: Gandhinagar -- a genuinely current and positive finding,
  unlike most other outskirts tranches: deshgujarat.com (14 Nov 2025,
  12 months-ish before this pass) reports Gandhinagar switched to
  round-the-clock (24x7) water supply from 15 Nov 2025, replacing a
  long-standing 2-hour morning supply, citywide at a stated 65 MLD,
  with meter-based billing replacing flat-rate billing after a 2-month
  trial. The article names specific sectors with new grievance numbers
  (14-18, 21-29, GIDC 28/29) but does not explicitly confirm Sector 10
  (this pincode's nominal sector) by name, so tagged VERIFIED for the
  city-wide claim, not pincode-exact. GIFT City: before 2010-era GMC
  takeover context doesn't apply here (GIFT City isn't under GMC) --
  GIFTCL's own subsidiary, Gift Water Infrastructure Limited, handles
  water/drainage/sewage within the SEZ+DTA per Wikipedia's GIFT City
  page (Phase I scope only, no current quality/reliability report found
  this pass) -- tagged INFERRED, self-managed infrastructure, not
  independently verified.
- Schools: see SCHOOL_NAMES in build_ahmedabad_outskirts.py. Kendriya
  Vidyalaya No 1, Gandhinagar (Sector 30, 382030) cleared a second
  independent source (the official gandhinagar.nic.in public-utility
  listing, cross-checked against cbseschool.org) -- note this is ~3km
  from this pincode's own Sector 10 area, not literally inside 382010,
  disclosed via distance_km rather than claimed as on-pincode. Jamnabai
  Narsee School, GIFT City cleared a second source (its own official
  site's address, cross-checked against its own English Wikipedia page
  and multiple independent directory listings) and sits inside 382050
  itself (distance_km near 0).
- AQI: real IDW interpolation against scripts/cpcb_stations.py's own
  5-station AHMEDABAD_STATIONS list (same method used throughout this
  project) -- genuinely coarse for both points (Gandhinagar and GIFT
  City both sit 15-20km+ from the nearest of the 5 real stations, all
  of which are inside AMC), disclosed via nearest-station distance on
  each master_by_pin row.
- Metro: a real check against scripts/metro_stations.py's own
  43-station Ahmedabad Metro registry -- confirmed 0 stations within
  2km of either pincode. A real, cited Ahmedabad Metro Phase 2 planned
  extension toward GIFT City/Gandhinagar exists (per GIFT City's own
  Wikipedia page) but was not operational as of this pass, so it is
  carried as `planned=1` on both pincodes, not as a confirmed station.

STAMP DUTY: no Gujarat-specific Ahmedabad-vs-Gandhinagar intra-state
split found this pass (unlike Maharashtra's real Mumbai-outskirts
Metro-cess surcharge) -- Gujarat's stamp duty/registration structure
reads as applying the same statewide rates regardless of location in
every source checked. No lib/compare/derive.js change made for this
tranche.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped): any OTHER Gandhinagar sector pincode beyond 382010 (the city
spans roughly 382006-382030+, each sector cluster carrying its own
code); a firmer, government-order-sourced confirmation of whether
Gandhinagar's own Police Commissioner's office is actually operational
yet, and its exact boundary against both the district SP and
Ahmedabad City Police's recently-expanded rural jurisdiction; and
whether the proposed dedicated GIFT City police station was ever
approved/opened after the Nov 2021 proposal.
"""

V, I = "verified", "inferred"

# pincode -> (display name, area label, lat, lon, price tier, [(locality label, confidence)])
# price_tier: 1 Premium .. 5 Value, qualitative placement -- same
# disclaimer as every other outskirts tranche's own price_tier.

AHMEDABAD_OUTSKIRTS = {
    "382010": ("Gandhinagar", "Gujarat state capital (Gandhinagar Municipal Corporation)", 23.223, 72.65, 2, [
        ("Gandhinagar", V),
    ]),
    "382050": ("GIFT City", "Gujarat International Finance Tec-City (SEZ + DTA financial district)", 23.16546, 72.67974, 1, [
        ("GIFT City", V),
    ]),
}

# pincode -> municipal corporation / governing body
MUNI_OF = {
    "382010": "Gandhinagar Municipal Corporation (Gandhinagar district)",
    "382050": "Gujarat International Finance Tec-City Company Ltd (GIFTCL, via Gujarat Urban Development Company Ltd) -- NOT Gandhinagar Municipal Corporation",
}

GOVERNANCE_CONF = {
    "382010": V,
    "382050": V,
}

# pincode -> (police authority, confidence)
POLICE_OF = {
    "382010": ("Gandhinagar Police Commissionerate (announced in the state's Feb 2020 budget; not independently confirmed as operational, see module docstring) -- Ahmedabad City Police separately expanded into parts of Gandhinagar's rural areas, not reconciled against this boundary", I),
    "382050": ("Dabhoda Police Station (current jurisdiction as of Nov 2021 reporting); a dedicated GIFT City police station was proposed the same year but no source confirms it has since opened", V),
}

# pincode -> (water authority / source note, confidence)
WATER_OF = {
    "382010": ("Gandhinagar Municipal Corporation / Water Supply Board -- switched to 24x7 water supply citywide from 15 Nov 2025 (65 MLD, meter-based billing), replacing a 2-hour morning supply; not pincode-exact for Sector 10", V),
    "382050": ("Gift Water Infrastructure Limited (a GIFTCL subsidiary) -- self-managed water/drainage/sewage infrastructure within the SEZ+DTA, no independent quality/reliability report found this pass", I),
}

DISCOM = "Torrent Power"  # Gandhinagar proper only -- GIFT City has its own licensee, see DISCOM_OF

DISCOM_OF = {
    "382010": "Torrent Power",  # confirmed via torrentpower.com's own "Ahmedabad - Gandhinagar License Area"
    "382050": "GIFT Power Company Limited (GIFT PCL)",  # distinct, GERC-regulated, SEZ-specific licensee -- not Torrent Power retail
}

ALL_AREAS = dict(AHMEDABAD_OUTSKIRTS)


def locs_of(entry):
    return [x for x, _ in entry[5]]


def audit():
    all_pins = list(ALL_AREAS)
    dupes = [p for p in all_pins if all_pins.count(p) > 1]
    missing_muni = [p for p in all_pins if p not in MUNI_OF]
    missing_police = [p for p in all_pins if p not in POLICE_OF]
    missing_water = [p for p in all_pins if p not in WATER_OF]
    missing_gov = [p for p in all_pins if p not in GOVERNANCE_CONF]
    missing_discom = [p for p in all_pins if p not in DISCOM_OF]
    print(f"total pincodes      : {len(all_pins)}")
    print(f"duplicate pincodes  : {dupes or 'none'}")
    print(f"missing authority   : muni={missing_muni or 'none'} police={missing_police or 'none'} water={missing_water or 'none'} governance={missing_gov or 'none'} discom={missing_discom or 'none'}")
    ok = not dupes and not missing_muni and not missing_police and not missing_water and not missing_gov and not missing_discom
    print("\n" + ("AUDIT PASS" if ok else "AUDIT FAIL"))
    return ok


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
