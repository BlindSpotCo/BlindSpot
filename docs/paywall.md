# Paywall

**Not live on main.** Every report on blindspot.properties is free.

The Keys paywall UI (locks on paid buttons, Key wallet in localStorage, unlock pop-ups, stubbed checkout with a "Simulate successful payment" button) lives on the **`paywall-ui`** branch. It was taken off main because real users were hitting a fake checkout.

What's still on main:
- `lib/paywall/config.js` — Key prices and packs (data only)
- `/pricing` — information page, says Keys aren't on sale yet
- Terms / Privacy / Refunds / Shipping pages (needed for Razorpay onboarding)

To bring the paywall back, build it on `paywall-ui` with real payments first (see the "Before charging real money" list in `docs/paywall.md` on that branch), then merge.
