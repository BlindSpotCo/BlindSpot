// lib/paywall/config.js
//
// Keys pricing (Oct 2026 scheme). UI-only on the paywall-ui branch: no
// payment provider, no server wallet. Every "Buy" goes to a stubbed
// checkout and Keys live in this browser's localStorage.
//
// On by default on this branch. Set NEXT_PUBLIC_PAYWALL=off to hide every
// lock, badge and pop-up and get the free product back unchanged.

export const PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL !== 'off';

// Stubbed checkout shows a "Simulate payment" button while this is true.
// Turn off once Razorpay is wired so nobody can mint Keys in production.
export const PAYWALL_MOCK = process.env.NEXT_PUBLIC_PAYWALL_MOCK !== 'off';

// Flat price: every report costs the same, whether it's the first on a
// property or another floor / facing / report type there.
export const KEY_COST = { report: 2 };

// What each gated thing is called in the UI, and what an unlock of it
// also opens. A full report already contains the area write-up and the
// sun & shadow analysis for that flat, so unlocking it covers both.
export const REPORT_TYPES = {
  neighbourhood: { label: 'Detailed neighbourhood report', short: 'Neighbourhood', perUnit: false },
  sun: { label: 'Year-round sunlight report', short: 'Sun & shadow', perUnit: true },
  full: { label: 'Full BlindSpot report', short: 'Full report', perUnit: true, includes: ['neighbourhood', 'sun'] },
};

export const PACKS = [
  { id: 'basic', name: 'Basic', keys: 6, price: 299, fits: '3 reports' },
  { id: 'explorer', name: 'Explorer', keys: 18, price: 799, fits: '9 reports, a full house hunt', tag: 'Most picked' },
  { id: 'investor', name: 'Investor', keys: 30, price: 1199, fits: '15 reports, for investors and brokers' },
  { id: 'pro', name: 'Pro', keys: 50, price: 1899, fits: '25 reports, for brokers and builders' },
];

// Estimated cost to generate one AI report, used on /pricing.
export const REPORT_COST_INR = 50;

export const perKey = (p) => p.price / p.keys;
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const inr2 = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const keysWord = (n) => `${n} ${n === 1 ? 'Key' : 'Keys'}`;

// One "property" = one building-sized spot (4 decimals of lat/lon, about
// 11 m). Used to remember what's unlocked where, not to change the price.
export const propertyKey = (lat, lon) =>
  (Number.isFinite(lat) && Number.isFinite(lon)) ? `${lat.toFixed(4)},${lon.toFixed(4)}` : null;
