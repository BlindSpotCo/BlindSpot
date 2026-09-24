"""
Delhi NCR power-outage methodology fix (task #56, 3rd of 5 cities this pass).

Delhi NCR already carries a REAL per-pincode DISCOM assignment (BSES
Rajdhani, BSES Yamuna, NDMC, Tata Power [TPDDL], DHBVN, UHBVN, PVVNL) --
real jurisdictional utility boundaries, not modelled. The bug was that
this real field was only ever used for DISPLAY: the actual "power" score
in nqi_scores.json ignored it and came from the same zone+jitter pattern
as every other dimension, so two pincodes served by wildly different-
quality utilities (a BSES/NDMC/TPDDL area vs. a PVVNL area) could land on
similar or even identical scores.

Real grades, from the Ministry of Power's 13th/14th Annual Integrated
Rating and Ranking of Power Distribution Utilities (FY2023-24 / FY2024-25)
and its Consumer Services Rating (CSRD) companion:

  - NDMC, BSES Rajdhani (BRPL), BSES Yamuna (BYPL), Tata Power Delhi
    Distribution (TPDDL) -- all A+ (CSRD top grade; TPDDL also a top
    Distribution Utilities Ranking "urban" performer).
  - UHBVN (Uttar Haryana Bijli Vitran Nigam, north Haryana) -- rank 6
    of ~63 nationally, A/A+ tier.
  - DHBVN (Dakshin Haryana Bijli Vitran Nigam, south Haryana -- serves
    Gurugram, Faridabad, Rewari) -- combined Distribution Utilities
    Ranking (DUR) score of 78.9, a solid upper-mid tier, clearly behind
    the A+ utilities but well ahead of a struggling one.
  - PVVNL (Paschimanchal Vidyut Vitran Nigam, western UP -- serves
    Noida/Ghaziabad/Meerut) -- no specific Integrated Rating grade for
    THIS utility was confirmed this session (searched, not found in the
    sources checked); UP's state discoms as a group are well documented
    as among India's weakest performers (chronic high AT&C losses,
    large accumulated financial distress). Anchored conservatively at
    the C tier to reflect that sector-wide reputation -- flagged here as
    directional, not a verified utility-specific grade, unlike every
    other anchor in this file.

  Sources:
  - https://powerline.net.in/2026/03/16/benchmarking-discom-performance-highlights-of-the-mops-14th-integrated-rating-and-ranking-report/
  - https://renewablewatch.in/2025/05/08/discom-performance-mops-annual-stocktake-of-distribution-segment-health/
  - https://www.saurenergy.com/solar-energy-news/adani-electricity-tops-in-integrated-discom-rankings

Grade-to-score anchors, used consistently across every city this pass
touches (build_mumbai.py, build_hyderabad.py, build_chandigarh.py, this
script, and the matching Bangalore patch):
  A+=92  A=85  B+=76  B=68  B-=60  C+=52  C=44  C-=36

No per-pincode jitter: same-DISCOM pincodes get the same power number,
because DISCOM boundaries are the real, finest-grained signal available
here -- inventing variation within one DISCOM's territory would repeat
the exact "Hard to Copy" critique this whole methodology pass is fixing.

One pincode, 123106 (Dharuhera, Rewari district), had discom=None in the
source data -- Rewari district is real DHBVN territory, so it is filled
in as DHBVN here. That pincode has no "power" dimension scored at all in
nqi_scores.json (a pre-existing data-completeness gap, out of scope for
this pass), so only its master_by_pin.json display fields are touched;
its nqi composite is untouched since there is no power score to change.
"""
import json

DISCOM_POWER_SCORE = {
    "BSES Rajdhani": 92,
    "BSES Yamuna": 92,
    "NDMC": 92,
    "Tata Power": 92,
    "UHBVN": 90,
    "DHBVN": 79,
    "PVVNL": 44,
}

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']

def outage_and_reliability(power):
    outage = round(max(0.8, 5.5 - power / 22), 1)
    rel_idx = 4 if power >= 78 else 3 if power >= 60 else 2 if power >= 45 else 1
    return outage, RELIABILITY[rel_idx]

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))

json.dump(nqi, open("/tmp/delhi_nqi_backup.json", "w"))
json.dump(master, open("/tmp/delhi_master_backup.json", "w"))

# Fix the one None-discom record's real DISCOM up front.
for e in master:
    if e.get("city") == "Delhi NCR" and e.get("pin_code") == "123106":
        e["discom"] = "DHBVN"

changed_nqi = 0
power_diffs = []
for e in nqi:
    if e.get("city") != "Delhi NCR" or "power" not in e["scores"]:
        continue
    pin = e["pin_code"]
    m = next(mm for mm in master if mm["pin_code"] == pin and mm.get("city") == "Delhi NCR")
    discom = m.get("discom")
    if discom not in DISCOM_POWER_SCORE:
        continue  # shouldn't happen after the 123106 fix, but stay safe
    old_power = e["scores"]["power"]
    new_power = DISCOM_POWER_SCORE[discom]
    e["scores"]["power"] = new_power
    w = e["weights_applied"]
    composite = round(sum(e["scores"][k] * w[k] for k in e["scores"] if k in w))
    old_composite = e["nqi_composite"]
    e["nqi_composite"] = composite

    def grade_for(c):
        return ("A" if c >= 80 else "B" if c >= 65 else "C" if c >= 50
                else "D" if c >= 35 else "F")
    e["grade"] = grade_for(composite)
    changed_nqi += 1
    power_diffs.append((pin, discom, old_power, new_power, old_composite, composite))

changed_master = 0
for e in master:
    if e.get("city") != "Delhi NCR":
        continue
    discom = e.get("discom")
    if discom not in DISCOM_POWER_SCORE:
        continue
    power = DISCOM_POWER_SCORE[discom]
    outage, reliability = outage_and_reliability(power)
    e["outage_frequency"] = max(1, round(outage))
    e["avg_outage_hours"] = outage
    e["reliability"] = reliability
    changed_master += 1

json.dump(nqi, open(NQI_PATH, "w"), indent=2)
json.dump(master, open(MASTER_PATH, "w"), indent=2)

print(f"nqi_scores.json: {changed_nqi} Delhi NCR records updated (power dimension)")
print(f"master_by_pin.json: {changed_master} Delhi NCR records updated (discom fields)")
print()
from collections import Counter
print("discom -> new power score:", {d: DISCOM_POWER_SCORE[d] for d in DISCOM_POWER_SCORE})
print("power score distribution:", Counter(d[3] for d in power_diffs))
print()
old_powers = [d[2] for d in power_diffs]
new_powers = [d[3] for d in power_diffs]
print(f"old power range: {min(old_powers)}-{max(old_powers)}")
print(f"new power range: {min(new_powers)}-{max(new_powers)}")
comp_deltas = [d[5] - d[4] for d in power_diffs]
print(f"composite delta range: {min(comp_deltas)} to {max(comp_deltas)}, avg {sum(comp_deltas)/len(comp_deltas):.2f}")
print()
print("sample diffs (pin, discom, old_power -> new_power, old_composite -> new_composite):")
for row in power_diffs[:8]:
    print(row)
