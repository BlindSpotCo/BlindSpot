#!/usr/bin/env python3
"""
scripts/chandigarh_sectors.py

The complete Chandigarh sector / village -> pincode map, with an explicit
confidence flag on every entry.

WHY CONFIDENCE IS TRACKED
Chandigarh has 55 sectors (1-56, with no Sector 13 -- skipped by design)
plus ~20 villages and colonies. Only 25 sectors have their OWN post
office. India Post publishes post office LOCATIONS, not sector DELIVERY
BOUNDARIES, so for the remaining ~30 sectors the serving pincode is not
officially published anywhere.

Secondary sources disagree precisely there. Two published sector-wise
lists conflict on at least:
  - Sector 43: 160036 (chdlife) vs 160022 (cityultimate)
  - Sector 31: 160047 (chdlife) vs 160030 (cityultimate)

Rather than silently pick one and present all of it as fact, every entry
carries `confidence`:
  "verified" -- the sector has its own post office, or both independent
                sources agree on it.
  "inferred" -- no dedicated post office; assigned to the geographically
                adjacent serving office. Directionally right, not
                authoritative.

Practical impact of an inferred mapping being wrong is bounded: scores
are pincode-level and adjacent Chandigarh sectors are broadly similar, so
a misassignment shifts a score by a few points, not a grade band. But it
IS an accuracy claim, so it's recorded rather than hidden.

Conflicts above resolved on geography:
  - Sector 43 -> 160036. Sector 43 sits in the south next to 42 and 44;
    160022 covers Sectors 21/22/34/35 in the centre, which is not
    contiguous with 43. The 36-43 grouping is.
  - Sector 31 -> 160030. Sector 31 has its own post office and sits
    directly beside 29 and 30, which share 160030.
"""

V, I = "verified", "inferred"

# pincode -> (display name, area, lat, lon, price tier, [(sector|village, confidence)])
CHANDIGARH = {
    "160001": ("Sectors 1-5 · Capitol Complex", "North Chandigarh", 30.7590, 76.8060, 1, [
        (1, V), (2, I), (3, I), (4, I), (5, I),
        ("Capitol Complex", V), ("High Court", V), ("New Secretariat", V), ("Rajendra Park", I),
    ]),
    "160009": ("Sectors 8-9", "North Chandigarh", 30.7480, 76.8010, 1, [
        (8, V), (9, V), ("UT Secretariat", V),
    ]),
    "160011": ("Sectors 10-11", "North Chandigarh", 30.7530, 76.7790, 1, [
        (10, V), (11, V),
    ]),
    "160012": ("Sector 12 · PEC", "North Chandigarh", 30.7620, 76.7830, 1, [
        (12, V), ("PEC", V), ("Punjab Engineering College", V),
    ]),
    "160014": ("Sector 14 · Panjab University", "West Chandigarh", 30.7590, 76.7660, 2, [
        (14, V), (24, I), (25, I),
        ("Panjab University", V), ("PU", V), ("Dadu Majra", V), ("Dhanas", I),
        ("Khuda Lahora", I), ("Khuda Jassu", I), ("Khuda Alisher", I),
        ("Kaimbwala", I), ("Sarangpur", I),
    ]),
    "160015": ("Sectors 15-16", "Central Chandigarh", 30.7500, 76.7720, 2, [
        (15, V), (16, V),
    ]),
    "160017": ("Sector 17 · City Centre", "Central Chandigarh", 30.7410, 76.7822, 2, [
        (17, V), ("GPO", V), ("City Centre", V), ("Bus Stand 17", V), ("ISBT 17", V),
    ]),
    "160018": ("Sector 18", "Central Chandigarh", 30.7430, 76.7930, 2, [
        (18, V), ("Government Press", V),
    ]),
    "160019": ("Sectors 6-7, 19, 26-27", "East Chandigarh", 30.7450, 76.8100, 2, [
        (19, V), (26, V), (27, V), (6, I), (7, I),
        ("Raj Bhawan", V), ("Grain Market", I),
    ]),
    "160020": ("Sector 20", "Central Chandigarh", 30.7370, 76.7830, 2, [
        (20, V),
    ]),
    "160022": ("Sectors 21-22, 32-35", "Central Chandigarh", 30.7340, 76.7700, 2, [
        (21, V), (22, V), (34, V), (35, V), (32, I), (33, I),
        ("Sub City Centre", V), ("GMCH 32", I), ("PGI", I),
    ]),
    "160023": ("Sector 23", "Central Chandigarh", 30.7420, 76.7690, 2, [
        (23, V), (28, I),
    ]),
    "160025": ("Maloya · Sector 39", "West Chandigarh", 30.7060, 76.7290, 5, [
        ("Maloya", V), (39, I), ("Milk Colony", I),
    ]),
    "160030": ("Sectors 29-31", "East Chandigarh", 30.7290, 76.7960, 2, [
        (29, V), (30, V), (31, V),
    ]),
    "160036": ("Sectors 36-38, 40-43", "South Chandigarh", 30.7230, 76.7480, 3, [
        (36, V), (40, V), (37, I), (38, I), (41, I), (42, I), (43, I),
        ("ISBT 43", I), ("Bus Stand 43", I), ("Attawa", I), ("Badheri", I), ("Buterla", I),
    ]),
    "160047": ("Sectors 44-56", "South Chandigarh", 30.7150, 76.7700, 3, [
        (44, V), (47, V),
        (45, I), (46, I), (48, I), (49, I), (50, I), (51, I),
        (52, I), (53, I), (54, I), (55, I), (56, I),
        ("Burail", I), ("Kajheri", I), ("Palsora", I),
    ]),
    "160002": ("Ram Darbar · Industrial Area", "South-East Chandigarh", 30.7060, 76.8060, 4, [
        ("Ram Darbar", V), ("Industrial Area Phase 1", V), ("Industrial Area Phase 2", V),
        ("Elante", V), ("Nexus Elante", V), ("IT Park", I), ("Rajiv Gandhi IT Park", I),
    ]),
    "160004": ("Air Force Station · Highground", "South-East Chandigarh", 30.6940, 76.7980, 4, [
        ("Airforce Highground", V), ("Air Force Station", V),
    ]),
    "160101": ("Manimajra", "East Chandigarh", 30.7290, 76.8380, 5, [
        ("Manimajra", V), ("Mani Majra", V), ("Motor Market", V), ("Shivalik Enclave", I),
        ("Modern Housing Complex", I),
    ]),
    "160102": ("Mauli Jagran · Raipur Kalan", "North-East Chandigarh", 30.7180, 76.8560, 5, [
        ("Mauli Jagran", V), ("Raipur Kalan", V), ("Raipur Khurd", I),
        ("Behlana", I), ("Daria", I), ("Hallomajra", I),
    ]),
}


def sectors_of(entry):
    return sorted(x for x, _ in entry[5] if isinstance(x, int))


def landmarks_of(entry):
    return [x for x, _ in entry[5] if isinstance(x, str)]


def audit():
    """All 55 sectors present exactly once, no duplicates."""
    seen = {}
    dupes = []
    for pin, e in CHANDIGARH.items():
        for s in sectors_of(e):
            if s in seen:
                dupes.append((s, seen[s], pin))
            seen[s] = pin
    expected = [i for i in range(1, 57) if i != 13]
    missing = [s for s in expected if s not in seen]

    n_v = sum(1 for e in CHANDIGARH.values() for _, c in e[5] if c == V)
    n_i = sum(1 for e in CHANDIGARH.values() for _, c in e[5] if c == I)

    print(f"pincodes           : {len(CHANDIGARH)}")
    print(f"sectors mapped     : {len(seen)} / {len(expected)}")
    print(f"missing sectors    : {missing or 'none'}")
    print(f"duplicate sectors  : {dupes or 'none'}")
    print(f"landmarks          : {sum(len(landmarks_of(e)) for e in CHANDIGARH.values())}")
    print(f"entries verified   : {n_v}")
    print(f"entries inferred   : {n_i}  ({round(n_i/(n_v+n_i)*100)}%)")
    ok = not missing and not dupes
    print("\n" + ("AUDIT PASS" if ok else "AUDIT FAIL"))
    return ok


if __name__ == "__main__":
    import sys
    sys.exit(0 if audit() else 1)
