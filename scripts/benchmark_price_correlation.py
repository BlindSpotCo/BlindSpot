#!/usr/bin/env python3
"""
scripts/benchmark_price_correlation.py

Item 5 from the trust-framework checklist ("Cross-check against
independent benchmarks... run simple regressions: Score vs. price per
sq ft"). Correlates each pin's nqi_composite score against its own
price_context (already in nqi_scores.json, government circle-rate data,
computed at build time from MCD/state circle-rate notifications --
independent of the NQI pipeline itself, so this is a genuine external
check, not the composite grading itself).

IMPORTANT CAVEAT, read before trusting the output:
price_context is CIRCLE RATE (government minimum valuation for stamp
duty), not market price or rent. Its own disclaimer field says actual
market prices in NCR "typically run 20-70% above the circle rate." So
this is a proxy for the check the framework asked for, not the real
thing -- it tests "does BlindSpot's score track official government
land-value tiers", not "does it track what people actually pay". A
positive correlation here is a real, useful signal (both are trying to
capture the same underlying desirability, and circle rates ARE set with
locational quality in mind); a weak one doesn't necessarily mean the NQI
score is wrong -- it could mean circle rate itself is a stale/coarse
proxy for market price in that city. Getting real market price/rent data
(99acres/MagicBricks listings, or a licensed feed) is the honest fix, and
is not attempted here.

Also checks price_context's own resolution before trusting a
correlation: a city where every pin shares one price band can't produce
a meaningful correlation no matter what the scores do (see Chandigarh
below) -- reported as "not measurable", not run.

Run: python3 scripts/benchmark_price_correlation.py
"""
import json
from collections import defaultdict

NQI_PATH = "data/aslivastu/nqi_scores.json"
MIN_DISTINCT_BANDS = 5  # below this, price resolution itself is too coarse for a meaningful correlation

def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    if sxx == 0 or syy == 0:
        return None
    return sxy / (sxx ** 0.5 * syy ** 0.5)

nqi = json.load(open(NQI_PATH))
by_city = defaultdict(list)
for r in nqi:
    by_city[r["city"]].append(r)

print("=" * 78)
print("Benchmark check: NQI composite score vs. government circle-rate (item 5)")
print("=" * 78)
print("CAVEAT: circle rate is a government minimum valuation, not market price.")
print("Market prices typically run 20-70% above it (per the data's own disclaimer).")
print("Treat this as a proxy check, not a market-price validation.")
print()

results = []
for city, recs in sorted(by_city.items()):
    pairs = []
    bands = set()
    for r in recs:
        pc = r.get("price_context") or {}
        band = pc.get("rate_sqft")
        composite = r.get("nqi_composite")
        if not band or composite is None or len(band) != 2:
            continue
        mid = (band[0] + band[1]) / 2
        bands.add(tuple(band))
        pairs.append((mid, composite))

    n = len(pairs)
    distinct_bands = len(bands)
    if distinct_bands < MIN_DISTINCT_BANDS:
        print(f"{city}: NOT MEASURABLE — only {distinct_bands} distinct price band(s) across "
              f"{n} pins. Circle-rate data is too coarse in this city to correlate against "
              f"anything; a flat or near-flat price signal can't validate or invalidate the score.")
        results.append((city, None, n, distinct_bands))
        continue

    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    r_val = pearson(xs, ys)
    direction = "positive" if (r_val or 0) > 0 else "negative"
    strength = (
        "strong" if abs(r_val or 0) >= 0.6 else
        "moderate" if abs(r_val or 0) >= 0.3 else
        "weak"
    )
    print(f"{city}: r = {r_val:+.3f} ({strength} {direction}), n={n} pins, "
          f"{distinct_bands} distinct price bands")
    results.append((city, r_val, n, distinct_bands))

print()
print("-" * 78)
print("Reading this: a strong positive r means higher-scored areas do carry higher")
print("circle rates in this dataset — score and (proxy) price roughly agree. A weak")
print("or negative r for a city with good price resolution (enough distinct bands)")
print("is worth investigating: either the score is off, the circle-rate proxy is a")
print("bad stand-in for market price there, or both.")
