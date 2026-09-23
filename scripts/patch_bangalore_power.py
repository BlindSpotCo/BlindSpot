"""
Bangalore power-outage methodology fix (task #56, last of 5 cities this pass).

Bangalore is a single-DISCOM city (BESCOM, city-wide) -- no within-city
discom split is possible the way Mumbai's or Delhi's real multi-DISCOM
boundaries allow. But BESCOM DOES have a real, specific, very recent
grade: the Ministry of Power's 14th Annual Integrated Rating and Ranking
of Power Distribution Utilities (FY2024-25, the most recent report) gave
BESCOM a 'C-' grade, score 28.94/100 -- the LOWEST of any rated utility
in the country, down from a B+/B grade the year before (13th report,
FY2023-24). Reported causes: no profit after tax despite Rs 33,375 crore
revenue, a -16.50 point disincentive penalty, and poor marks across 15
performance parameters (cash flow, financial health, power losses, debt
ratios, billing efficiency).

Source: https://newsfirstprime.com/bengaluru/bescom-gets-red-card-scores-lowest-in-national-power-utility-rankings-11092698

Grade-to-score anchors, used consistently across every city this pass
touches: A+=92 A=85 B+=76 B=68 B-=60 C+=52 C=44 C-=36

Previously the "power" field varied per pincode (56-80, one flat pattern
of a handful of repeated values -- 61/78/80/56/36 -- with no real
per-pincode BESCOM source behind the spread, same modelled-not-measured
issue every other dimension in this methodology pass has been fixing).
Replaced with one flat, disclosed, real anchor (36) for every Bangalore
pincode -- no jitter, since BESCOM's real grade is a single citywide
number, not a per-locality one.
"""
import json

BESCOM_POWER_SCORE = 36

NQI_PATH = "data/aslivastu/nqi_scores.json"
MASTER_PATH = "data/aslivastu/master_by_pin.json"

nqi = json.load(open(NQI_PATH))
master = json.load(open(MASTER_PATH))

json.dump(nqi, open("/tmp/blr_power_nqi_backup.json", "w"))
json.dump(master, open("/tmp/blr_power_master_backup.json", "w"))

RELIABILITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent']

def outage_and_reliability(power):
    outage = round(max(0.8, 5.5 - power / 22), 1)
    rel_idx = 4 if power >= 78 else 3 if power >= 60 else 2 if power >= 45 else 1
    return outage, RELIABILITY[rel_idx]

changed_nqi = 0
power_diffs = []
for e in nqi:
    if e.get("city") != "Bangalore" or "power" not in e["scores"]:
        continue
    old_power = e["scores"]["power"]
    e["scores"]["power"] = BESCOM_POWER_SCORE
    w = e["weights_applied"]
    composite = round(sum(e["scores"][k] * w[k] for k in e["scores"] if k in w))
    old_composite = e["nqi_composite"]
    e["nqi_composite"] = composite

    def grade_for(c):
        # Canonical 6-band scale (matches build_chennai.py / build_hyderabad.py /
        # build_mumbai.py / build_chandigarh.py). This script used to carry its own
        # coarser 5-band inline version (A>=80, B>=65, C>=50, D>=35, F else, no B+/C+),
        # which silently corrupted 106 grade labels across Delhi NCR and Bangalore
        # before scripts/patch_grade_labels.py fixed the data in v1.11. Fixed here too
        # so a future re-run of this script can't reintroduce that bug.
        return ("A" if c >= 80 else "B+" if c >= 70 else "B" if c >= 60
                else "C+" if c >= 50 else "C" if c >= 40 else "D")
    e["grade"] = grade_for(composite)
    changed_nqi += 1
    power_diffs.append((e["pin_code"], old_power, BESCOM_POWER_SCORE, old_composite, composite))

outage, reliability = outage_and_reliability(BESCOM_POWER_SCORE)
changed_master = 0
for e in master:
    if e.get("city") != "Bangalore":
        continue
    e["outage_frequency"] = max(1, round(outage))
    e["avg_outage_hours"] = outage
    e["reliability"] = reliability
    changed_master += 1

json.dump(nqi, open(NQI_PATH, "w"), indent=2)
json.dump(master, open(MASTER_PATH, "w"), indent=2)

print(f"nqi_scores.json: {changed_nqi} Bangalore records updated")
print(f"master_by_pin.json: {changed_master} Bangalore records updated")
print(f"new power score: {BESCOM_POWER_SCORE}, outage: {outage}h, reliability: {reliability}")
print()
old_powers = [d[1] for d in power_diffs]
print(f"old power range: {min(old_powers)}-{max(old_powers)}")
comp_deltas = [d[4] - d[3] for d in power_diffs]
print(f"composite delta range: {min(comp_deltas)} to {max(comp_deltas)}, avg {sum(comp_deltas)/len(comp_deltas):.2f}")
print()
print("sample diffs (pin, old_power -> new_power, old_composite -> new_composite):")
for row in power_diffs[:8]:
    print(row)
