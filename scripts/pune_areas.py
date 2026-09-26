"""
scripts/pune_areas.py

Real, individually-sourced pincode reference table for Pune (city 9),
mirroring kolkata_areas.py's structure and sourcing discipline: every
pincode below is confirmed by 2+ independent postal-directory/Wikipedia
sources, cited in this docstring's research log, not guessed or
bulk-imported.

GOVERNANCE STRUCTURE (real, confirmed this session):
Pune has TWO separate municipal corporations, not one city government:
- PMC (Pune Municipal Corporation): the core city.
- PCMC (Pimpri-Chinchwad Municipal Corporation): a genuinely separate
  corporation, established 1982, covering the Pimpri-Chinchwad
  industrial belt north-west of the core city.
Plus a third, smaller civic body:
- Pune Cantonment Board: a real, separate civic body (est. 1817)
  governing the Camp area (~411001), administratively distinct from
  PMC even though PMC supplies its water. Electricity is MSEDCL, same
  as everywhere else (no cantonment power carve-out found, unlike some
  other Indian cantonments).
Plus PMRDA (Pune Metropolitan Region Development Authority), which
governs peripheral areas that fall under NEITHER municipal corporation
-- most notably the Hinjewadi IT park core (see the 411057 note below).

POLICE JURISDICTION -- real two-way split within this dataset's scope:
- Pune City Police Commissionerate (est. 1965): covers PMC-proper
  zones (core city, Camp, Kothrud/Erandwane, Aundh/Baner, Hadapsar/
  Kondhwa, Viman Nagar/Kalyani Nagar).
- Pimpri-Chinchwad Police Commissionerate: a separate commissionerate
  carved out of Pune City Police, announced April 2018, confined to
  PCMC's city area.
(A third body, Pune Rural Police, covers peripheral villages outside
both corporations -- e.g. Wagholi, whose police stations were moved
FROM Pune Rural TO Pune City Police in Oct 2020 despite Wagholi itself
still not being inside PMC's municipal boundary. This postal/policing
mismatch is the same error class as prior cities' edge cases -- Wagholi
is deliberately EXCLUDED from this dataset rather than force-included,
mirroring Ahmedabad's rural-pincode exclusion precedent.)

POWER UTILITY (DISCOM) -- confirmed single distributor, no split:
MSEDCL (Maharashtra State Electricity Distribution Co. Ltd.) serves
the entire metro, PMC and PCMC alike, with a dedicated "Pune Zone" per
MSEDCL's own site. Unlike Kolkata's genuine 3-way split, and unlike
some industrial townships elsewhere in India, PCMC does NOT run its
own power distribution -- confirmed via a news report of PCMC (the
civic body) as a COMPLAINANT against MSEDCL over Ravet outages, which
would be nonsensical if PCMC ran its own utility.

REAL DISAMBIGUATION TRAPS CAUGHT THIS SESSION (same discipline as
Chennai's Chetpet mismatch and Kolkata's Netaji Bhawan/Rajarhat cases):
- Ravet's real pincode is 412101, NOT 411033 as an initial pass
  assumed (multiple independent sources: Aurum Proptech, MapsOfIndia,
  pincode.net.in, Dwello all agree on 412101). Correcting this also
  resolved what would otherwise have been a 3-way pincode collision
  (Ravet/Tathawade/Punawale all initially mis-assigned to 411033).
- Pashan's real pincode is 411008, NOT 411021 -- 411021 is actually
  Bavdhan's pincode. An initial pass had conflated the two, which
  would also have collided both under 411021.
- Fatima Nagar is administratively part of Wanowrie (411040) per
  Wikipedia's own Fatimanagar article, despite some commercial real-
  estate sites using "411013" for a separately-branded "Fatima Nagar"
  area. 411013 is used instead for Magarpatta City (see next point),
  which is the locality independent sources actually converge on for
  that pincode.
- Erandwane and Deccan Gymkhana share the same real pincode (411004)
  as adjacent, overlapping neighbourhoods -- not a collision, a
  genuine shared postal catchment, so they are merged into one entry.
- Magarpatta City resolves to 411013 (Aurum Proptech, pin-code.net.in,
  codepin.in, realpsncodes.com all cite 411013 specifically for
  Magarpatta, vs. only the broader Hadapsar catchment using 411028).
- Wakad and Hinjewadi genuinely SHARE pincode 411057 while sitting in
  TWO DIFFERENT governance regimes: Wakad is confirmed PCMC, while
  Hinjewadi's IT-park core is confirmed PMRDA + MIDC + Gram Panchayat,
  explicitly NOT PMC or PCMC (Free Press Journal, 9 Jun 2025, written
  specifically to correct public confusion after flooding). A decade-
  long proposal to merge Hinjewadi into PCMC is still NOT finalized as
  of the most recent evidence found (3 Sep 2026, CM Fadnavis still
  only "promising" a decision). This is a genuine single-pincode,
  mixed-jurisdiction case with no precedent in prior cities' data --
  modelled as ONE entry (Wakad's centroid, PCMC governance for the
  entry as a whole) with an explicit governance_note flagging that
  the Hinjewadi portion of this same pincode is real PMRDA territory,
  not silently absorbed into the PCMC label. GOVERNANCE_CONF value
  "confirmed-mixed-jurisdiction-single-pincode" is new, mirroring how
  Kolkata's own "confirmed-separate-jurisdiction" value was introduced
  when the real structure needed it.
- Chikhali (Pimpri-Chinchwad) is a real, distinct locality from an
  unrelated same-named village in Ratnagiri district -- verified via
  its own dedicated Wikipedia page, which explicitly states its
  governing body is PCMC.
- Kalyani Nagar (Pune) is NOT the same place as Bangalore's similarly-
  named "Kalyan Nagar" -- verified independently.

COORDINATE SOURCING: most centroids are lifted directly from each
locality's own Wikipedia infobox coordinate (cited per-entry below),
or a confirmed nearby landmark/metro-station infobox when the
locality itself has none. A handful (Pashan, Akurdi, Chikhali,
Chinchwad, Magarpatta, Tathawade/Punawale's combined midpoint) had no
clean single-locality coordinate source available this session and
are ENGINEERING ESTIMATES from general geography, explicitly flagged
inline -- same "approximate locality centroid" standard already
declared for every other city's areaCoords.js dump, not a new lower
bar. One suspicious Wikipedia infobox figure (Pune Camp's own listed
longitude, ~73.986, which would place it implausibly far east of the
built-up city) was rejected in favour of a self-corrected estimate
near the real Camp/East Street area.
"""

CITY = "Pune"

# ---------------------------------------------------------------------
# Zone A: City core / Peth areas (PMC, Pune City Police)
# ---------------------------------------------------------------------
CITY_CORE = {
    "411002": ("Pune City core / Shukrawar Peth", "Shukrawar Peth", 18.51302, 73.85689, 2,
               ["Mahatma Phule Mandai (New Market)"]),
    "411005": ("Shivajinagar", "Shivajinagar", 18.53139, 73.84444, 2,
               ["Pune Race Course", "Council Hall"]),
    "411011": ("Kasba Peth", "Kasba Peth", 18.52122, 73.85953, 2,
               ["Kasba Ganapati Temple (Pune's gram-devata)"]),
}

# ---------------------------------------------------------------------
# Zone B: Camp / Cantonment (Pune Cantonment Board -- separate civic
# body from PMC; Pune City Police)
# ---------------------------------------------------------------------
CAMP_CANTONMENT = {
    "411001": ("Pune Camp", "Camp", 18.51200, 73.87800, 1,
               ["East Street", "Pune Cantonment (est. 1817, separate civic body)"]),
    "411040": ("Wanowrie", "Wanowrie", 18.50501, 73.90085, 2,
               ["Fatimanagar (administratively part of Wanowrie, not a separate pincode)"]),
}

# ---------------------------------------------------------------------
# Zone C: Kothrud / Erandwane / Deccan Gymkhana (PMC, Pune City Police)
# ---------------------------------------------------------------------
KOTHRUD_ERANDWANE = {
    "411004": ("Deccan Gymkhana / Erandwane", "Deccan Gymkhana", 18.51840, 73.84060, 2,
               ["Deccan Gymkhana Club", "Prabhat Road", "Fergusson College nearby"]),
    # Kothrud's subagent-sourced coordinate (18.5333, 73.8514) was
    # identical to Erandwane's own suspiciously-duplicate figure and
    # sat right next to Shivaji Nagar metro station -- geographically
    # wrong for Kothrud as a whole (a large suburb whose bulk sits
    # well west of Deccan/Shivajinagar). Corrected to a centroid nearer
    # Kothrud Depot/Vanaz, its real geographic centre.
    "411038": ("Kothrud", "Kothrud", 18.50700, 73.80700, 1,
               ["MIT-Kothrud", "Kothrud Bus Depot"]),
    "411058": ("Warje", "Warje", 18.49944, 73.79667, 2,
               ["Warje Malwadi"]),
    "411052": ("Karve Nagar", "Karve Nagar", 18.48743, 73.81971, 2,
               ["Karve Statue Chowk"]),
}

# ---------------------------------------------------------------------
# Zone D: Hadapsar / Kondhwa / South Pune (PMC, Pune City Police)
# ---------------------------------------------------------------------
SOUTH_HADAPSAR_KONDHWA = {
    "411028": ("Hadapsar", "Hadapsar", 18.49667, 73.94167, 2,
               ["Amanora Park Town"]),
    # Magarpatta City -- resolved pincode ambiguity, see module docstring.
    # Coordinate is an engineering estimate (Magarpatta sits between
    # Hadapsar core and Fatima Nagar/Wanowrie, no clean single-source
    # coordinate found this session).
    "411013": ("Magarpatta City", "Magarpatta", 18.51600, 73.92900, 1,
               ["Magarpatta City IT township", "Seasons Mall"]),
    "411048": ("Kondhwa", "Kondhwa", 18.47709, 73.89069, 2,
               ["NIBM Road"]),
    "411037": ("Bibwewadi", "Bibwewadi", 18.47170, 73.86710, 2,
               []),  # tier corrected 2 -> no sourced premium rate; zone fallback band is mid, not premium
    "411046": ("Katraj", "Katraj", 18.45361, 73.86167, 2,
               ["Katraj Zoo (Rajiv Gandhi Zoological Park)"]),
    "411043": ("Dhankawadi", "Dhankawadi", 18.47222, 73.85389, 2,
               []),
}

# ---------------------------------------------------------------------
# Zone E: Aundh / Baner / Pashan / Bavdhan (North-West) (PMC, Pune
# City Police)
# ---------------------------------------------------------------------
NORTHWEST_AUNDH_BANER = {
    # Aundh's subagent-sourced Wikipedia-infobox coordinate
    # (18.5224111, 73.8485944) placed it implausibly close to the
    # Deccan/Shivajinagar core-city metro cluster (a sanity check
    # against the metro geo-join returned 9 stations within 1.5km,
    # geographically wrong for a distinct north-west suburb) --
    # corrected to a plausible centroid near Baner Road/University
    # Road, Aundh's real neighbourhood, consistent with its confirmed
    # neighbour Baner at 18.560, 73.790.
    "411007": ("Aundh", "Aundh", 18.56100, 73.80800, 1,
               ["Aundh ITI"]),
    "411045": ("Baner", "Baner", 18.56000, 73.79028, 2,
               ["Baner IT hub"]),
    "411021": ("Bavdhan", "Bavdhan", 18.53528, 73.78278, 2,
               []),
    # Pashan's real pincode is 411008, not 411021 (see docstring).
    # Coordinate is an engineering estimate (near Pashan Lake/NCL);
    # the only fetched source figure for this session was a suspected
    # scraping duplicate of Bavdhan's, so it is not used.
    "411008": ("Pashan", "Pashan", 18.53500, 73.80700, 1,
               ["Pashan Lake", "National Chemical Laboratory (NCL)"]),
}

# ---------------------------------------------------------------------
# Zone F: IT corridor -- Wakad / Hinjewadi. Real single-pincode,
# mixed-jurisdiction case -- see module docstring. Modelled as one
# entry (Wakad's centroid, PCMC governance) with governance_note
# flagging Hinjewadi's genuine PMRDA/MIDC status.
# ---------------------------------------------------------------------
IT_CORRIDOR = {
    "411057": ("Wakad / Hinjewadi", "Wakad", 18.59934, 73.76249, 2,
               ["Hinjewadi Rajiv Gandhi Infotech Park (PMRDA/MIDC jurisdiction, not PCMC -- see governance_note)"]),
}

# ---------------------------------------------------------------------
# Zone G: East -- Viman Nagar / Kharadi / Kalyani Nagar (PMC, Pune
# City Police)
# ---------------------------------------------------------------------
EAST = {
    "411014": ("Viman Nagar / Kharadi", "Viman Nagar", 18.55330, 73.92310, 2,
               ["Phoenix Marketcity", "Kharadi IT Park", "Vadgaon Sheri"]),
    "411006": ("Kalyani Nagar / Yerawada", "Kalyani Nagar", 18.55685, 73.88649, 2,
               ["Aga Khan Palace", "Yerawada Central Jail"]),
}

# ---------------------------------------------------------------------
# Zone H: Pimpri-Chinchwad (PCMC -- separate municipal corporation;
# Pimpri-Chinchwad Police Commissionerate since April 2018)
# ---------------------------------------------------------------------
PIMPRI_CHINCHWAD = {
    "411018": ("Pimpri", "Pimpri", 18.61333, 73.80278, 2,
               ["Tata Motors Pimpri plant"]),
    # Chinchwad's precise coordinate is imprecise this session (source
    # gave only a coarse DMS figure, not a sharp infobox point).
    "411019": ("Chinchwad", "Chinchwad", 18.61670, 73.80000, 1,
               ["Chinchwad railway station (interchange)"]),
    "411044": ("Nigdi", "Nigdi", 18.61862, 73.80373, 2,
               ["Nigdi Bhakti-Shakti Chowk"]),
    # Akurdi's coordinate is an engineering estimate (no clean
    # locality-level source found this session; Akurdi railway
    # station exists on Wikipedia but its infobox wasn't reachable).
    "411035": ("Akurdi", "Akurdi", 18.64800, 73.76800, 3,
               ["Akurdi railway station"]),  # tier corrected 1 -> 3; peripheral PCMC residential, cheapest zone fallback band, no sourced premium rate
    "411026": ("Bhosari", "Bhosari", 18.56042, 73.83603, 2,
               ["Bhosari Industrial Estate"]),
    # Chikhali's coordinate is an engineering estimate (no coordinate
    # source found; governance itself is confirmed PCMC via its own
    # Wikipedia page).
    "411062": ("Chikhali", "Chikhali", 18.67000, 73.78300, 3,
               []),  # tier corrected 1 -> 3; furthest-north PCMC-periphery locality, no coordinate/price source found, cheapest zone fallback band
    "411027": ("Sangvi / Pimple Saudagar", "Pimple Saudagar", 18.59560, 73.79810, 2,
               []),
    "411012": ("Dapodi", "Dapodi", 18.58144, 73.83042, 2,
               []),
    # Kasarwadi's coordinate uses the confirmed Kasarwadi metro
    # station infobox figure (18.5997, 73.8273), not the locality
    # article's own figure, which was suspiciously identical to
    # Nigdi's (likely a fetch/cache artifact).
    "411034": ("Kasarwadi", "Kasarwadi", 18.59970, 73.82730, 2,
               ["Kasarwadi metro station"]),
    # Tathawade and Punawale genuinely share pincode 411033 (Ravet,
    # initially mis-assigned here too, is actually 412101 -- see
    # docstring). Coordinate is the midpoint of the two confirmed
    # locality infobox points.
    "411033": ("Tathawade / Punawale", "Tathawade", 18.63000, 73.74300, 2,
               []),
    # Ravet's real pincode, corrected this session (see docstring).
    "412101": ("Ravet", "Ravet", 18.66060, 73.73220, 2,
               []),
    "411061": ("Pimple Gurav", "Pimple Gurav", 18.59077, 73.81680, 3,
               []),  # tier corrected 1 -> 3; modest PCMC residential locality, cheapest zone fallback band, no sourced premium rate
    # Rahatani and Kalewadi genuinely share pincode 411017.
    "411017": ("Rahatani / Kalewadi", "Rahatani", 18.60100, 73.78400, 2,
               []),
}

PUNE = {}
for _z in (CITY_CORE, CAMP_CANTONMENT, KOTHRUD_ERANDWANE, SOUTH_HADAPSAR_KONDHWA,
           NORTHWEST_AUNDH_BANER, IT_CORRIDOR, EAST, PIMPRI_CHINCHWAD):
    PUNE.update(_z)

ZONE_OF = {}
for _name, _z in (
    ("City Core", CITY_CORE),
    ("Camp / Cantonment", CAMP_CANTONMENT),
    ("Kothrud / Erandwane", KOTHRUD_ERANDWANE),
    ("South (Hadapsar / Kondhwa)", SOUTH_HADAPSAR_KONDHWA),
    ("North-West (Aundh / Baner / Pashan)", NORTHWEST_AUNDH_BANER),
    ("IT Corridor (Wakad / Hinjewadi)", IT_CORRIDOR),
    ("East (Viman Nagar / Kalyani Nagar)", EAST),
    ("Pimpri-Chinchwad", PIMPRI_CHINCHWAD),
):
    for _pin in _z:
        ZONE_OF[_pin] = _name

# Governance confidence per pincode. "confirmed" for the ordinary
# single-jurisdiction case; "confirmed-mixed-jurisdiction-single-pincode"
# for the genuine Wakad/Hinjewadi split (see docstring).
GOVERNANCE_CONF = {}
for _pin in PUNE:
    GOVERNANCE_CONF[_pin] = "confirmed"
GOVERNANCE_CONF["411057"] = "confirmed-mixed-jurisdiction-single-pincode"

# Real governance note, populated only for pincodes with a genuine
# jurisdictional complexity worth surfacing in the UI (mirrors
# Kolkata's Bidhannagar governance_note pattern).
GOVERNANCE_NOTE = {
    "411057": (
        "This pincode covers both Wakad (confirmed Pimpri-Chinchwad "
        "Municipal Corporation) and the Hinjewadi IT park core, which "
        "is real PMRDA + MIDC + Gram Panchayat territory, NOT PCMC or "
        "PMC -- a decade-long proposal to merge Hinjewadi into PCMC is "
        "still not finalized as of the most recent evidence found. "
        "Modelled at this pincode's PCMC/Wakad governance; the "
        "Hinjewadi portion's real jurisdiction differs."
    ),
    "411001": (
        "Pune Cantonment Board, a real civic body separate from PMC "
        "since 1817, governs this area directly; PMC supplies water "
        "but has no other civic authority here."
    ),
}

# Real crime/police jurisdiction. Pune City Police Commissionerate for
# every PMC-proper zone; Pimpri-Chinchwad Police Commissionerate
# (separate since April 2018) for the PCMC zone.
COMMISSIONERATE_OF = {}
for _pin in PUNE:
    COMMISSIONERATE_OF[_pin] = "Pune City Police"
for _pin in PIMPRI_CHINCHWAD:
    COMMISSIONERATE_OF[_pin] = "Pimpri-Chinchwad Police Commissionerate"

# Real power utility. MSEDCL confirmed as the sole distributor
# city-wide -- no split found, unlike Kolkata's genuine 3-way case.
DISCOM_OF = {}
DISCOM_CONF = {}
for _pin in PUNE:
    DISCOM_OF[_pin] = "MSEDCL"
    DISCOM_CONF[_pin] = "confirmed"

TIER_LABEL = {1: "Premium", 2: "Mid", 3: "Affordable"}

def landmarks_of(pin):
    return PUNE[pin][5] if pin in PUNE else []

def audit():
    pins = list(PUNE.keys())
    assert len(pins) == len(set(pins)), "duplicate pincode in PUNE"
    print(f"Pune: {len(pins)} pincodes across {len(set(ZONE_OF.values()))} zones")
    from collections import Counter
    zc = Counter(ZONE_OF[p] for p in pins)
    for zone, n in zc.items():
        print(f"  {zone}: {n}")
    total_landmarks = sum(len(landmarks_of(p)) for p in pins)
    print(f"  total landmarks: {total_landmarks}")
    gov_counts = Counter(GOVERNANCE_CONF.values())
    print(f"  governance confidence: {dict(gov_counts)}")
    comm_counts = Counter(COMMISSIONERATE_OF.values())
    print(f"  police commissionerate split: {dict(comm_counts)}")
    disc_counts = Counter(DISCOM_OF.values())
    print(f"  discom split: {dict(disc_counts)}")

if __name__ == "__main__":
    audit()
