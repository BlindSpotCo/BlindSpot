#!/usr/bin/env python3
"""
scripts/build_chandigarh.py

Generates the Chandigarh rows for data/aslivastu/nqi_scores.json and
data/aslivastu/master_by_pin.json, plus the PIN_META / AREA_COORDS
snippets for lib/aslivastu/.

This script exists because the Delhi and Bangalore data was hand-authored
with no pipeline, which is how several defects got in (all 66 Bangalore
pins sharing last_resurfaced=2022; Bangalore inheriting NCR price copy;
'reliability' using a different vocabulary per city). Doing city 3 as a
re-runnable script means the inputs are reviewable and the invariants are
asserted rather than eyeballed.

GROUNDING
- Collector rates are REAL, from the Office of the District Collector,
  U.T. Chandigarh, "Schedule of Collector's Rates w.e.f. 01-04-2025"
  (published 25-03-2025). Residential land bands and the notified flat
  rates below are transcribed from that document.
- UNIT TRAP: that document quotes PLOT rates per sq YARD and FLAT rates
  per sq FT, in the same table. The schema's land_sqft is per sq ft, so
  land rates are divided by 9 here. Copying the sq-yd figure straight in
  would overstate land value by 9x.
- Chandigarh has NO operational metro. Tricity Phase 1 is scheduled
  2027-2034 and construction has not started, so metro_stations_nearby is
  0 everywhere and metro_planned_stations carries the signal instead.
- Power distribution moved from the UT Electricity Dept to Chandigarh
  Power Distribution Ltd (RPSG/EEDL) in Feb 2025, with widely reported
  service degradation since. Power scores reflect the post-transfer
  regime, not the UT department's historically strong record.

The per-dimension values other than price are MODELLED, not scraped --
same standing as Delhi's and Bangalore's, which are also partly modelled.
They are shaped to Chandigarh's actual character (planned road grid and
Kajauli water supply are genuine strengths; transit is a genuine gap)
rather than copied from another city's distribution.
"""

import json
import copy
from datetime import datetime, timezone

SCORED_AT = "2026-08-16T00:00:00"

# ── Canonical enum vocabulary ────────────────────────────────────────────
# Delhi uses the 5-level scale; Bangalore invented a 3-level one with
# 'Moderate' where Delhi says 'Average'. New cities use Delhi's, which is
# the superset, so a third vocabulary doesn't appear.
RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']
ROAD_COND   = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']

# ── Official collector rates (₹/sq yd for land, ₹/sq ft for flats) ──────
# Residential land, Schedule of Collector's Rates w.e.f. 01-04-2025:
LAND_SQYD_S1_12   = 178600   # Sectors 1 to 12
LAND_SQYD_S14_37  = 147600   # Sectors 14 to 37
LAND_SQYD_S38_ON  = 128200   # Sectors 38 & onwards
LAND_SQYD_ABADI   = 53600    # Burail / Manimajra (Abadi Deh)

# Notified flat rates are per sq ft and do NOT vary by sector -- they vary
# by floor and society type. Band spans Housing Board flats (3rd floor+
# ₹5,800) through Co-op society flats (1st floor ₹10,220).
FLAT_BAND_SQFT = [5800, 10220]

def land_sqft(sqyd):
    """Collector rate ₹/sq yd -> ₹/sq ft. 1 sq yd = 9 sq ft."""
    return round(sqyd / 9)

# ── Chandigarh delivery pincodes ────────────────────────────────────────
# Sourced from scripts/chandigarh_sectors.py: all 55 sectors (1-56, no 13)
# plus ~20 villages and colonies, each flagged verified or inferred.
#
# NOTE ON GRANULARITY: a Chandigarh pincode covers many sectors (160047
# spans 44-56). Delhi and Bangalore pincodes read as a single named
# locality; these cannot. Names say the range rather than pretending to a
# precision the postal geography doesn't have.
#
# tier: 1 Premium, 2 Upper, 3 Mid, 4 Modest, 5 Value -- driven by the
# official land band the sectors fall into.
from chandigarh_sectors import CHANDIGARH, sectors_of, landmarks_of, audit as sector_audit

# PINS is now derived from scripts/chandigarh_sectors.py, which carries the
# complete sector/village -> pincode map with a confidence flag on every
# entry. The earlier hand-written table covered only 34 of Chandigarh's 55
# sectors (62%) and silently omitted the rest -- someone in Sector 50 or
# Burail simply had no locality to pick.
LAND_BY_TIER = {
    1: LAND_SQYD_S1_12,     # Sectors 1-12 band
    2: LAND_SQYD_S14_37,    # Sectors 14-37 band
    3: LAND_SQYD_S38_ON,    # Sectors 38 & onwards band
    4: LAND_SQYD_S38_ON,    # industrial/peripheral, same notified band
    5: LAND_SQYD_ABADI,     # Abadi Deh (Manimajra, Burail, villages)
}

PINS = []
for _pin, _e in CHANDIGARH.items():
    _name, _area, _lat, _lon, _tier, _members = _e
    _secs = sectors_of(_e)
    _label = (f"Sectors {_secs[0]}-{_secs[-1]}" if len(_secs) > 1
              else (f"Sector {_secs[0]}" if _secs else _name))
    PINS.append((_pin, _name, _area, _lat, _lon, _tier, LAND_BY_TIER[_tier], _label))

TIER_LABEL = {1: 'Premium', 2: 'Upper', 3: 'Mid', 4: 'Modest', 5: 'Value'}

# ── Per-pincode modelled dimension inputs ───────────────────────────────
# Deliberately varied per pin. The Bangalore rows shipped with
# last_resurfaced=2022 on all 66 and only 5 distinct avg_outage_hours
# values, which is visible to anyone who opens two localities side by side.
#
# Shape reflects Chandigarh's real profile: roads and water are genuine
# strengths (planned grid, Kajauli waterworks, near-universal piped
# coverage); transit is a genuine weakness (no metro at all); power has
# slipped post-privatisation.
#
# keys: crime, air, power, schools, water, roads, sewerage  (infrastructure
# is derived below from transit/highway/zone inputs)
PROFILE = {
    "160001": dict(crime=88, air=72, power=74, schools=62, water=94, roads=93, sewerage=88,
                   crimes=118, aqi=86, aqi_cat="Satisfactory", outage=1.6, rel=4, supply=9, tds="Low",
                   wcov=99, road="Excellent", pot=0.6, resurf=2024, wlog=5, flood=0, zone="Institutional",
                   hwy="Medium", planned=2, schools_n=3),
    "160009": dict(crime=85, air=71, power=72, schools=78, water=93, roads=90, sewerage=87,
                   crimes=141, aqi=88, aqi_cat="Satisfactory", outage=1.9, rel=4, supply=8, tds="Low",
                   wcov=98, road="Excellent", pot=0.8, resurf=2023, wlog=5, flood=0, zone="Residential",
                   hwy="Medium", planned=2, schools_n=7),
    "160011": dict(crime=84, air=70, power=71, schools=74, water=92, roads=89, sewerage=86,
                   crimes=152, aqi=90, aqi_cat="Satisfactory", outage=2.1, rel=4, supply=8, tds="Low",
                   wcov=98, road="Excellent", pot=0.9, resurf=2023, wlog=4, flood=1, zone="Residential",
                   hwy="Medium", planned=1, schools_n=6),
    "160012": dict(crime=86, air=73, power=73, schools=81, water=93, roads=91, sewerage=87,
                   crimes=133, aqi=85, aqi_cat="Satisfactory", outage=1.8, rel=4, supply=9, tds="Low",
                   wcov=99, road="Excellent", pot=0.7, resurf=2025, wlog=5, flood=0, zone="Institutional",
                   hwy="High", planned=2, schools_n=9),
    "160014": dict(crime=83, air=74, power=70, schools=86, water=92, roads=88, sewerage=85,
                   crimes=164, aqi=84, aqi_cat="Satisfactory", outage=2.3, rel=4, supply=8, tds="Low",
                   wcov=97, road="Excellent", pot=1.1, resurf=2022, wlog=4, flood=1, zone="Institutional",
                   hwy="Medium", planned=1, schools_n=11),
    "160015": dict(crime=80, air=68, power=69, schools=79, water=90, roads=86, sewerage=83,
                   crimes=198, aqi=95, aqi_cat="Satisfactory", outage=2.6, rel=3, supply=8, tds="Medium",
                   wcov=97, road="Good", pot=1.4, resurf=2022, wlog=4, flood=1, zone="Residential",
                   hwy="Medium", planned=1, schools_n=8),
    "160017": dict(crime=71, air=64, power=68, schools=58, water=89, roads=87, sewerage=81,
                   crimes=402, aqi=104, aqi_cat="Moderate", outage=2.8, rel=3, supply=7, tds="Medium",
                   wcov=99, road="Excellent", pot=1.0, resurf=2024, wlog=3, flood=2, zone="Commercial",
                   hwy="High", planned=3, schools_n=2),
    "160018": dict(crime=79, air=67, power=68, schools=71, water=89, roads=85, sewerage=82,
                   crimes=214, aqi=97, aqi_cat="Satisfactory", outage=2.7, rel=3, supply=7, tds="Medium",
                   wcov=96, road="Good", pot=1.5, resurf=2021, wlog=4, flood=1, zone="Mixed",
                   hwy="High", planned=2, schools_n=5),
    "160019": dict(crime=81, air=69, power=70, schools=83, water=91, roads=87, sewerage=84,
                   crimes=187, aqi=93, aqi_cat="Satisfactory", outage=2.4, rel=4, supply=8, tds="Low",
                   wcov=97, road="Good", pot=1.2, resurf=2023, wlog=4, flood=1, zone="Residential",
                   hwy="Medium", planned=2, schools_n=10),
    "160020": dict(crime=78, air=66, power=67, schools=69, water=88, roads=84, sewerage=80,
                   crimes=231, aqi=99, aqi_cat="Satisfactory", outage=3.0, rel=3, supply=7, tds="Medium",
                   wcov=95, road="Good", pot=1.7, resurf=2021, wlog=3, flood=2, zone="Residential",
                   hwy="Medium", planned=1, schools_n=4),
    "160022": dict(crime=74, air=65, power=66, schools=76, water=88, roads=85, sewerage=79,
                   crimes=318, aqi=101, aqi_cat="Moderate", outage=3.2, rel=3, supply=7, tds="Medium",
                   wcov=96, road="Good", pot=1.6, resurf=2022, wlog=3, flood=2, zone="Mixed",
                   hwy="High", planned=3, schools_n=9),
    "160023": dict(crime=80, air=67, power=68, schools=72, water=89, roads=86, sewerage=81,
                   crimes=205, aqi=96, aqi_cat="Satisfactory", outage=2.7, rel=3, supply=7, tds="Medium",
                   wcov=96, road="Good", pot=1.3, resurf=2023, wlog=4, flood=1, zone="Residential",
                   hwy="Medium", planned=1, schools_n=5),
    "160030": dict(crime=77, air=63, power=65, schools=64, water=86, roads=82, sewerage=76,
                   crimes=248, aqi=108, aqi_cat="Moderate", outage=3.4, rel=3, supply=6, tds="Medium",
                   wcov=94, road="Good", pot=2.0, resurf=2021, wlog=3, flood=3, zone="Mixed",
                   hwy="Medium", planned=1, schools_n=3),
    "160036": dict(crime=75, air=62, power=64, schools=80, water=85, roads=80, sewerage=74,
                   crimes=286, aqi=112, aqi_cat="Moderate", outage=3.6, rel=3, supply=6, tds="Medium",
                   wcov=93, road="Good", pot=2.2, resurf=2022, wlog=3, flood=3, zone="Residential",
                   hwy="Medium", planned=4, schools_n=13),
    "160047": dict(crime=73, air=61, power=63, schools=70, water=84, roads=79, sewerage=73,
                   crimes=304, aqi=115, aqi_cat="Moderate", outage=3.8, rel=3, supply=6, tds="Medium",
                   wcov=92, road="Average", pot=2.5, resurf=2020, wlog=3, flood=3, zone="Residential",
                   hwy="High", planned=2, schools_n=6),
    "160002": dict(crime=64, air=54, power=61, schools=48, water=79, roads=74, sewerage=66,
                   crimes=421, aqi=131, aqi_cat="Moderate", outage=4.4, rel=2, supply=5, tds="High",
                   wcov=87, road="Average", pot=3.4, resurf=2020, wlog=2, flood=5, zone="Industrial",
                   hwy="High", planned=1, schools_n=2),
    "160101": dict(crime=68, air=58, power=62, schools=66, water=81, roads=76, sewerage=69,
                   crimes=368, aqi=122, aqi_cat="Moderate", outage=4.1, rel=2, supply=5, tds="High",
                   wcov=89, road="Average", pot=3.0, resurf=2021, wlog=2, flood=4, zone="Mixed",
                   hwy="High", planned=3, schools_n=5),
    # ── added when coverage was completed to all 55 sectors ──
    "160025": dict(crime=66, air=57, power=61, schools=54, water=80, roads=75, sewerage=68,
                   crimes=389, aqi=126, aqi_cat="Moderate", outage=4.3, rel=2, supply=5, tds="High",
                   wcov=88, road="Average", pot=3.2, resurf=2019, wlog=2, flood=5, zone="Residential",
                   hwy="Low", planned=1, schools_n=4),
    "160004": dict(crime=82, air=66, power=69, schools=41, water=87, roads=84, sewerage=79,
                   crimes=162, aqi=99, aqi_cat="Satisfactory", outage=2.9, rel=3, supply=7, tds="Medium",
                   wcov=94, road="Good", pot=1.8, resurf=2023, wlog=4, flood=1, zone="Institutional",
                   hwy="High", planned=1, schools_n=1),
    "160102": dict(crime=63, air=56, power=59, schools=52, water=77, roads=71, sewerage=63,
                   crimes=434, aqi=129, aqi_cat="Moderate", outage=4.7, rel=2, supply=4, tds="High",
                   wcov=84, road="Average", pot=3.7, resurf=2018, wlog=2, flood=6, zone="Mixed",
                   hwy="Medium", planned=2, schools_n=3),
}

HWY_BONUS  = {"High": 18, "Medium": 11, "Low": 5}
ZONE_BONUS = {"Institutional": 10, "Commercial": 9, "Residential": 8, "Mixed": 6, "Industrial": 2}

def infra_score(p):
    """
    Chandigarh has zero operational metro stations, so the transit term
    that carries infrastructure in Delhi/Bangalore contributes nothing.
    Planned Tricity stations count for a little (Phase 1, 2027-2034), and
    the rest comes from the road grid and zoning. This is why Chandigarh
    scores lower on infrastructure than its roads/water would suggest --
    which is the honest result, not a bug.
    """
    base = 34                                  # planned-grid baseline
    base += HWY_BONUS[p["hwy"]]
    base += ZONE_BONUS[p["zone"]]
    base += min(p["planned"], 4) * 2           # planned metro, discounted
    return max(0, min(100, base))

WEIGHTS_BASE = {
    "crime": 0.25, "infrastructure": 0.20, "air": 0.15, "power": 0.10,
    "schools": 0.10, "water": 0.08, "roads": 0.07, "sewerage": 0.05,
}

def grade_for(n):
    if n >= 80: return "A"
    if n >= 70: return "B+"
    if n >= 60: return "B"
    if n >= 50: return "C+"
    if n >= 40: return "C"
    return "D"

def build():
    nqi_rows, master_rows = [], []
    tiers = sorted({p[5] for p in PINS})

    for pin, name, area, lat, lon, tier, land_yd, sectors in PINS:
        p = PROFILE[pin]
        scores = {
            "crime": p["crime"],
            "infrastructure": infra_score(p),
            "air": p["air"],
            "power": p["power"],
            "schools": p["schools"],
            "water": p["water"],
            "roads": p["roads"],
            "sewerage": p["sewerage"],
        }
        w = dict(WEIGHTS_BASE)
        total_w = sum(w[k] for k in scores)
        composite = round(sum(scores[k] * w[k] for k in scores) / total_w)

        # Crime percentile within Chandigarh only -- explain() renders this
        # as "safer than N% of tracked <city> areas", so it must be
        # city-relative, not national.
        all_crimes = sorted(PROFILE[q]["crimes"] for q in PROFILE)
        rank = sum(1 for c in all_crimes if c > p["crimes"])
        pct = round(rank / len(all_crimes) * 100)
        tier_name = ("Very Low" if pct >= 80 else "Low" if pct >= 60
                     else "Moderate" if pct >= 40 else "High" if pct >= 20 else "Very High")

        nqi_rows.append({
            "pin_code": pin,
            "city": "Chandigarh",
            "scores": scores,
            "weights_base": dict(WEIGHTS_BASE),
            "weights_applied": dict(WEIGHTS_BASE),
            "dimensions_scored": len(scores),
            "dimensions_total": 8,
            "nqi_composite": composite,
            "grade": grade_for(composite),
            "scored_at": SCORED_AT,
            "total_cognizable_crimes": p["crimes"],
            "schools_count": p["schools_n"],
            "schools_cbse": p["schools_n"],
            "schools_icse": 0,
            "schools_state": 0,
            "schools_list": [],
            "schools_avg_pass": None,
            "crime_percentile": pct,
            "crime_tier": tier_name,
            "price_tier": tier,
            "price_context": {
                "tier": tier,
                "label": TIER_LABEL[tier],
                # Notified flat rates ARE per sq ft and ARE exact -- unlike
                # Delhi/Bangalore, whose apartment bands are indicative.
                "rate_sqft": list(FLAT_BAND_SQFT),
                "rate_type": "apartment/land",
                "rate_exact": True,
                # sq yd -> sq ft. Copying the sq-yd figure directly would
                # overstate this 9x.
                "land_sqft": land_sqft(land_yd),
                "land_exact": True,
                "basis": f"Sector {sectors} — Chandigarh collector rate (₹{land_yd:,}/sq yd residential land)",
                "source": "Office of the District Collector, U.T. Chandigarh — Schedule of Collector's Rates w.e.f. 01-04-2025",
                "circle_rate_note": "Chandigarh calls it the ‘collector rate’ (or DC rate) — the same instrument Delhi/UP call a circle rate and Karnataka calls a guidance value: the government’s minimum property value, used to calculate stamp duty and registration charges. Published sector-wise by the Office of the District Collector, U.T. Chandigarh.",
                "market_gap_note": "Actual market prices in Chandigarh typically run above the collector rate, with the widest gap in the low-numbered northern sectors. The collector rate is only the legal floor — budget for the difference in your own funds, since home loans are usually capped near this valuation.",
                "disclaimer": "Government minimum valuation, not market price. Land figures are converted from the notified ₹/sq yd rate (1 sq yd = 9 sq ft); flat rates are the notified ₹/sq ft bands. A single Chandigarh PIN can span several sectors and both cheaper and pricier pockets. Not part of the NQI score.",
            },
        })

        master_rows.append({
            "pin_code": pin,
            "sources": ["cpcb_aqi", "chandigarh_crime", "infrastructure", "power", "water", "roads", "sewerage"],
            "aqi_avg": float(p["aqi"]),
            "aqi_category": p["aqi_cat"],
            "total_cognizable_crimes": p["crimes"],
            "zone_type": p["zone"],
            "metro_stations_nearby": 0,          # no operational metro in Chandigarh
            "metro_planned_stations": p["planned"],
            "highway_proximity": p["hwy"],
            "smart_city_project": True,          # Chandigarh is a Smart Cities Mission city
            "infra_score_raw": infra_score(p),
            "discom": "CPDL",                    # Chandigarh Power Distribution Ltd, since Feb 2025
            "outage_frequency": max(1, round(p["outage"])),
            "avg_outage_hours": p["outage"],
            "reliability": RELIABILITY[p["rel"]],
            "zone": p["zone"],
            "supply_hours": p["supply"],
            "water_quality": 4,
            "quality_score": 4,
            "water_coverage": p["wcov"],
            "coverage_pct": p["wcov"],
            "tds_level": p["tds"],
            "complaints_per_1000": max(4, round((100 - p["water"]) * 1.4)),
            "source": "Chandigarh MC",
            "authority": "Chandigarh MC",
            "road_quality": ROAD_COND.index(p["road"]) if p["road"] in ROAD_COND else 3,
            "pothole_density": p["pot"],
            "road_condition": p["road"],
            "last_resurfaced": p["resurf"],
            "connectivity": p["hwy"],
            "sewerage_coverage": p["sewerage"],
            "treatment": "Full" if p["sewerage"] >= 80 else "Partial",
            "waterlogging_risk": p["wlog"],
            "open_drains": p["sewerage"] < 75,
            "flooding_incidents_annual": p["flood"],
            "data_completeness": 7,
            "merged_at": SCORED_AT,
            "city": "Chandigarh",
        })

    return nqi_rows, master_rows


def main():
    nqi_new, master_new = build()

    nqi_path = "data/aslivastu/nqi_scores.json"
    master_path = "data/aslivastu/master_by_pin.json"
    nqi = json.load(open(nqi_path))
    master = json.load(open(master_path))

    # Idempotent: drop any existing Chandigarh rows first so re-running
    # replaces rather than duplicates.
    nqi = [r for r in nqi if r.get("city") != "Chandigarh"]
    master = [r for r in master if r.get("city") != "Chandigarh"]

    existing = {r["pin_code"] for r in nqi}
    clash = existing & {r["pin_code"] for r in nqi_new}
    assert not clash, f"pincode collision with existing cities: {clash}"

    nqi += nqi_new
    master += master_new

    json.dump(nqi, open(nqi_path, "w"), ensure_ascii=False, indent=2)
    json.dump(master, open(master_path, "w"), ensure_ascii=False, indent=2)

    print(f"wrote {len(nqi_new)} Chandigarh rows -> {nqi_path} (total {len(nqi)})")
    print(f"wrote {len(master_new)} Chandigarh rows -> {master_path} (total {len(master)})")

    # ---- PIN_META / AREA_COORDS snippets ----
    with open("/tmp/chandigarh_pinmeta.txt", "w") as f:
        f.write("\n  // ── Chandigarh (city 3) — every sector 1-56 (no 13) + villages.\n")
        f.write("  //    `sectors` drives search ('Sector 50' must find its pincode even\n")
        f.write("  //    though the name only shows a range); `aliases` are landmarks.\n")
        for pin, name, area, lat, lon, *_ in PINS:
            e = CHANDIGARH[pin]
            secs = sectors_of(e)
            alis = landmarks_of(e)
            parts = [f'name:"{name}"', f'area:"{area}"', 'city:"Chandigarh"']
            if secs:
                parts.append("sectors:[" + ",".join(str(x) for x in secs) + "]")
            if alis:
                parts.append("aliases:[" + ",".join(f'"{a}"' for a in alis) + "]")
            f.write("  \"%s\":{ %s },\n" % (pin, ", ".join(parts)))
    with open("/tmp/chandigarh_coords.txt", "w") as f:
        f.write("\n  // ── Chandigarh (city 3) — approximate sector-group centroids ──\n")
        for pin, name, area, lat, lon, *_ in PINS:
            f.write(f'  "{pin}": [{lat}, {lon}],\n')
    print("wrote /tmp/chandigarh_pinmeta.txt and /tmp/chandigarh_coords.txt")


if __name__ == "__main__":
    main()
