# Paywall (branch `paywall-ui`)

UI for the paid version of BlindSpot, built on the Oct 2026 Keys scheme. Everything except taking money: no payment provider, no server wallet. Keys are kept in the browser (localStorage) so the flow can be clicked through end to end.

Turn it off with `NEXT_PUBLIC_PAYWALL=off`. Hide the "Simulate successful payment" button with `NEXT_PUBLIC_PAYWALL_MOCK=off`.

## The model

People open BlindSpot when they have 3–5 flats shortlisted and need to pick one. That's one decision, not a monthly habit, so it's pay-per-property, not a subscription.

| Rule | Keys |
|---|---|
| First report on a property | 2 |
| Each extra report on that property (another floor, facing, or report type) | 1 |

A "property" is the pin rounded to ~11 m (`propertyKey` in `lib/paywall/config.js`), so two pins on the same tower count once.

| Pack | Keys | Price | Per Key | Sized for |
|---|---|---|---|---|
| Basic | 6 | ₹299 | ₹49.83 | 2 properties × 2 flats |
| Explorer | 18 | ₹799 | ₹44.39 | ~6 properties |
| Investor | 30 | ₹1,199 | ₹39.97 | ~10 properties (broker) |
| Pro | 50 | ₹1,999 | ₹39.98 | ~16 properties |

Shortlist fit: 2 towers × 2 flats = 2+1+2+1 = 6 Keys (Basic, exactly). A broker with 10 listings × 2 flats = 30 Keys (Investor, exactly).

## Free vs paid

The line follows cost: what triggers AI generation costs Keys, what we compute ourselves stays free.

**Free:** 3D sun & shadow map, Neighbourhood Score, Home Comfort Score, both score breakdowns, trends, the verify checklist, saving to profile, Compare, Furnish.

**Costs Keys:**
- Detailed neighbourhood report (`/neighbourhood-report/[pin]`, opened from "See the detailed area report")
- Year-round sunlight report (sun & shadow gallery)
- Full BlindSpot report (includes both of the above for that flat)

## Unit economics (internal, not on /pricing)

Assumes ~₹50 to generate a report and every Key gets used (the worst case). "Typical" = each property gets a first report + one extra (3 Keys → 2 reports). Before gateway fees and GST.

| Pack | Margin, first report (2 Keys) | Margin, extra report (1 Key) | Typical reports | Pack margin |
|---|---|---|---|---|
| Basic | +₹49.67 | −₹0.17 | 4 | ₹99 (33%) |
| Explorer | +₹38.78 | −₹5.61 | 12 | ₹199 (25%) |
| Investor | +₹29.93 | −₹10.03 | 20 | ₹199 (17%) |
| Pro | +₹29.96 | −₹10.02 | 33 | ₹349 (17%) |

Flags:
1. **Extra reports lose money on bigger packs.** First reports carry the margin. If an extra report reuses the neighbourhood write-up and only regenerates the flat section, its real cost is probably under ₹50. Measure before repricing.
2. **Pro isn't cheaper per Key than Investor** (₹39.98 vs ₹39.97). For a small step down: Pro at ₹1,899 = ₹37.98/Key.
3. Unused Keys are pure margin and aren't counted above.

## What the UI does

- **Before clicking:** every paid button/link shows a lock + Key cost (`KeyCostTag`), or "Unlocked". The full-report card says "First report on this property: 2 Keys…" with a link to /pricing.
- **On click, enough Keys:** confirm dialog (cost, why, balance after) → "Use 2 Keys" → the existing report flow opens.
- **On click, not enough:** Key packs with "You need N more Keys" → checkout (Razorpay button disabled, "Payments aren't live yet") → simulated payment → back to the confirm step for the report you clicked.
- **Floor/facing unset:** nothing is charged; the old nudge to set them still runs first.
- **Header:** Key balance chip (opens wallet: balance, unlocked reports, history) on the report page; "Pricing" in the site nav.
- **/pricing:** rules, packs, shortlist examples, free vs paid.

## Files

- `lib/paywall/config.js` — prices, packs, rules, flags
- `lib/paywall/KeysProvider.js` — wallet state + `useKeys()` (`request`, `isUnlocked`, `costFor`)
- `components/paywall/PaywallModal.js` — confirm / packs / checkout / wallet dialog, `KeyCostTag`
- `components/paywall/KeyBalance.js` — header chip
- `components/paywall/PricingView.js`, `app/pricing/page.js` — /pricing
- `app/layout.js` — mounts `KeysProvider`
- `components/report/ReportScreen.js` — gates `requestReport` and the area-report link, adds tags/hint/chip

## Open decisions

- **The neighbourhood report page is public and in the sitemap** (SEO pages, also linked from the homepage live map). The link from the report flow is gated, but the URL itself isn't. Options: keep the public page as a teaser (scores + summary) and lock the deep sections, or gate it and drop it from the sitemap. Gating it outright loses the SEO traffic.
- **Furnish (floor-plan analysis) and room-photo analysis also call AI** and are free here. They're not in the Keys scheme yet.
- Saved reports in `/my-reports` stay viewable (they were already paid for).

## Before charging real money

1. Supabase `key_wallets` (user_id, balance) + `key_ledger` (delta, reason, property, report type, payment id) + `key_unlocks`.
2. Razorpay order API + webhook that credits Keys; replace `creditPack`.
3. Deduct the Key **server-side** in the routes that start generation (`app/api/sunscout/report/analyse`, `/pdf`) and refuse when there's no unlock. The browser check alone can be skipped with devtools.
4. Auto-refund the Key if generation fails.
5. Require sign-in before purchase; move the localStorage wallet into the account on first sign-in.
6. GST invoice on purchase.
