#!/usr/bin/env python3
"""
scripts/hyderabad_outskirts_areas.py

Pincode reference table for Hyderabad's outskirts towns, just outside
GHMC/the old metro footprint covered by scripts/hyderabad_areas.py's 41
pincodes: Shamshabad (Rajiv Gandhi International Airport) and Medchal
(Medchal-Malkajgiri district HQ town). Same "outskirts people actually
mean when they say the city name" gap already closed for Chandigarh
Tricity, Mumbai outskirts and Bangalore outskirts earlier in this
project, repeated here per the user's instruction to do this for every
covered city.

UNLIKE MUMBAI/BANGALORE: lib/aslivastu/cityAliases.js's Hyderabad entry
(['hyderabad', 'secunderabad', 'cyberabad']) made NO promise about these
two towns before this file -- a clean additive gap.

JURISDICTION, A GENUINELY RECENT AND LIVE WRINKLE: Telangana reorganised
its Hyderabad-area police commissionerates on 29 December 2025, carving
a brand-new Future City Police Commissionerate out of Cyberabad,
Rachakonda and the Rangareddy District Police (English Wikipedia's
"Future City Police Commissionerate" page; siasat.com's "Greater
Hyderabad: Check what areas come under which Commissionerate" explicitly
lists Shamshabad as moving FROM Cyberabad TO Future City). The Future
City page's own police-station list places "Shamshabad Rural Police
Station" under its Moinabad ACP Division -- two independent sources
agree, so this is tagged VERIFIED, not inferred, unlike most of this
project's other outskirts police calls. One nuance not fully resolved:
a separate GHMC-restructuring thread (NewsMeter, via X) names
"Shamshabad Airport" itself (the terminal/key installation) as one of
several named facilities kept under the Hyderabad City Commissionerate
-- read as the airport's own secured campus being carved out from the
surrounding mandal's ordinary jurisdiction, not a contradiction, but not
independently confirmed against a primary government order this pass.

Rachakonda was separately renamed Malkajgiri Police Commissionerate in
the same reorganisation (covering Keesara, Shamirpet, Quthbullapur,
Kompally per the same NewsMeter thread). Medchal mandal sits in the
Keesara revenue division, immediately adjacent to Kompally, which makes
Malkajgiri Commissionerate the natural inference -- but no source found
this pass names Medchal specifically under any of the four new
commissionerates, so this is tagged INFERRED, flagged lower-confidence
than Shamshabad's.

GOVERNANCE, A SECOND LIVE WRINKLE: a new Malkajgiri Municipal
Corporation was created 11 February 2026 by reorganising GHMC under the
Core Urban Region (Integrated Governance) Act, 2026 (English Wikipedia),
covering ~727 km2 of eastern/southern Hyderabad across three zones
(Malkajgiri, Uppal, L.B. Nagar). Medchal itself has had its OWN Medchal
Municipality since 2013 (merger of the Medchal and Athvelly Gram
Panchayats), inside HMDA, per Medchal's own Wikipedia page -- but the
Medchal-Malkajgiri district page (also Wikipedia) does not name Medchal
among the new corporation's listed circles/wards, and the new
corporation's own page does not mention Medchal either. Whether Medchal
Municipality was absorbed into the new Malkajgiri Municipal Corporation
in this very recent (Feb 2026) reorg, or stays a separate municipal
body, is genuinely unresolved from any source checked this pass --
carried here as governance_confidence="disputed", not guessed at.

Shamshabad's own governance is cleaner: it was a Gram Panchayat that
became its own municipality (The Hans India, Jan 2020), covering
Shamshabad village plus Gollapally, Ootpally, Tondapally, Kothwalguda
and Satamrai. Not GHMC, not HMDA-only -- its own municipal body, same
shape as Bangalore outskirts' Town Municipal Councils.

SOURCING
- Pincodes/coordinates: Wikipedia infoboxes for Shamshabad (501218;
  17.2603N 78.3969E) and Medchal (501401; 17.6297N 78.4814E), each
  cross-checked against a second independent pincode directory
  (icbse.com / indiatvnews.com for both).
- Jurisdiction (municipal): Shamshabad's own Wikipedia page + The Hans
  India's Jan 2020 reporting on its Gram-Panchayat-to-municipality
  transition; Medchal's own Wikipedia page for its 2013 municipality
  formation, with the Feb 2026 Malkajgiri Municipal Corporation
  ambiguity disclosed above rather than resolved.
- Jurisdiction (district): Shamshabad is Ranga Reddy district
  (Rajendranagar revenue division, Shamshabad mandal); Medchal is
  Medchal-Malkajgiri district (Keesara revenue division, Medchal
  mandal, formed 30 Nov 2016 by carving Medchal-Malkajgiri out of
  Rangareddy) -- both per their own Wikipedia pages.
- Police: see the jurisdiction section above -- Shamshabad VERIFIED
  (two independent sources), Medchal INFERRED (adjacency reasoning
  only, no source names it directly).
- Power: TSSPDCL (Telangana Southern Power Distribution Co., now also
  trading as TGSPDCL) -- English Wikipedia's company page lists both
  Rangareddy and Medchal among the 15 districts it serves, so this is
  the SAME confirmed sole discom already used for all 41 existing
  Hyderabad pincodes, not a separately invented utility for either town.
- Water: Shamshabad -- The Hans India's Jan 2020 ground report:
  borewell-dependent, weekly refill of an overhead tank, a brief Krishna
  pilot supply that was stopped, no Mission Bhagiratha confirmed. This
  is a 2020 source, not reconfirmed this pass, so tagged INFERRED
  (dated) rather than verified-current. Medchal -- a genuinely current
  finding: NT News / Namasthe Telangana reported on 12 October 2026 (two
  weeks before this pass) that drinking water supply across Medchal-
  Malkajgiri district's mandals, Medchal included, had dropped to once
  every 4 days (heading toward once a week), groundwater-dependent,
  borewells not recharging amid a ~30% rainfall deficit against normal
  -- tagged VERIFIED given the direct, dated, named-mandal reporting.
- Schools: see SCHOOL_NAMES in build_hyderabad_outskirts.py. Both
  schools listed cleared a second independent source (Delhi Public
  School Aerocity: official site address + an independent Click.in
  directory listing, both naming the Shamshabad/RGIA Road address;
  Sanskar Innovative School: official site's address + CBSE affiliation
  number 3630208, independently corroborated by Sulekha/Justdial/
  Careers360/ICBSE all listing the same Medchal/Railway Colony,
  501401 address). A "Malla Reddy School, Medchal" candidate was found
  on the school's own site but could not clear a second independent
  source distinct from the many unrelated Malla Reddy Group colleges
  in Medchal -- excluded rather than guessed at.
- AQI: real IDW interpolation against scripts/cpcb_stations.py's own
  13-station HYDERABAD_STATIONS list (same method already used for
  Chandigarh/Mumbai outskirts/Bangalore outskirts) -- genuinely coarse
  for both points since the network's 13 stations sit inside or near
  the old GHMC footprint, disclosed in build_hyderabad_outskirts.py.
- Metro: a real check against scripts/metro_stations.py's own
  53-station Hyderabad Metro registry (same registry, same 1.5-2km
  radius method already used elsewhere) -- both pincodes are well
  outside the three operational lines, confirmed 0 within 2km.

STAMP DUTY: no Telangana-specific intra-state split found this pass
(unlike Maharashtra's real Mumbai-outskirts Metro-cess surcharge) --
Telangana's stamp duty/registration structure reads as applying the
same statewide rates regardless of GHMC-vs-outskirts location in every
source checked. No lib/compare/derive.js change made for this tranche.

NOT YET COVERED (deliberately out of scope this pass, not silently
dropped): any OTHER pincode within Shamshabad mandal or Medchal mandal
beyond the single town-centre pincode each got this pass (both mandals
have multiple gram panchayats / villages under the same or neighbouring
pincodes); a firmer, government-order-sourced resolution of Medchal's
police commissionerate and its municipal-corporation status; and the
Shamshabad-Airport-vs-Shamshabad-mandal jurisdiction nuance flagged
above.
"""

V, I = "verified", "inferred"

# pincode -> (display name, area label, lat, lon, price tier, [(locality label, confidence)])
# price_tier: 1 Premium .. 5 Value, qualitative placement -- same
# disclaimer as every other outskirts tranche's own price_tier.

HYDERABAD_OUTSKIRTS = {
    "501218": ("Shamshabad", "South Hyderabad (Rajiv Gandhi International Airport)", 17.2603, 78.3969, 3, [
        ("Shamshabad", V),
    ]),
    "501401": ("Medchal", "North Hyderabad (Medchal-Malkajgiri district HQ)", 17.6297, 78.4814, 3, [
        ("Medchal", V),
    ]),
}

# pincode -> municipal corporation / planning authority
MUNI_OF = {
    "501218": "Shamshabad Municipality (Ranga Reddy district, within Rajendranagar revenue division)",
    "501401": "Medchal Municipality (Medchal-Malkajgiri district, within HMDA) -- governance_confidence=disputed, see module docstring on the Feb 2026 Malkajgiri Municipal Corporation reorg",
}

GOVERNANCE_CONF = {
    "501218": V,
    "501401": "disputed",
}

# pincode -> (police authority, confidence)
POLICE_OF = {
    "501218": ("Future City Police Commissionerate -- Shamshabad Rural Police Station, Moinabad ACP Division (reorganised 29 Dec 2025, out of Cyberabad/Rachakonda/Rangareddy District Police)", V),
    "501401": ("Malkajgiri Police Commissionerate (renamed from Rachakonda, 29 Dec 2025 reorg) -- inferred from Medchal mandal's adjacency to Kompally/Keesara, not independently named in any source this pass", I),
}

# pincode -> (water authority / source note, confidence)
WATER_OF = {
    "501218": ("Borewell-dependent, weekly tanker refill of overhead tanks; a brief Krishna-water pilot supply was stopped; no Mission Bhagiratha coverage confirmed (The Hans India, Jan 2020 -- dated, not reconfirmed this pass)", I),
    "501401": ("Groundwater/borewell-dependent; municipal + GHMC tanker supply down to once every 4 days as of Oct 2026 amid a ~30% rainfall deficit, heading toward once a week (NT News / Namasthe Telangana, 12 Oct 2026)", V),
}

DISCOM = "TSSPDCL (Telangana Southern Power Distribution Co.)"  # same confirmed sole discom as all 41 existing Hyderabad pincodes

ALL_AREAS = dict(HYDERABAD_OUTSKIRTS)


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
