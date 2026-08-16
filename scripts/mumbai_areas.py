#!/usr/bin/env python3
"""
scripts/mumbai_areas.py

The Greater Mumbai (BMC/MCGM jurisdiction only -- Mumbai City + Mumbai
Suburban districts) pincode reference table. Thane, Navi Mumbai,
Kalyan-Dombivli, Mira-Bhayandar, Vasai-Virar are OUT OF SCOPE -- separate
municipal corporations, separate future phases, not "Mumbai" in the
BMC/postal sense this file uses.

WHY THIS FILE EXISTS (mirrors chandigarh_sectors.py's reasoning)
Mumbai's pincode geography is actually cleaner than Chandigarh's -- most
BMC pincodes map to one or two well-known named localities rather than a
compressed sector range -- but the CITY carries a real complication no
earlier BlindSpot city had: THREE overlapping power distributors instead
of one. BEST serves the old Island City. Tata Power and Adani Electricity
both hold parallel licenses and run separate networks across the same
western-suburb households (the only Indian city where this happens) --
residents choose between them. MSEDCL is described in sources only as
covering "the periphery," with no published pincode-level boundary.

CONFIDENCE ON DISCOM, SPECIFICALLY
No public source publishes an official pincode -> DISCOM lookup table
(MERC/utility service-area maps were not directly available). What IS
confirmed: BEST = Island City (wards A-E/G, roughly 400001-400039);
Tata Power + Adani Electricity dual-license the western suburbs
(confirmed zone-level); Tata Power specifically named for the
Chunabhatti-Vikhroli-Mankhurd corridor. Every entry below carries a
`discom` value AND a `discom_confidence` flag -- "zone" (stated at
zone/corridor level in a real source, applied here at pincode level) or
"edge" (BMC's outer boundary wards bordering Thane/Navi Mumbai, where
MSEDCL is plausible but no source names the specific pincode). Nothing
here is "verified" the way a single-DISCOM city's discom field would be,
and the product's own per-record disclaimers should reflect that.

STRUCTURE
pincode -> (display_name, area_label, lat, lon, ward, zone, price_tier,
            discom, discom_confidence, [landmarks])

zone: one of 'South Mumbai', 'Western Suburbs', 'Extended Western Suburbs',
      'Eastern Suburbs' -- drives the air/water/infra baseline in
      build_mumbai.py, each tied to a specific documented real-world fact
      (see that file's ZONE_BASELINE comments).
price_tier: 1 Premium .. 5 Value, from Ready Reckoner Rate zone banding
      (Dept. of Registration & Stamps, IGR Maharashtra, FY2025-26).
"""

# ── South Mumbai / Island City (400001-400039) — BEST territory ─────────
SOUTH_MUMBAI = {
    "400001": ("Fort / CSMT / Churchgate East", "A Ward", 18.9339, 72.8352, "A", 1,
               ["Gateway of India", "CST/VT Terminus", "BSE", "Town Hall", "Bazargate"]),
    "400002": ("Kalbadevi", "C Ward", 18.9484, 72.8311, "C", 2,
               ["Zaveri Bazaar", "Mumbadevi Temple"]),
    "400003": ("Mandvi / Masjid Bunder", "B Ward", 18.9500, 72.8390, "B", 2,
               ["Crawford Market"]),
    "400004": ("Girgaon / Chowpatty", "C/D Ward", 18.9550, 72.8140, "C", 2,
               ["Girgaon Chowpatty", "Opera House"]),
    "400005": ("Colaba", "A Ward", 18.9067, 72.8147, "A", 1,
               ["Gateway of India", "Taj Mahal Palace", "Colaba Causeway"]),
    "400006": ("Malabar Hill", "D Ward", 18.9547, 72.7959, "D", 1,
               ["Hanging Gardens", "Banganga Tank"]),
    "400007": ("Grant Road / Tardeo", "D Ward", 18.9630, 72.8130, "D", 2,
               ["Grant Road Station"]),
    "400008": ("Mumbai Central", "D/E Ward", 18.9700, 72.8190, "D", 2,
               ["Mumbai Central Terminus", "JJ Hospital"]),
    "400009": ("Chinch Bunder / Byculla East", "B Ward", 18.9610, 72.8380, "B", 3,
               []),
    "400010": ("Mazgaon", "B Ward", 18.9660, 72.8420, "B", 2,
               ["Mazagon Dock Shipbuilders"]),
    "400011": ("Jacob Circle / Agripada", "E Ward", 18.9760, 72.8250, "E", 3,
               []),
    "400012": ("Parel / Lalbaug", "F/South Ward", 19.0000, 72.8340, "F/S", 2,
               ["Lalbaugcha Raja", "Haffkine Institute"]),
    "400013": ("Lower Parel", "G/South Ward", 18.9950, 72.8300, "G/S", 1,
               ["Phoenix Mills / High Street Phoenix", "Kamala Mills"]),
    "400014": ("Dadar East / Naigaon", "F/S · G/N Ward", 19.0180, 72.8440, "F/S", 2,
               ["Dadar TT"]),
    "400015": ("Sewri", "F/South Ward", 19.0090, 72.8570, "F/S", 3,
               ["Sewri Fort (flamingo point)"]),
    "400016": ("Mahim", "G/North Ward", 19.0410, 72.8410, "G/N", 2,
               ["Mahim Dargah", "Mahim Causeway"]),
    "400017": ("Dharavi", "G/North Ward", 19.0430, 72.8560, "G/N", 4,
               ["Dharavi"]),
    "400018": ("Worli", "G/South Ward", 19.0100, 72.8170, "G/S", 1,
               ["Worli Sea Face", "NSCI Dome", "Atria Mall"]),
    "400019": ("Matunga", "F/North Ward", 19.0270, 72.8550, "F/N", 2,
               ["Matunga Railway Workshop", "Five Gardens"]),
    "400020": ("Churchgate / Marine Lines", "A Ward", 18.9350, 72.8280, "A", 1,
               ["Churchgate Station", "Marine Drive"]),
    "400021": ("Nariman Point", "A Ward", 18.9256, 72.8242, "A", 1,
               ["Nariman Point business district"]),
    "400022": ("Sion", "F/North Ward", 19.0430, 72.8630, "F/N", 3,
               ["Sion Fort", "Sion Hospital"]),
    "400023": ("Hutatma Chowk (Fort)", "A Ward", 18.9330, 72.8330, "A", 1,
               ["Flora Fountain"]),
    "400024": ("Kurla East / Nehru Nagar", "L Ward", 19.0700, 72.8830, "L", 3,
               ["Nehru Nagar"]),
    "400025": ("Prabhadevi", "G/North Ward", 19.0170, 72.8280, "G/N", 1,
               ["Siddhivinayak Temple"]),
    "400026": ("Cumballa Hill / Kemps Corner", "D Ward", 18.9660, 72.8080, "D", 1,
               ["Kemps Corner", "August Kranti Maidan"]),
    "400027": ("Byculla (Rani Baug)", "E Ward", 18.9750, 72.8330, "E", 3,
               ["Rani Baug / Byculla Zoo", "Bhau Daji Lad Museum"]),
    "400028": ("Dadar West / Shivaji Park", "G/North Ward", 19.0280, 72.8380, "G/N", 1,
               ["Shivaji Park"]),
    "400029": ("Kalina / Vakola", "H/East Ward", 19.0730, 72.8570, "H/E", 3,
               ["Santacruz P&T Colony"]),
    "400030": ("Worli Colony", "G/South Ward", 19.0050, 72.8190, "G/S", 2,
               []),
    "400031": ("Wadala", "F/North Ward", 19.0170, 72.8630, "F/N", 3,
               ["Wadala Truck Terminal"]),
    "400032": ("Mantralaya", "A Ward", 18.9290, 72.8250, "A", 1,
               ["Mantralaya", "Vidhan Bhavan"]),
    "400033": ("Cotton Green / Kalachowki", "E Ward", 18.9830, 72.8390, "E", 3,
               ["Cotton Exchange Building"]),
    "400034": ("Haji Ali / Mahalaxmi", "D Ward", 18.9820, 72.8190, "D", 1,
               ["Haji Ali Dargah", "Mahalaxmi Racecourse"]),
    "400035": ("Raj Bhavan (Malabar Point)", "D Ward", 18.9450, 72.8010, "D", 1,
               ["Raj Bhavan"]),
    "400036": ("August Kranti Marg", "D Ward", 18.9640, 72.8100, "D", 1,
               []),
    "400037": ("Antop Hill", "F/North Ward", 19.0180, 72.8650, "F/N", 3,
               []),
    "400038": ("Ballard Estate", "A Ward", 18.9430, 72.8390, "A", 1,
               ["Ballard Estate", "Mumbai Port Trust"]),
    "400039": ("Council Hall (Fort)", "A Ward", 18.9350, 72.8360, "A", 1,
               []),
}

# ── Western Suburbs (400049-400069) — Tata Power + Adani dual-license ──
WESTERN_SUBURBS = {
    "400049": ("Juhu", "K/West Ward", 19.1075, 72.8263, "K/W", 1,
               ["Juhu Beach", "ISKCON Temple", "Prithvi Theatre"]),
    "400050": ("Bandra West", "H/West Ward", 19.0596, 72.8295, "H/W", 1,
               ["Bandstand", "Mount Mary Church", "Linking Road"]),
    "400051": ("Bandra East / BKC", "H/East Ward", 19.0650, 72.8680, "H/E", 1,
               ["Bandra Kurla Complex", "MMRDA Grounds"]),
    "400052": ("Khar", "H/West Ward", 19.0730, 72.8380, "H/W", 1,
               ["Khar Gymkhana"]),
    "400053": ("Andheri West (Azad Nagar)", "K/West Ward", 19.1280, 72.8330, "K/W", 3,
               ["Infinity Mall"]),
    "400054": ("Santacruz West", "H/West Ward", 19.0810, 72.8370, "H/W", 2,
               []),
    "400055": ("Santacruz East / Vakola", "H/East Ward", 19.0830, 72.8460, "H/E", 3,
               ["Domestic Airport environs"]),
    "400056": ("Vile Parle West", "H/West Ward", 19.1000, 72.8380, "H/W", 2,
               []),
    "400057": ("Vile Parle East", "K/East Ward", 19.0990, 72.8500, "K/E", 3,
               ["NMIMS University"]),
    "400058": ("Andheri West (Lokhandwala)", "K/West Ward", 19.1310, 72.8290, "K/W", 3,
               ["Lokhandwala Complex", "Andheri Station"]),
    "400059": ("Andheri East / Marol", "K/East Ward", 19.1140, 72.8830, "K/E", 3,
               ["Marol MIDC"]),
    "400060": ("Jogeshwari East", "K/East Ward", 19.1400, 72.8580, "K/E", 3,
               []),
    "400061": ("Versova / Madh", "K/West Ward", 19.1310, 72.8140, "K/W", 2,
               ["Versova Beach", "Madh Island"]),
    "400062": ("Goregaon West", "P/South Ward", 19.1650, 72.8490, "P/S", 3,
               ["Goregaon Station", "Oberoi Mall"]),
    "400063": ("Goregaon East", "P/South Ward", 19.1610, 72.8690, "P/S", 3,
               ["Film City", "NESCO"]),
    "400064": ("Malad West", "P/North Ward", 19.1860, 72.8400, "P/N", 3,
               ["Malad Station", "Inorbit Mall"]),
    "400065": ("Aarey Colony", "P/South Ward", 19.1550, 72.8830, "P/S", 3,
               ["Aarey Milk Colony", "SGNP edge"]),
    "400066": ("Borivali East (Magathane)", "R/Central Ward", 19.2280, 72.8650, "R/C", 4,
               ["SGNP entrance"]),
    "400067": ("Kandivali West / Charkop", "R/South Ward", 19.2050, 72.8330, "R/S", 3,
               ["Charkop", "Mahavir Nagar"]),
    "400068": ("Dahisar", "R/North Ward", 19.2540, 72.8590, "R/N", 4,
               ["Dahisar check naka (Mumbai-Thane border)"]),
    "400069": ("Andheri East (Nagardas Rd)", "K/East Ward", 19.1180, 72.8460, "K/E", 3,
               ["Chakala"]),
}

# ── Extended Western Suburbs (400090-400104) ────────────────────────────
EXTENDED_WESTERN = {
    "400090": ("Bangur Nagar (Goregaon W)", "P/South Ward", 19.1620, 72.8420, "P/S", 3,
               []),
    "400091": ("Borivali West", "R/North Ward", 19.2310, 72.8570, "R/N", 3,
               ["Borivali Station", "National Park main gate"]),
    "400092": ("Borivali West (Sundar Nagar)", "R/Central Ward", 19.2270, 72.8500, "R/C", 3,
               []),
    "400093": ("Chakala MIDC (Andheri E)", "K/East Ward", 19.1110, 72.8680, "K/E", 3,
               ["MIDC Chakala", "Airport cargo complex"]),
    "400095": ("Kharodi / INS Hamla", "K/West Ward", 19.1520, 72.7950, "K/W", 3,
               ["INS Hamla", "Madh-Marve"]),
    "400096": ("SEEPZ", "K/East Ward", 19.1190, 72.8710, "K/E", 2,
               ["SEEPZ Special Economic Zone"]),
    "400097": ("Malad East", "P/North Ward", 19.1830, 72.8560, "P/N", 3,
               ["Mindspace IT Park vicinity"]),
    "400098": ("Vidyanagari (Kalina)", "H/East Ward", 19.0710, 72.8660, "H/E", 2,
               ["University of Mumbai Kalina Campus"]),
    "400099": ("Sahar / Airport", "K/East Ward", 19.0980, 72.8680, "K/E", 2,
               ["Chhatrapati Shivaji Maharaj Int'l Airport"]),
    "400101": ("Kandivali East", "R/South Ward", 19.2040, 72.8620, "R/S", 3,
               ["Thakur Village"]),
    "400102": ("Jogeshwari West / Oshiwara", "K/West Ward", 19.1360, 72.8410, "K/W", 3,
               ["Oshiwara"]),
    "400103": ("Mandapeshwar (Borivali W)", "R/Central Ward", 19.2380, 72.8480, "R/C", 3,
               ["Mandapeshwar Caves"]),
    "400104": ("Motilal Nagar (Goregaon W)", "P/South Ward", 19.1580, 72.8380, "P/S", 3,
               ["Motilal Nagar"]),
}

# ── Eastern Suburbs / Harbour Line (400070-400089, 400043) ─────────────
# The worst-air-quality belt in Mumbai (see build_mumbai.py's
# ZONE_BASELINE) — Trombay thermal plant, Deonar landfill, refineries,
# hemmed in by the Trombay hills so sea breeze doesn't clear it, per
# WRI India's Mumbai Climate Action Plan vulnerability assessment.
EASTERN_SUBURBS = {
    "400070": ("Kurla West", "L Ward", 19.0730, 72.8790, "L", 3,
               ["Kurla Station", "Nehru Nagar"]),
    "400071": ("Chembur", "M/West Ward", 19.0520, 72.9000, "M/W", 3,
               ["Diamond Garden", "Priyadarshini Park"]),
    "400072": ("Saki Naka", "L Ward", 19.1090, 72.8880, "L", 3,
               ["Saki Naka industrial belt"]),
    "400073": ("Trombay", "M/West Ward", 19.0180, 72.9200, "M/W", 4,
               ["BARC vicinity", "Trombay thermal power station"]),
    "400074": ("RCF Chembur / Mahul", "M/East-West Ward", 19.0350, 72.9100, "M", 5,
               ["RCF fertiliser complex", "Mahul refineries"]),
    "400075": ("Pant Nagar (Ghatkopar E)", "N Ward", 19.0860, 72.9130, "N", 3,
               ["Pant Nagar"]),
    "400076": ("Powai", "L Ward", 19.1180, 72.9050, "L", 2,
               ["IIT Bombay", "Powai Lake", "Hiranandani Gardens"]),
    "400077": ("Ghatkopar", "N Ward", 19.0860, 72.9080, "N", 3,
               ["Ghatkopar rail/metro interchange"]),
    "400078": ("Bhandup West", "S Ward", 19.1440, 72.9350, "S", 4,
               ["Bhandup pumping station (BMC waterworks)"]),
    "400079": ("Vikhroli", "S/N Ward", 19.1090, 72.9280, "S", 3,
               ["Godrej & Boyce complex"]),
    "400080": ("Mulund West", "T Ward", 19.1720, 72.9420, "T", 4,
               ["Mulund check naka (Mumbai-Thane border)"]),
    "400081": ("Mulund East", "T Ward", 19.1730, 72.9560, "T", 4,
               ["Nirmal Lifestyle Mall"]),
    "400082": ("Mulund Colony", "T Ward", 19.1650, 72.9500, "T", 4,
               []),
    "400083": ("Vikhroli / Tagore Nagar", "S Ward", 19.1050, 72.9330, "S", 3,
               ["Tagore Nagar"]),
    "400084": ("Kurla West (Barve Nagar)", "L Ward", 19.0760, 72.8810, "L", 4,
               []),
    "400085": ("BARC (Trombay/Anushakti Nagar)", "M/West Ward", 19.0210, 72.9280, "M/W", 4,
               ["Bhabha Atomic Research Centre"]),
    "400086": ("Ghatkopar West (NITIE)", "N Ward", 19.0940, 72.9030, "N", 3,
               ["NITIE"]),
    "400087": ("Vikhroli West", "S Ward", 19.1100, 72.9250, "S", 3,
               []),
    "400088": ("Deonar", "M/East Ward", 19.0480, 72.9210, "M/E", 5,
               ["Deonar abattoir", "Deonar dumping ground"]),
    "400089": ("Tilak Nagar (Chembur)", "M/West Ward", 19.0640, 72.8950, "M/W", 3,
               ["Tilak Nagar Chembur"]),
    "400043": ("Govandi", "M/East Ward", 19.0540, 72.9080, "M/E", 5,
               ["Govandi", "Shivaji Nagar"]),
}

MUMBAI = {**SOUTH_MUMBAI, **WESTERN_SUBURBS, **EXTENDED_WESTERN, **EASTERN_SUBURBS}

ZONE_OF = {}
for _pin, _e in SOUTH_MUMBAI.items(): ZONE_OF[_pin] = "South Mumbai"
for _pin, _e in WESTERN_SUBURBS.items(): ZONE_OF[_pin] = "Western Suburbs"
for _pin, _e in EXTENDED_WESTERN.items(): ZONE_OF[_pin] = "Extended Western Suburbs"
for _pin, _e in EASTERN_SUBURBS.items(): ZONE_OF[_pin] = "Eastern Suburbs"

# discom: 'BEST' (Island City, zone-level confirmed), 'Tata Power + Adani
# Electricity' (western suburbs dual-license, zone-level confirmed),
# 'Tata Power' (Chunabhatti-Vikhroli-Mankhurd corridor, zone-level
# confirmed), or a slash-combo where the source only narrowed it to two
# plausible operators at the BMC boundary.
DISCOM_OF = {}
DISCOM_CONF = {}  # 'zone' = stated at zone/corridor level in a real source; 'edge' = BMC boundary, MSEDCL plausible but unsourced at pincode level
for _pin in SOUTH_MUMBAI:
    DISCOM_OF[_pin] = "BEST"; DISCOM_CONF[_pin] = "zone"
for _pin in WESTERN_SUBURBS:
    DISCOM_OF[_pin] = "Tata Power + Adani Electricity"; DISCOM_CONF[_pin] = "zone"
for _pin in EXTENDED_WESTERN:
    DISCOM_OF[_pin] = "Tata Power + Adani Electricity"; DISCOM_CONF[_pin] = "zone"
for _pin in EASTERN_SUBURBS:
    DISCOM_OF[_pin] = "Tata Power"; DISCOM_CONF[_pin] = "zone"
# BMC boundary pincodes bordering Thane/Navi Mumbai — no source names the
# specific operator here, MSEDCL is plausible per "periphery" description.
for _pin in ("400068", "400066", "400080", "400081", "400082", "400043", "400088"):
    DISCOM_OF[_pin] = "Tata Power / MSEDCL"; DISCOM_CONF[_pin] = "edge"

TIER_LABEL = {1: "Premium", 2: "Upper", 3: "Mid", 4: "Modest", 5: "Value"}


def landmarks_of(pin):
    return MUMBAI[pin][6]


def audit():
    zones = {}
    for pin in MUMBAI:
        zones.setdefault(ZONE_OF[pin], []).append(pin)
    print(f"total pincodes: {len(MUMBAI)}")
    for z, pins in zones.items():
        print(f"  {z}: {len(pins)}")
    dupes = [p for p in MUMBAI if list(MUMBAI.keys()).count(p) > 1]
    print("duplicate pincodes:", dupes or "none")
    n_land = sum(len(landmarks_of(p)) for p in MUMBAI)
    print(f"landmarks: {n_land}")
    conf = {}
    for c in DISCOM_CONF.values():
        conf[c] = conf.get(c, 0) + 1
    print("discom confidence:", conf)
    return not dupes


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
