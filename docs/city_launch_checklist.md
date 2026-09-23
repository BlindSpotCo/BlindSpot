# City launch checklist

Generated 2026-09-23 by `scripts/city_launch_checklist.py` — item 8 of the trust-framework checklist. Re-run this script after any data or scoring change; don't hand-edit this file.

`pass` / `FAIL` / `PARTIAL` / `PENDING` (needs a human step) / `N/A` (not measurable with current data).

| City | 1 | 2 | 3 | 4 | 5 | 6 | 7 | Recommendation |
|---|---|---|---|---|---|---|---|---|
| Ahmedabad (n=39) | pass | FAIL | PENDING | PENDING | pass | pass | pass | **Keep labelled beta** |
| Bangalore (n=66) | FAIL | FAIL | PENDING | PENDING | pass | pass | pass | **Keep labelled beta** |
| Chandigarh (n=20) | pass | FAIL | PENDING | PENDING | N/A | pass | pass | **Keep labelled beta** |
| Chennai (n=34) | pass | FAIL | PENDING | PENDING | pass | PARTIAL | pass | **Keep labelled beta** |
| Delhi NCR (n=86) | pass | FAIL | PENDING | PENDING | pass | pass | pass | **Keep labelled beta** |
| Hyderabad (n=41) | pass | FAIL | PENDING | PENDING | pass | pass | pass | **Keep labelled beta** |
| Mumbai (n=96) | pass | FAIL | PENDING | PENDING | pass | pass | pass | **Keep labelled beta** |

## Detail per city

### Ahmedabad

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.83 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 39/39 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Bangalore

- **1. Source audit (no fabricated/seed tags)**: 66/66 pins tagged non-authoritative
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.81 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 66/66 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Chandigarh

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: only 1 distinct price band(s) -- proxy too coarse to check
- **6. Confidence/abstention logic present**: 20/20 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Chennai

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.73 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 1/34 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Delhi NCR

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.46 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 86/86 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Hyderabad

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.49 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 41/41 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

### Mumbai

- **1. Source audit (no fabricated/seed tags)**: no tainted source tags
- **2. Freshness checks passing**: no scheduled refresh pipeline exists yet (product-wide gap)
- **3. Ground-truth sample >=95%**: sample generated (scripts/ground_truth_audit.py), not yet human-verified
- **4. Resident feedback loop live**: widget + API shipped on 8/~30 fields; field_reports table not confirmed created
- **5. Benchmark alignment (vs. circle-rate proxy)**: r=+0.57 vs. circle-rate proxy (not market price -- see script docstring)
- **6. Confidence/abstention logic present**: 96/96 pins have a _provenance entry on at least one field
- **7. Versioning & changelog in place**: CHANGELOG.md exists, currently at v1.14

