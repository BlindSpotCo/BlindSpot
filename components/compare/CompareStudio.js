'use client';
// components/compare/CompareStudio.js
//
// Pick two or three flats, get an answer. No account, no reports to
// generate first, nothing saved -- the whole comparison lives in the URL,
// so it survives a refresh and, more to the point, it is a link you can
// send to whoever you are buying with.
//
// Three rules the layout follows:
//
//  1. Measure before you ask. An address, a floor and a facing are enough
//     to fill the sun, shadow and neighbourhood rows. The money fields sit
//     empty and invite typing afterwards. Nobody is asked for anything
//     before being shown something.
//  2. Every number says where it came from -- quoted by a builder,
//     measured by us, or arithmetic on the two. A blank stays blank rather
//     than defaulting to zero, which would quietly flatter that column.
//  3. It never names a winner. It says what the price gap buys and leaves
//     the weighing to the person spending the money.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FACINGS, derive, difference, inr, dutyFor, winterSun, summerSun,
  encodeSlots, decodeSlots,
} from '@/lib/compare/derive';
import { SunStrip, SunLines } from './SunStrip';

// Re-stepped from BlindSpot's own wine / gold / olive so the three read
// apart for colour-blind viewers too -- the brand's literal --av, --ss and
// --brand fail CVD separation against each other (deutan dE 3.0). Validated:
// CVD dE 10.4, normal-vision dE 20.7. The gold sits at 2.68:1 on the page
// ground, under the 3:1 mark, which is why every property is also named in
// text beside its colour rather than identified by colour alone.
const HUES = ['#A02845', '#CE8A22', '#4E7A22'];
const MAX_SLOTS = 3;

const emptySlot = () => ({
  key: Math.random().toString(36).slice(2),
  name: '', lat: null, lon: null, pin: null, city: null,
  floor: '', facing: 'East', inputs: {}, measured: null, loading: false, error: null,
});

export default function CompareStudio({ initial }) {
  const [slots, setSlots] = useState(() => {
    const seeded = (initial || []).map((s) => ({
      ...emptySlot(), ...s, floor: s.floor ?? '', facing: s.facing || 'East', inputs: s.inputs || {},
    }));
    while (seeded.length < 2) seeded.push(emptySlot());
    return seeded;
  });
  const [copied, setCopied] = useState(false);
  const [openMoney, setOpenMoney] = useState(false);

  const patch = useCallback((key, f) => setSlots((p) => p.map((s) => (s.key === key ? { ...s, ...f } : s))), []);
  const patchInput = useCallback((key, field, value) =>
    setSlots((p) => p.map((s) => (s.key === key ? { ...s, inputs: { ...s.inputs, [field]: value } } : s))), []);

  // Measure whenever address / floor / facing settle. Keyed on exactly those
  // four values so retyping a price never refetches, and a stale reply from
  // a previous address can never land on a newer one.
  const sig = useRef({});
  useEffect(() => {
    for (const s of slots) {
      if (s.lat == null || s.lon == null) continue;
      const now = `${s.lat},${s.lon},${s.floor === '' ? 0 : s.floor},${s.facing}`;
      if (sig.current[s.key] === now) continue;
      sig.current[s.key] = now;
      patch(s.key, { loading: true, error: null });
      const qs = new URLSearchParams({
        lat: String(s.lat), lon: String(s.lon), floor: String(s.floor === '' ? 0 : s.floor),
        facing: s.facing, tzOffset: String(-new Date().getTimezoneOffset()),
      });
      if (s.pin) qs.set('pin', s.pin);
      fetch(`/api/compare/property?${qs}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('x'))))
        .then((d) => { if (sig.current[s.key] === now) patch(s.key, { measured: d, loading: false }); })
        .catch(() => { if (sig.current[s.key] === now) patch(s.key, { loading: false, error: "Couldn't measure this address just now." }); });
    }
  }, [slots, patch]);

  useEffect(() => {
    const enc = encodeSlots(slots);
    const url = new URL(window.location.href);
    if (enc) url.searchParams.set('c', enc); else url.searchParams.delete('c');
    window.history.replaceState(null, '', url.toString());
  }, [slots]);

  const cols = useMemo(() => slots.filter((s) => s.lat != null).map((s, i) => {
    const duty = dutyFor(s.city);
    const inputs = {
      stampPct: duty.stampPct, regPct: duty.regPct,
      years: 10, maintEscalationPct: 6, coolingLoadKw: 1.2, tariffPerKwh: 8, ...s.inputs,
    };
    return {
      ...s, inputs, derived: derive(inputs, s.measured || {}),
      hue: HUES[i % HUES.length], tag: String.fromCharCode(65 + i), label: shortName(s.name),
    };
  }), [slots]);

  const diff = cols.length === 2 ? difference(cols[0], cols[1]) : null;
  const anyMoney = cols.some((c) => c.derived.price != null);

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { /* clipboard blocked; the URL bar still holds it */ }
  };

  return (
    <div className="bx">
      <div className="bx-cards">
        {slots.map((s, i) => (
          <PropertyCard
            key={s.key} slot={s} tag={String.fromCharCode(65 + i)} hue={HUES[i % HUES.length]}
            bias={slots.find((x) => x.key !== s.key && x.lat != null) || null}
            onPatch={(f) => patch(s.key, f)}
            onRemove={slots.length > 1 ? () => setSlots((p) => p.filter((x) => x.key !== s.key)) : null}
          />
        ))}
        {slots.length < MAX_SLOTS && (
          <button type="button" className="bx-addcard" onClick={() => setSlots((p) => [...p, emptySlot()])}>
            <span className="bx-addcard-plus">+</span>
            <span className="bx-addcard-text">Add a third</span>
          </button>
        )}
      </div>

      {cols.length === 0 && (
        <p className="bx-empty">
          Search the first flat you&apos;re considering. The sun, the shadow and the neighbourhood
          fill in as soon as you set a floor and point the dial.
        </p>
      )}

      {diff && <Verdict diff={diff} />}

      {cols.length >= 2 && (
        <SunLines series={cols.map((c) => ({ label: c.tag, color: c.hue, monthly: c.measured?.solar?.monthlySummary }))} />
      )}

      {cols.length > 0 && (
        <>
          <Block title="What we measured" note="Computed from the address — not typed in, not modelled">
            <BarRow label="Unit score" cols={cols} pick={(c) => c.measured?.unit?.score} max={100} best="high" lead />
            <BarRow label="Neighbourhood" cols={cols} best="high" max={100}
                    pick={(c) => (c.measured?.areaCovered ? c.measured.area.score : null)}
                    blank={(c) => (c.measured && !c.measured.areaCovered ? 'outside our coverage' : null)} lead />
            <PlainRow label="Winter sun · Nov–Jan" cols={cols} best="high"
                      pick={(c) => winterSun(c.measured?.solar?.monthlySummary)} fmt={(v) => `${v.toFixed(1)} h/day`} />
            <PlainRow label="Summer sun · Apr–Jun" cols={cols} best="low" hint="More is not better"
                      pick={(c) => summerSun(c.measured?.solar?.monthlySummary)} fmt={(v) => `${v.toFixed(1)} h/day`} />
            <SubScores cols={cols} />
          </Block>

          <Block
            title="What you were quoted" note="Your numbers — nothing here comes from us"
            action={<button type="button" className="bx-toggle" onClick={() => setOpenMoney((v) => !v)} aria-expanded={openMoney}>
              {openMoney ? 'Hide the fields' : anyMoney ? 'Edit the figures' : 'Add what you were quoted'}
            </button>}
          >
            {openMoney || !anyMoney ? (
              <div className="bx-form">
                {cols.map((c) => (
                  <div className="bx-formcol" key={c.key}>
                    <span className="bx-formcol-h"><i className="bx-dot" style={{ background: c.hue }} />{c.tag} · {c.label}</span>
                    <Field label="Quoted price" v={c.inputs.price} on={(x) => patchInput(c.key, 'price', x)} pre="₹" />
                    <Field label="Quoted area" v={c.inputs.quotedArea} on={(x) => patchInput(c.key, 'quotedArea', x)} suf="sqft" />
                    <Field label="Carpet area" v={c.inputs.carpetArea} on={(x) => patchInput(c.key, 'carpetArea', x)} suf="sqft"
                           hint="On the agreement, not the brochure" />
                    <Field label="Furnishing" v={c.inputs.furnishing} on={(x) => patchInput(c.key, 'furnishing', x)} pre="₹" />
                    <Field label="Parking" v={c.inputs.parking} on={(x) => patchInput(c.key, 'parking', x)} pre="₹" />
                    <Field label="Brokerage" v={c.inputs.brokerage} on={(x) => patchInput(c.key, 'brokerage', x)} pre="₹" />
                    <Field label="Maintenance" v={c.inputs.maintenancePsf} on={(x) => patchInput(c.key, 'maintenancePsf', x)} pre="₹" suf="/sqft/mo" />
                    <Field label="Stamp duty" v={c.inputs.stampPct} on={(x) => patchInput(c.key, 'stampPct', x)} suf="%"
                           hint="Prefilled for the city — rates move, check yours" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <PlainRow label="Quoted price" cols={cols} pick={(c) => c.derived.price} fmt={(v) => inr(v, { compact: true })} />
                <PlainRow label="Carpet area" cols={cols} pick={(c) => c.derived.carpetArea} fmt={(v) => `${v} sqft`} best="high" />
              </>
            )}
          </Block>

          {anyMoney && (
            <Block title="What that actually works out to" note="Arithmetic on the figures above — check it yourself">
              <PlainRow label="Loading factor" cols={cols} best="low" hint="How much of what you pay for you can't stand in"
                        pick={(c) => c.derived.loadingPct} fmt={(v) => `${v.toFixed(1)}%`} />
              {/* Deliberately unmarked. The quoted per-sqft is the misleading
                  number; a winner's tick on the lower one would endorse
                  exactly the comparison the row beneath exists to correct. */}
              <PlainRow label="Per sqft — as quoted" cols={cols} pick={(c) => c.derived.psfQuoted} fmt={(v) => inr(v)} />
              <PlainRow label="Per sqft — of carpet" cols={cols} best="low" hero
                        hint="The only per-sqft number that compares two quotes honestly"
                        pick={(c) => c.derived.psfCarpet} fmt={(v) => inr(v)} />
              <PlainRow label="All-in, to own it" cols={cols} best="low"
                        pick={(c) => c.derived.acquisition} fmt={(v) => inr(v, { compact: true })} />
              <PlainRow label="Cooling, per year" cols={cols} best="low" hint="From this facade's measured summer sun"
                        pick={(c) => c.derived.coolingAnnual} fmt={(v) => inr(v)} />
              <PlainRow label="Ten years, all in" cols={cols} best="low" hero
                        pick={(c) => c.derived.horizonTotal} fmt={(v) => inr(v, { compact: true })} />
            </Block>
          )}

          <div className="bx-foot">
            <button type="button" className="bx-copy" onClick={copy}>
              {copied ? 'Link copied' : 'Copy a link to this comparison'}
            </button>
            <p>
              The whole comparison is in that link. Nothing is stored on our side — not the addresses,
              not what you were quoted. And we don&apos;t tell you which flat to buy: how you weigh
              money against light is yours to decide.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const shortName = (n) => (!n ? 'Property' : (n.split(',').slice(0, 2).join(',').trim() || n));

// ── One property ────────────────────────────────────────────────────────
function PropertyCard({ slot, tag, hue, bias, onPatch, onRemove }) {
  const m = slot.measured;
  return (
    <article className={`bx-card${slot.lat != null ? ' on' : ''}`} style={{ '--hue': hue }}>
      <header className="bx-card-h">
        <span className="bx-tag">{tag}</span>
        {onRemove && <button type="button" className="bx-x" onClick={onRemove} aria-label={`Remove property ${tag}`}>×</button>}
      </header>

      <AddressField
        value={slot.name}
        bias={bias}
        onPick={(r) => onPatch({ name: r.displayName, lat: r.lat, lon: r.lon, pin: r.postcode, city: r.city })}
        onClear={() => onPatch({ name: '', lat: null, lon: null, pin: null, city: null, measured: null })}
      />

      {slot.lat != null && (
        <>
          <div className="bx-unit">
            <label className="bx-unit-f">
              <span>Floor</span>
              <input type="text" inputMode="numeric" value={slot.floor} placeholder="0"
                     onChange={(e) => {
                       const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                       onPatch({ floor: v === '' ? '' : String(Math.min(120, parseInt(v, 10))) });
                     }} />
            </label>
            <Dial value={slot.facing} onChange={(f) => onPatch({ facing: f })} hue={hue} />
          </div>

          {slot.loading && <p className="bx-state">Measuring…</p>}
          {slot.error && <p className="bx-state err">{slot.error}</p>}

          {!slot.loading && m?.unit && (
            <>
              <div className="bx-scores">
                <Stat n={m.unit.score} k="unit" hue={hue} />
                <Stat n={m.areaCovered ? m.area.score : null} k="area" hue={hue}
                      sub={m.areaCovered ? m.area.name : 'not covered'} />
              </div>
              <SunStrip monthly={m.solar?.monthlySummary} color={hue} />
            </>
          )}
        </>
      )}
    </article>
  );
}

function Stat({ n, k, hue, sub }) {
  return (
    <div className="bx-stat">
      <b style={{ color: n == null ? 'var(--text-dim)' : hue }}>{n == null ? '—' : n}</b>
      <span>{k}</span>
      {sub && <i>{sub}</i>}
    </div>
  );
}

// ── Address search ──────────────────────────────────────────────────────
function AddressField({ value, bias, onPick, onClear }) {
  const [q, setQ] = useState(value || '');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // A geocoder that is down and a genuine no-match used to render the same
  // sentence, which makes a broken search look like a fussy one -- the user
  // types more and more of the address wondering what is wrong with it.
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  const seq = useRef(0);

  useEffect(() => { setQ(value || ''); }, [value]);
  useEffect(() => {
    // Two characters, matching what the API itself accepts -- Photon's
    // edge-ngram index returns usable matches from two, and making people
    // type three before anything appears reads as a dead box.
    if (!open || q.trim().length < 2) { setRes([]); return; }
    const mine = ++seq.current;
    setBusy(true); setFailed(false);
    // 280ms: long enough not to hammer two free geocoders on every keystroke.
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (bias) { params.set('lat', String(bias.lat)); params.set('lon', String(bias.lon)); }
      fetch(`/api/sunscout/geocode-suggest?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d) => { if (seq.current === mine) setRes(d.results || []); })
        .catch(() => { if (seq.current === mine) { setRes([]); setFailed(true); } })
        .finally(() => { if (seq.current === mine) setBusy(false); });
    }, 280);
    return () => clearTimeout(t);
  }, [q, open, bias]);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  return (
    <div className="bx-addr" ref={box}>
      <input className="bx-addr-in" type="text" value={q} placeholder="Search an address or society"
             aria-label="Property address"
             onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onClear(); }}
             onFocus={() => setOpen(true)} />
      {q && <button type="button" className="bx-addr-x" onClick={() => { setQ(''); onClear(); }} aria-label="Clear">×</button>}
      {open && q.trim().length >= 2 && (
        <div className="bx-menu" role="listbox">
          {busy && !res.length && <p className="bx-menu-note">Searching…</p>}
          {!busy && failed && (
            <p className="bx-menu-note err">
              The address lookup didn&apos;t answer. That&apos;s the map service, not your search —
              try again in a moment.
            </p>
          )}
          {!busy && !failed && !res.length && <p className="bx-menu-note">No match for that yet — keep typing.</p>}
          {res.slice(0, 6).map((r, i) => (
            <button key={`${r.lat},${r.lon},${i}`} type="button" className="bx-menu-it" role="option" aria-selected="false"
                    onClick={() => { onPick(r); setQ(r.displayName); setOpen(false); }}>
              <span>{r.displayName}</span>
              {r.postcode && <i>{r.postcode}</i>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A direction is a thing you point at, not eight strings in a select. It
// also matches the compass on the 3D map, so East is the same gesture in
// both places.
function Dial({ value, onChange, hue }) {
  const R = 30, c = 36;
  return (
    <div className="bx-dial">
      <svg width="72" height="72" viewBox="0 0 72 72" role="radiogroup" aria-label="Which way the flat faces">
        <circle cx={c} cy={c} r={R} className="bx-dial-ring" />
        {FACINGS.map((f, i) => {
          const a = (i * 45 - 90) * Math.PI / 180;
          const x = c + Math.cos(a) * R * 0.74, y = c + Math.sin(a) * R * 0.74;
          const on = f === value;
          return (
            <g key={f} role="radio" aria-checked={on} aria-label={f} tabIndex={0} className={`bx-dial-pt${on ? ' on' : ''}`}
               onClick={() => onChange(f)}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(f); } }}>
              <circle cx={x} cy={y} r={9} fill="transparent" />
              <circle cx={x} cy={y} r={on ? 6.5 : 2.8} fill={on ? hue : 'currentColor'} />
            </g>
          );
        })}
      </svg>
      <span className="bx-dial-n">{value}</span>
    </div>
  );
}

// ── Verdict ─────────────────────────────────────────────────────────────
function Verdict({ diff }) {
  const { cheaper, dearer, gap, buys, gives } = diff;
  if (!gap) return null;
  return (
    <section className="bx-verdict">
      <p className="bx-verdict-lead">
        <em>{dearer.tag}</em> costs <b>{inr(gap, { compact: true })} more</b> than <em>{cheaper.tag}</em>.
      </p>
      {buys.length > 0 && (
        <p className="bx-verdict-l"><span className="bx-chip buys">For that you get</span>{buys.join(' · ')}</p>
      )}
      {gives.length > 0 && (
        <p className="bx-verdict-l"><span className="bx-chip gives">And you give up</span>{gives.join(' · ')}</p>
      )}
      {!buys.length && !gives.length && (
        <p className="bx-verdict-l thin">Add the prices and areas and this will say what the gap buys you.</p>
      )}
    </section>
  );
}

// ── Rows ────────────────────────────────────────────────────────────────
function Block({ title, note, action, children }) {
  return (
    <section className="bx-block">
      <header className="bx-block-h">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
        {action}
      </header>
      <div className="bx-rows">{children}</div>
    </section>
  );
}

function bestOf(vals, dir) {
  const real = vals.map((v, i) => [v, i]).filter(([v]) => typeof v === 'number' && Number.isFinite(v));
  if (real.length < 2 || new Set(real.map(([v]) => v)).size < 2) return -1;   // a tie has no winner
  return real.reduce((a, c) => (dir === 'low' ? (c[0] < a[0] ? c : a) : (c[0] > a[0] ? c : a)))[1];
}

function RowShell({ label, hint, hero, children }) {
  return (
    <div className={`bx-row${hero ? ' hero' : ''}`}>
      <div className="bx-row-l">
        <span>{label}</span>
        {hint && <i>{hint}</i>}
      </div>
      <div className="bx-row-v">{children}</div>
    </div>
  );
}

function PlainRow({ label, hint, hero, cols, pick, fmt, best }) {
  const vals = cols.map(pick);
  const bi = best ? bestOf(vals, best) : -1;
  return (
    <RowShell label={label} hint={hint} hero={hero}>
      {cols.map((c, i) => {
        const v = vals[i];
        const has = v != null && v !== '' && (typeof v !== 'number' || Number.isFinite(v));
        return (
          <span key={c.key} className={`bx-v${i === bi ? ' win' : ''}`}>
            <i className="bx-dot" style={{ background: c.hue }} aria-hidden="true" />
            <b>{has ? fmt(v) : '—'}</b>
          </span>
        );
      })}
    </RowShell>
  );
}

function BarRow({ label, hint, cols, pick, max = 100, best, blank, lead }) {
  const vals = cols.map(pick);
  const bi = best ? bestOf(vals, best) : -1;
  return (
    <RowShell label={label} hint={hint} hero={lead}>
      {cols.map((c, i) => {
        const v = vals[i];
        const has = typeof v === 'number' && Number.isFinite(v);
        return (
          <span key={c.key} className={`bx-bar${i === bi ? ' win' : ''}`}>
            <span className="bx-bar-track">
              <span className="bx-bar-fill" style={{ width: has ? `${Math.max(2, (v / max) * 100)}%` : 0, background: c.hue }} />
            </span>
            <b style={{ color: has ? c.hue : 'var(--text-dim)' }}>{has ? v : (blank?.(c) || '—')}</b>
          </span>
        );
      })}
    </RowShell>
  );
}

// Only the dimensions every column actually has -- a row of dashes teaches
// nothing.
function SubScores({ cols }) {
  const keys = [];
  for (const c of cols) for (const s of c.measured?.unit?.subScores || []) {
    if (!keys.find((k) => k.key === s.key)) keys.push({ key: s.key, label: s.label });
  }
  return keys.map(({ key, label }) => (
    <BarRow key={key} label={label} cols={cols} best="high"
            pick={(c) => c.measured?.unit?.subScores?.find((s) => s.key === key)?.score} />
  ));
}

function Field({ label, v, on, pre, suf, hint }) {
  return (
    <label className="bx-field">
      <span className="bx-field-l">{label}{hint && <i>{hint}</i>}</span>
      <span className="bx-field-in">
        {pre && <em>{pre}</em>}
        <input type="text" inputMode="decimal" value={v ?? ''} placeholder="—" onChange={(e) => on(e.target.value)} />
        {suf && <em>{suf}</em>}
      </span>
    </label>
  );
}
