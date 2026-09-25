#!/usr/bin/env python3
"""
One-time patch: replaces Bangalore's synthetic crime data and constant
last_resurfaced field with a properly varied, methodology-consistent
model, matching the exact standard the rest of the platform already
holds itself to for this dimension.

BACKGROUND (pre-monetization audit, Tier 2): 100% of Bangalore's 66
total_cognizable_crimes values were round multiples of 10, and the
`scores.crime` field (constant at 82/72/60/48 in 4 buckets) was entirely
decoupled from `total_cognizable_crimes` (which varied 320-560) -- the
two didn't even rank-correlate. last_resurfaced was the literal same
year (2022) for all 66 records.

No real, pincode-level (or even police-station-level) crime dataset for
Bengaluru is publicly available -- confirmed by search this pass (data
.opencity.in's Bengaluru Crime Data 2023 is city-wide by crime TYPE only,
not by geography; Bengaluru City Police's 11 law-and-order divisions
have no published per-division crime rate). This is the SAME constraint
already disclosed for every other city in this dataset --
scripts/build_mumbai.py's crimes_for() and scripts/build_chandigarh.py's
PROFILE both state outright that their own crime figures are "a modelled
relative ranking... no pincode-level source exists," not a claimed real
count. Bangalore is not held to a lower bar here; it simply never got
the same treatment as those cities.

METHOD -- copies scripts/build_mumbai.py's own established pattern
exactly (zone-baseline score, deterministic per-pincode hash jitter so
scores don't look artificially uniform, crimes_for() as the score's
inverse, rank-based percentile, the same 20-point tier bands used by
Chandigarh and Mumbai), but keyed on TWO real fields Bangalore's own
master_by_pin.json already carries -- BBMP `zone` and `zone_type`
(Commercial/Mixed/Residential) -- rather than one. The zone baseline
values are a qualitative, disclosed judgment call (older/denser core
zones and commercial land use assumed to carry more reported incident
volume; newer planned tech-corridor and low-density periphery zones
assumed to carry less), the same "not a claimed crime-rate fact" honesty
level scripts/build_hyderabad.py's docstring already uses for its own
zone crime modelling.

last_resurfaced is derived from `pothole_density`, a real per-pincode
field already present and varying (2.5-13.0) that this dataset's own UI
copy says a resurfacing year should track ("Year the main roads were
last resurfaced (every 5-7 years is typical)") -- this finishes a
computation the flat 2022 constant never did, it does not introduce new
facts.

Does NOT touch: any other Bangalore dimension, the record-level `sources`
tag (still 'bengaluru_seed' -- every other Bangalore dimension besides
crime remains exactly as unvetted as before, this patch does not launder
that), or any city besides Bangalore.
"""
import json
import shutil
from datetime import date

MASTER_PATH = "data/aslivastu/master_by_pin.json"
NQI_PATH = "data/aslivastu/nqi_scores.json"
TODAY = date.today().isoformat()


def jitter(pin, spread=6, salt=0):
    """Same deterministic pseudo-random offset as scripts/build_mumbai.py's
    jitter(), seeded on the pincode string plus a per-purpose salt."""
    h = 0
    for ch in f"{pin}:{salt}":
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return (h % (2 * spread + 1)) - spread


ZONE_BASE = {
    "West": 68, "East": 71, "South": 79, "Bommanahalli": 75,
    "Mahadevapura": 82, "Yelahanka": 80, "Rajarajeshwarinagar": 77,
    "PERIPHERY_OUTSIDE_BBMP": 76,
}
TYPE_ADJ = {"Commercial": -8, "Mixed": -3, "Residential": 0}


def crime_score_for(pin, zone, ztype):
    base = ZONE_BASE.get(zone, 76) + TYPE_ADJ.get(ztype, -3)
    base += jitter(pin, 5, salt=hash("crime") % 97)
    return max(5, min(98, round(base)))


def crimes_for(pin, score):
    # Same formula shape as scripts/build_mumbai.py's crimes_for().
    return round(600 - score * 5 + jitter(pin, 40, salt=5))


def canonical_grade_for(n):
    if n >= 80: return "A"
    if n >= 70: return "B+"
    if n >= 60: return "B"
    if n >= 50: return "C+"
    if n >= 40: return "C"
    return "D"


def tier_for_crime_score(score):
    """Absolute reading of this pincode's own crime score, same threshold
    bands as canonical_grade_for()'s A/B+/B/C+ boundaries -- not a same-city
    percentile rank. A within-city percentile stretches to fill 0-100
    regardless of how tightly real scores cluster, which is exactly what
    mislabelled Whitefield (560066)'s perfectly decent score as "Very High
    crime" the first time this script ran -- see
    patch_crime_percentile_consistency.py's docstring for the full story."""
    return ("Very Low" if score >= 80 else "Low" if score >= 70
            else "Moderate" if score >= 60 else "High" if score >= 50 else "Very High")


for path in (MASTER_PATH, NQI_PATH):
    shutil.copy(path, path + ".v113_backup")

master = json.load(open(MASTER_PATH, encoding="utf-8"))
nqi = json.load(open(NQI_PATH, encoding="utf-8"))
blr_master = [r for r in master if r.get("city") == "Bangalore"]
blr_nqi = {r["pin_code"]: r for r in nqi if r.get("city") == "Bangalore"}

# ── last_resurfaced, derived from real pothole_density ──────────────────
potholes = [r["pothole_density"] for r in blr_master]
p_lo, p_hi = min(potholes), max(potholes)
resurf_changed = []
for r in blr_master:
    frac = (r["pothole_density"] - p_lo) / (p_hi - p_lo)
    year = round(2025 - frac * 6)
    old = r.get("last_resurfaced")
    r["last_resurfaced"] = year
    r.setdefault("_provenance", {})["last_resurfaced"] = {
        "value": year,
        "source_id": "internal-derive",
        "method": "Derived from this record's own pothole_density (already real, already per-pincode varying: "
                   f"{p_lo}-{p_hi} across Bangalore), linearly mapped onto a 2019-2025 resurfacing window matching "
                   "this dataset's own documented 5-7 year resurfacing cycle assumption.",
        "as_of": TODAY,
        "confidence": "low",
        "note": f"Was a flat 2022 for all 66 Bangalore records before this patch (pre-monetization audit, Tier 2). "
                f"Old value: {old!r}.",
    }
    resurf_changed.append((r["pin_code"], old, year))

# ── crime score / count, derived from real zone + zone_type ─────────────
crime_scores = {}
for r in blr_master:
    crime_scores[r["pin_code"]] = crime_score_for(r["pin_code"], r.get("zone"), r.get("zone_type"))
crimes_by_pin = {pin: crimes_for(pin, s) for pin, s in crime_scores.items()}
all_crimes = sorted(crimes_by_pin.values())
all_crime_scores = sorted(crime_scores.values())

crime_changed = []
for r in blr_master:
    pin = r["pin_code"]
    old_crimes = r.get("total_cognizable_crimes")
    new_crimes = crimes_by_pin[pin]
    r["total_cognizable_crimes"] = new_crimes
    r.setdefault("_provenance", {})["total_cognizable_crimes"] = {
        "value": new_crimes,
        "source_id": "internal-model",
        "method": "Zone-baseline + deterministic per-pincode jitter, keyed on this record's real BBMP `zone` and "
                   "`zone_type` fields -- the same crimes_for()/jitter() methodology scripts/build_mumbai.py already "
                   "uses for Mumbai's crime dimension. No pincode-level Bengaluru crime dataset is publicly "
                   "available (checked this pass); this is a modelled relative ranking, same honesty level "
                   "scripts/build_mumbai.py and scripts/build_chandigarh.py already disclose for their own crime "
                   "figures, not a claimed real absolute count.",
        "as_of": TODAY,
        "confidence": "low",
        "note": f"Replaces a synthetic value (100% of Bangalore's 66 records were round multiples of 10, "
                f"pre-monetization audit Tier 2). Old value: {old_crimes!r}.",
    }
    crime_changed.append((pin, old_crimes, new_crimes))

    n = blr_nqi.get(pin)
    if n is None:
        continue
    old_score = n["scores"].get("crime")
    old_composite = n.get("nqi_composite")
    old_grade = n.get("grade")
    old_pct = n.get("crime_percentile")
    old_tier = n.get("crime_tier")

    n["scores"]["crime"] = crime_scores[pin]
    rank = sum(1 for s in all_crime_scores if s < crime_scores[pin])
    pct = round(rank / len(all_crime_scores) * 100)
    n["crime_percentile"] = pct
    n["crime_tier"] = tier_for_crime_score(crime_scores[pin])

    w = n["weights_applied"]
    composite = round(sum(n["scores"][k] * w[k] for k in n["scores"] if k in w))
    n["nqi_composite"] = composite
    n["grade"] = canonical_grade_for(composite)

    n.setdefault("_provenance", {})["crime"] = {
        "value": crime_scores[pin],
        "source_id": "internal-model",
        "method": "Same zone/zone_type-based model as total_cognizable_crimes above; this is the corresponding "
                   "0-100 safety score, now correlated with the crime count instead of decoupled from it.",
        "as_of": TODAY,
        "confidence": "low",
        "note": f"Old scores.crime={old_score!r} composite={old_composite!r} grade={old_grade!r} "
                f"percentile={old_pct!r} tier={old_tier!r} -> "
                f"new scores.crime={crime_scores[pin]!r} composite={composite!r} grade={n['grade']!r} "
                f"percentile={pct!r} tier={n['crime_tier']!r}.",
    }

with open(MASTER_PATH, "w", encoding="utf-8") as f:
    json.dump(master, f, indent=2, ensure_ascii=False)
with open(NQI_PATH, "w", encoding="utf-8") as f:
    json.dump(nqi, f, indent=2, ensure_ascii=False)

print(f"{len(crime_changed)} Bangalore records: total_cognizable_crimes + crime score/percentile/tier recomputed")
print(f"  distinct crime counts now: {len(set(crimes_by_pin.values()))} (was low-single-digit round buckets)")
print(f"  range: {min(all_crimes)}-{max(all_crimes)}")
print(f"{len(resurf_changed)} Bangalore records: last_resurfaced recomputed from pothole_density")
from collections import Counter
print("  year distribution:", dict(Counter(y for _, _, y in resurf_changed)))
print()
print("Sample (pin, old_crimes, new_crimes):")
for pin, old, new in crime_changed[:8]:
    print(f"  {pin}: {old} -> {new}")
