// lib/compare/derive.js
//
// The arithmetic behind the comparison, and the URL codec that makes a
// comparison shareable. Pure functions -- no React, no fetch -- so the
// numbers can be checked without a browser, and so it is obvious from this
// one file which of them are measured and which are assumed.
//
// The rule: every number is either (a) typed in by the buyer, (b) measured
// from the address, or (c) arithmetic on (a) and (b) that anyone could redo
// by hand. There is no fourth category. Nothing here predicts a price, a
// rent, or an appreciation rate.

export const FACINGS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

// Stamp duty and registration are published, but they move with state
// budgets and vary by buyer gender and value slab. So they are DEFAULTS the
// buyer overwrites in a visible field, never applied silently -- a wrong
// duty baked invisibly into a total is worse than no total.
export const DUTY_DEFAULTS = {
  Bangalore:  { stampPct: 5.0, regPct: 1.0 },
  Delhi:      { stampPct: 6.0, regPct: 1.0 },
  Mumbai:     { stampPct: 6.0, regPct: 1.0 },
  Hyderabad:  { stampPct: 4.0, regPct: 0.5 },
  Chandigarh: { stampPct: 6.0, regPct: 1.0 },
  // TN stamp duty 7% + registration fee 4% -- confirmed cleartax.in.
  Chennai:    { stampPct: 7.0, regPct: 4.0 },
  _default:   { stampPct: 5.0, regPct: 1.0 },
};
export const dutyFor = (city) => DUTY_DEFAULTS[city] || DUTY_DEFAULTS._default;

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[, ₹]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function inr(v, { compact = false } = {}) {
  if (v == null || !Number.isFinite(v)) return ' - ';
  const n = Math.round(v);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (compact) {
    if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  }
  return `${sign}₹${a.toLocaleString('en-IN')}`;
}

const HOT = new Set(['March','April','May','June','July','August','September','October']);
const WINTER = ['November', 'December', 'January'];
const SUMMER = ['April', 'May', 'June'];

export function avgMonths(monthly, names) {
  if (!Array.isArray(monthly)) return null;
  const hit = monthly.filter((m) => names.includes(m.month));
  if (!hit.length) return null;
  return hit.reduce((s, m) => s + (num(m.usableHours) ?? 0), 0) / hit.length;
}
export const winterSun = (monthly) => avgMonths(monthly, WINTER);
export const summerSun = (monthly) => avgMonths(monthly, SUMMER);

/**
 * A rough annual cooling cost -- the one modelled number in the whole tool.
 *
 * The measured half is real: how many hours of direct sun this facade gets
 * in each hot month, from solar geometry (scripts/validate-solar.mjs shows
 * that geometry agreeing with JPL-derived ephemerides to 0.01 degrees).
 * The conversion to rupees is not measured -- it assumes an AC load and a
 * tariff, both of which the buyer can change and both of which the UI shows
 * beside the answer. Returns null when there is nothing measured to work
 * from, rather than a plausible number with nothing behind it.
 */
export function coolingPerYear(monthly, { kw = 1.2, tariff = 8 } = {}) {
  if (!Array.isArray(monthly) || !monthly.length) return null;
  const k = num(kw), t = num(tariff);
  if (!(k > 0) || !(t > 0)) return null;
  let hours = 0, counted = 0;
  for (const m of monthly) {
    if (!HOT.has(m.month)) continue;          // winter sun is a benefit, not a cost
    const h = num(m.usableHours);
    if (h == null) continue;
    hours += h * 30.4;
    counted++;
  }
  return counted ? Math.round(hours * k * t) : null;
}

/**
 * Everything derivable for one property. Any field that cannot be worked
 * out comes back null, never 0 -- a missing maintenance charge is not a
 * maintenance charge of zero, and zero would quietly flatter that column.
 */
export function derive(inputs = {}, measured = {}) {
  const price      = num(inputs.price);
  const quotedArea = num(inputs.quotedArea);
  const carpetArea = num(inputs.carpetArea);
  const furnishing = num(inputs.furnishing);
  const parking    = num(inputs.parking);
  const brokerage  = num(inputs.brokerage);
  const maintPsf   = num(inputs.maintenancePsf);
  const stampPct   = num(inputs.stampPct);
  const regPct     = num(inputs.regPct);
  const gstPct     = num(inputs.gstPct);
  const years      = num(inputs.years) ?? 10;
  const esc        = num(inputs.maintEscalationPct) ?? 6;

  // The gap between the area you are sold and the area you can stand in.
  // Quoted on super built-up across the whole market, which is what makes
  // two builders' per-sqft numbers incomparable.
  const loadingPct = (quotedArea && carpetArea && quotedArea > 0 && carpetArea <= quotedArea)
    ? ((quotedArea - carpetArea) / quotedArea) * 100 : null;

  const psfQuoted = (price && quotedArea) ? price / quotedArea : null;
  const psfCarpet = (price && carpetArea) ? price / carpetArea : null;

  const stampDuty = (price != null && stampPct != null) ? price * stampPct / 100 : null;
  const regFee    = (price != null && regPct   != null) ? price * regPct   / 100 : null;
  const gst       = (price != null && gstPct   != null) ? price * gstPct   / 100 : null;

  const acqParts = [price, stampDuty, regFee, gst, parking, brokerage, furnishing];
  const acquisition = acqParts.some((v) => v != null)
    ? acqParts.reduce((s, v) => s + (v ?? 0), 0) : null;

  // Compounded, not multiplied flat -- societies revise, and over ten years
  // the difference between the two is not small.
  let maintenanceTotal = null;
  if (maintPsf != null && quotedArea) {
    let annual = maintPsf * quotedArea * 12;
    maintenanceTotal = 0;
    for (let y = 0; y < years; y++) { maintenanceTotal += annual; annual *= 1 + esc / 100; }
  }

  const coolingAnnual = coolingPerYear(measured.solar?.monthlySummary, {
    kw: inputs.coolingLoadKw, tariff: inputs.tariffPerKwh,
  });
  const coolingTotal = coolingAnnual != null ? coolingAnnual * years : null;

  const runParts = [maintenanceTotal, coolingTotal];
  const running = runParts.some((v) => v != null) ? runParts.reduce((s, v) => s + (v ?? 0), 0) : null;
  const horizonTotal = (acquisition != null || running != null)
    ? (acquisition ?? 0) + (running ?? 0) : null;

  return {
    price, quotedArea, carpetArea, loadingPct, psfQuoted, psfCarpet,
    stampDuty, regFee, gst, parking, brokerage, furnishing,
    acquisition, maintenanceTotal, coolingAnnual, coolingTotal, running,
    horizonTotal, years,
  };
}

/**
 * What the price gap actually buys.
 *
 * Every clause it produces is the difference between two numbers already on
 * screen. It names no winner: the weighting between money and light and
 * everything else belongs to the buyer, and answering it for them would be
 * investment advice on their largest purchase.
 */
export function difference(a, b) {
  if (!a || !b) return null;
  const total = (p) => p.derived?.horizonTotal ?? p.derived?.acquisition ?? p.derived?.price;
  const at = total(a), bt = total(b);
  if (at == null || bt == null) return null;

  // horizonTotal above folds acquisition and running costs into one figure,
  // but treats a missing half as zero (see derive()) so that a running
  // total still comes out even with no acquisition at all. That is correct
  // for horizonTotal itself -- a partial total is still worth showing on
  // its own row -- but it means `at`/`bt` here can be built entirely from
  // modelled running costs (right now: cooling) with zero quoted price on
  // either side. A verdict banner built on that number is real money, but
  // it is not what either flat costs to buy, and saying "costs more" would
  // claim more than the data backs -- the same rule the rest of this file
  // follows (a blank number never quietly becomes a confident one).
  const pricedA = a.derived?.acquisition != null;
  const pricedB = b.derived?.acquisition != null;
  const basis = (pricedA && pricedB) ? 'price' : 'estimate';
  const basisNote = basis === 'price' ? null : (!pricedA && !pricedB
    ? 'Neither flat has a quoted price yet, so this is a running-cost estimate, not what they cost to buy.'
    : 'One of these flats has no quoted price yet, so this is a running-cost estimate, not what they cost to buy.');

  const cheaper = at <= bt ? a : b;
  const dearer  = at <= bt ? b : a;
  const gap = Math.abs(bt - at);

  const buys = [], gives = [];
  const put = (up, down, text) => (up ? buys : gives).push(text);

  const wc = winterSun(cheaper.measured?.solar?.monthlySummary);
  const wd = winterSun(dearer.measured?.solar?.monthlySummary);
  if (wc != null && wd != null && Math.abs(wd - wc) >= 0.25) {
    const d = wd - wc, n = Math.abs(d);
    put(d > 0, d < 0, `${n.toFixed(1)} ${n < 2 ? 'hour' : 'hours'} ${d > 0 ? 'more' : 'less'} winter sun a day`);
  }

  const lc = cheaper.derived?.loadingPct, ld = dearer.derived?.loadingPct;
  if (lc != null && ld != null && Math.abs(ld - lc) >= 1) {
    const d = lc - ld;
    put(d > 0, d < 0, d > 0
      ? `${d.toFixed(0)}% less loading - more carpet per rupee`
      : `${Math.abs(d).toFixed(0)}% more loading`);
  }

  const cc = cheaper.derived?.coolingAnnual, cd = dearer.derived?.coolingAnnual;
  if (cc != null && cd != null && Math.abs(cd - cc) >= 1000) {
    const d = cc - cd;
    put(d > 0, d < 0, `about ${inr(Math.abs(d))} a year ${d > 0 ? 'less' : 'more'} on cooling`);
  }

  const uc = num(cheaper.measured?.unit?.score), ud = num(dearer.measured?.unit?.score);
  if (uc != null && ud != null && Math.abs(ud - uc) >= 3) {
    const d = ud - uc;
    put(d > 0, d < 0, `${Math.abs(d)} points ${d > 0 ? 'higher' : 'lower'} on the unit score`);
  }

  const ac = num(cheaper.measured?.area?.score), ad = num(dearer.measured?.area?.score);
  if (ac != null && ad != null && Math.abs(ad - ac) >= 3) {
    const d = ad - ac;
    put(d > 0, d < 0, `${Math.abs(d)} points ${d > 0 ? 'higher' : 'lower'} on the neighbourhood`);
  }

  return { cheaper, dearer, gap, buys, gives, basis, basisNote };
}

// ── Shareable state ─────────────────────────────────────────────────────
//
// The comparison lives in the URL, not in an account. A buyer works out
// which flat wins and the next thing they do is send it to whoever they are
// buying with -- that should be a link, not "sign up and I'll share a
// folder with you". It also means refresh and back both work, and we store
// nothing about what anyone was quoted.
//
// Compact keys because this ends up in a URL someone pastes into WhatsApp.
const K = {
  n: 'name', a: 'lat', o: 'lon', p: 'pin', c: 'city', f: 'floor', d: 'facing',
  P: 'price', Q: 'quotedArea', C: 'carpetArea', F: 'furnishing', K: 'parking',
  B: 'brokerage', M: 'maintenancePsf', S: 'stampPct', R: 'regPct', G: 'gstPct',
};
const KR = Object.fromEntries(Object.entries(K).map(([k, v]) => [v, k]));

export function encodeSlots(slots) {
  const packed = slots
    .filter((s) => s && s.lat != null && s.lon != null)
    .map((s) => {
      const o = {};
      for (const [full, short] of Object.entries(KR)) {
        const v = s[full] ?? s.inputs?.[full];
        if (v !== undefined && v !== null && v !== '') o[short] = v;
      }
      return o;
    });
  if (!packed.length) return '';
  try {
    // base64url so it survives a paste into any chat app unmangled.
    return btoa(unescape(encodeURIComponent(JSON.stringify(packed))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch { return ''; }
}

export function decodeSlots(s) {
  if (!s) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    return arr.slice(0, 3).map((o) => {
      const out = { inputs: {} };
      for (const [short, full] of Object.entries(K)) {
        if (o[short] === undefined) continue;
        if (['name', 'lat', 'lon', 'pin', 'city', 'floor', 'facing'].includes(full)) out[full] = o[short];
        else out.inputs[full] = String(o[short]);
      }
      return out;
    });
  } catch { return null; }
}
