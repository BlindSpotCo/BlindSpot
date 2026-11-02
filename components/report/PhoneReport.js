'use client';

// components/report/PhoneReport.js
//
// The report page on phones (<= 640px) only. Desktop keeps ReportScreen's
// own layout untouched; ReportScreen swaps this in for its verdict
// sections when useIsPhone() is true.
//
// One page, four views:
//   page   -- address and flat, one sentence from the sun model, a button
//             into the sun view (the 3D map lives there, not on the page), then two neutral lists (your flat, the area): what each item
//             covers, tap for the data and what to check. The area summary
//             names only what it holds strong in. No scores on
//             the page. The three reports sit in a bar at the bottom.
//   item   -- one row opened: what it looks at, any plain facts we have,
//             and what to check (no comparisons).
//   sun    -- the 3D map, with season / play / time and the
//             month-by-month hours.
//
// Wording: no verdict words (good / poor / strong / weak / risk). Every line
// says where it comes from -- "in our data", "our sun model" -- because we
// can rank against our own records and estimate from our model, and that
// is all we can claim.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ChevronRight, X, Play, Pause, MapPin, Sun, FileText, Map as MapIcon,
  ShieldCheck, GraduationCap, Wind, Droplets, Zap, Route, Building2, Waves,
  Thermometer, Eye, Lock, Fan, CloudRain, Volume2, Scale, Sofa,
} from 'lucide-react';
import { AREA_ACTIONS, UNIT_ACTIONS } from '@/lib/property-score/actionItems';
import { sunLine as sunLineOf, areaLine as areaLineOf } from '@/lib/report/summaryLines';
import { hrs, none, sunStats, areaFact, flatFact, tagScore } from '@/lib/report/facts';
import './phone.css';

const ICONS = {
  crime: ShieldCheck, schools: GraduationCap, air: Wind, water: Droplets, power: Zap,
  roads: Route, infrastructure: Building2, sewerage: Waves,
  sun: Sun, shadeHeat: Thermometer, view: Eye, privacy: Lock, wind: Fan, dampness: CloudRain, noise: Volume2,
};

const AREA_ORDER = ['crime', 'schools', 'air', 'water', 'power', 'roads', 'infrastructure', 'sewerage'];

const AREA_NAMES = {
  crime: 'Safety records',
  schools: 'Schools nearby',
  air: 'Air quality',
  water: 'Water supply',
  power: 'Power supply',
  roads: 'Roads',
  infrastructure: 'Transport',
  sewerage: 'Drainage',
};

// What each area number is built from, in plain words.
const AREA_MEASURES = {
  crime: 'This looks at recorded crime, compared with other localities in the city.',
  schools: 'This looks at how many schools are within reach, and their boards.',
  air: 'This looks at air quality across the year.',
  water: 'This looks at supply hours, coverage and water quality.',
  power: 'This looks at how often the power goes, and for how long.',
  roads: 'This looks at road condition and when roads were last resurfaced.',
  infrastructure: 'This looks at metro, highways and what is planned nearby.',
  sewerage: 'This looks at drainage coverage, treatment and waterlogging.',
};

const FLAT_NAMES = {
  sun: 'Sunlight',
  shadeHeat: 'Summer sun',
  view: 'View',
  privacy: 'Privacy',
  wind: 'Airflow',
  dampness: 'Monsoon damp',
  noise: 'Road & rail noise',
};

// Why an item matters, in general terms -- what it can mean for living
// there. Shown under items worth looking into.
const WHY = {
  water: 'Daily supply hours decide whether homes rely on storage tanks or tankers in summer.',
  power: 'How often power goes decides how much backup matters, and backup is often part of maintenance.',
  roads: 'Road condition shapes the daily commute and how lanes hold up in the monsoon.',
  infrastructure: 'Metro and highway links shape how long and how predictable commutes are.',
  sewerage: 'Drainage decides how nearby lanes cope with heavy rain.',
  crime: 'Recorded crime is one input on how comfortable an area feels day and night.',
  schools: 'Matters most if you have, or plan for, school-going children.',
  air: 'Air quality is what you breathe at home every day, and it often changes with the season.',
  sun: 'Direct sun decides how bright rooms feel and how quickly damp corners dry.',
  shadeHeat: 'Summer sun on a side decides how warm those rooms get and how much AC runs.',
  view: 'Floor height decides how much sky you see and how close the next building feels.',
  privacy: 'Floor height decides how easily nearby buildings and the street can see in.',
  wind: 'Airflow decides how fresh rooms feel on still summer days.',
  dampness: 'Walls that take the monsoon rain can show seepage or peeling paint after the season.',
  noise: 'Roads or rail close by can carry noise indoors, mostly at rush hour.',
};

const CITY_NAMES = { Bangalore: 'Bengaluru' };

const SEASON_TABS = [
  { key: 'today', label: 'Today', month: null },
  { key: 'winter', label: 'Winter', month: 'December' },
  { key: 'spring', label: 'Spring', month: 'March' },
  { key: 'summer', label: 'Summer', month: 'June' },
  { key: 'autumn', label: 'Autumn', month: 'September' },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ord = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const monthYear = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};


// 'low' | 'high' | 'mid' against the same city's pincodes we cover.
function rankBand(rank) {
  if (!rank || !rank.total) return null;
  if (rank.higher / rank.total >= 0.6) return 'low';
  if (rank.lower / rank.total >= 0.6) return 'high';
  return 'mid';
}

function flatDetail(key, { sun, floor, facing }) {
  const side = `${String(facing).toLowerCase()}-facing`;
  switch (key) {
    case 'sun':
      return sun
        ? `Our sun model estimates about ${hrs(sun.avg)} of direct sun a day on this side, averaged over the year. Most in ${sun.best}, least in ${sun.worst}.`
        : 'Our sun model estimates how much direct sun reaches this side through the year.';
    case 'shadeHeat':
      return sun
        ? `From April to June our sun model estimates about ${hrs(sun.summer)} of direct sun a day on this ${side} side. More direct summer sun usually means warmer rooms.`
        : 'How much direct summer sun reaches this side, from our sun model.';
    case 'view':
      return `Estimated from the floor number (${ord(floor)}). It doesn’t know what actually stands in front of this building.`;
    case 'privacy':
      return `Estimated from the floor number (${ord(floor)}). It doesn’t know how close the neighbouring buildings are.`;
    case 'wind':
      return 'Based on today’s wind forecast and how high your floor is. It is not a year-round average.';
    case 'dampness':
      return `Based on how a ${side} wall meets the monsoon rain in this city.`;
    case 'noise':
      return 'Based on roads and rail lines mapped in OpenStreetMap near this spot. It is not a sound reading.';
    default:
      return '';
  }
}

// Rows, neutral: each says what it covers (or a plain fact from our data),
// never higher / lower. Grouped into your flat and the area. `strong` is
// used only for the one positive line at the top of the page.
const AREA_COVERS = {
  crime: 'Recorded crime, compared across the city',
  schools: 'Schools within reach and their boards',
  air: 'Air quality across the year',
  water: 'Supply hours, coverage and quality',
  power: 'How often the power goes, and for how long',
  roads: 'Road condition and resurfacing',
  infrastructure: 'Metro, highways and what’s planned nearby',
  sewerage: 'Drainage coverage and waterlogging',
};
const FLAT_ORDER = ['sun', 'shadeHeat', 'view', 'privacy', 'wind', 'dampness', 'noise'];
const FLAT_COVERS = {
  sun: 'Direct sun through the year, from our sun model',
  shadeHeat: 'Summer sun on this side, from our sun model',
  view: 'Estimated from your floor height',
  privacy: 'Estimated from your floor height',
  wind: 'From today’s wind forecast and your floor height',
  dampness: 'How this side meets the monsoon rain',
  noise: 'Roads and rail lines mapped nearby',
};


function buildItems({ area, unit, sun, floor, facing }) {
  const areaRows = [];
  if (area?.factors) {
    for (const key of AREA_ORDER) {
      const score = area.factors[key];
      if (typeof score !== 'number') continue;
      const rank = area.cityRank?.[key] || null;
      const facts = area.facts?.[key] || {};
      const covers = areaFact(key, area.raw, facts) || AREA_COVERS[key];
      areaRows.push({
        id: `a-${key}`, kind: 'area', key, score, name: AREA_NAMES[key], covers, facts,
        tagScore: tagScore(key, score, area.raw),
        strong: score >= 75 && rankBand(rank) === 'high',
      });
    }
  }
  const flatRows = [];
  for (const s of unit?.subScores || []) {
    if (s.pending || typeof s.score !== 'number' || !FLAT_NAMES[s.key]) continue;
    if (/unavailable|neutral score/i.test(s.summary || '')) continue;
    flatRows.push({ id: `f-${s.key}`, kind: 'flat', key: s.key, score: s.score, name: FLAT_NAMES[s.key], covers: flatFact(s.key, s, { sun, floor, facing }) || FLAT_COVERS[s.key] });
  }
  flatRows.sort((a, b) => FLAT_ORDER.indexOf(a.key) - FLAT_ORDER.indexOf(b.key));
  return { areaRows, flatRows, all: [...flatRows, ...areaRows] };
}

function FindingRow({ item, onOpen, rate }) {
  const Icon = ICONS[item.key];
  const ts = item.tagScore ?? item.score;
  const w = rate?.word(ts);
  return (
    <li>
      <button type="button" className="bsrp-find" onClick={() => onOpen(item.id)}>
        <span className="bsrp-bar-icon" aria-hidden="true">{Icon ? <Icon size={18} strokeWidth={2} /> : null}</span>
        <span className="bsrp-find-main">
          <span className="bsrp-find-top">
            <strong className="bsrp-find-name">{item.name}</strong>
            {w && <span className={`bsr-tag is-${rate.tone(ts)}`}>{w}</span>}
          </span>
          <span className="bsrp-find-why">{item.covers}</span>
        </span>
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
}


// Play/pause + time slider. While the day plays, the map reports its time
// (Map3DShadow posts 'simTime'), so the slider and clock follow it. Its own
// component so those updates don't re-render the whole report.
function SunTimeRow({ animating, setAnimating, minutes, setMinutes, clock }) {
  const [live, setLive] = useState(null);
  useEffect(() => {
    const on = (e) => {
      if (e?.data?.type !== 'simTime' || typeof e.data.time !== 'string') return;
      const [h, mm] = e.data.time.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(mm)) setLive(h * 60 + mm);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  const shown = animating && live != null ? live : minutes;
  return (
    <div className="bsrp-time">
      <button
        type="button"
        className="bsrp-play"
        onClick={() => { if (animating && live != null) setMinutes(Math.round(live / 10) * 10); setAnimating(!animating); }}
        aria-label={animating ? 'Pause the day' : 'Play the day'}
      >
        {animating ? <Pause size={16} strokeWidth={2.6} /> : <Play size={16} strokeWidth={2.6} />}
      </button>
      <label className="bsrp-slider">
        <span className="bsrp-visually-hidden">Time of day</span>
        <input
          type="range" min="330" max="1140" step="10" value={Math.min(1140, Math.max(330, shown))}
          onChange={(e) => { setAnimating(false); setMinutes(Number(e.target.value)); }}
        />
        <strong>{clock(shown)}</strong>
      </label>
    </div>
  );
}

export default function PhoneReport({
  view, setView, itemId, setItemId,
  area, unit, address, floor, facing, unitSet,
  onChangeFlat, onRequestReport, reportBusy, pinFixForm, pinFixOpen, setPinFixOpen,
  seasonKey, setSeasonKey, animating, setAnimating, minutes, setMinutes, clock, mapReady, overall, rate,
  compareHref, onUsePin, checks = [], ticked, onTick, notes = {}, onNote,
}) {
  const hasArea = Boolean(area);
  const sun = useMemo(() => sunStats(unit?.sunYear), [unit?.sunYear]);
  const { areaRows, flatRows, all } = useMemo(() => buildItems({ area, unit, sun, floor, facing }), [area, unit, sun, floor, facing]);
  const place = (address || '').replace(/,\s*India\s*$/i, '').split(',').slice(0, 2).join(',').trim() || 'This address';
  const city = CITY_NAMES[area?.city] || area?.city;
  // A six-digit pin in the address that isn't the one the area data is for
  // (the pin lookup sometimes lands on the pincode next door).
  const addrPins = Array.from(new Set(((address || '').match(/\b\d{6}\b/g) || [])));
  const pinClash = hasArea && addrPins.length && !addrPins.includes(area.pinCode) ? addrPins[0] : null;

  // iPhone Safari can still pan the whole page sideways when anything is a
  // hair too wide, whatever the containers say; clamp html and body to the
  // screen while this page is open.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('bsrp-lock-x');
    return () => root.classList.remove('bsrp-lock-x');
  }, []);

  // Overlays own the screen; stop the page scrolling behind them.
  useEffect(() => {
    if (view === 'page') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [view]);

  // Escape closes whatever is open.
  useEffect(() => {
    if (view === 'page') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setView('page'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, setView]);

  // A row can disappear under an open item (the noise score lands late,
  // the pincode changes) -- fall back to the page rather than a blank.
  useEffect(() => {
    if (view === 'item' && !all.some((x) => x.id === itemId)) setView('page');
  }, [view, itemId, all, setView]);

  // The report progress strip (ReportModal) sits at the bottom of the
  // screen on phones; lift it above the report bar the same way the map
  // step lifts it above its own bottom sheet (--bsr-dock-h).
  const dockRef = useRef(null);
  useEffect(() => {
    const el = dockRef.current;
    const root = document.documentElement;
    if (view !== 'page' || !el) return undefined;
    const update = () => root.style.setProperty('--bsr-dock-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--bsr-dock-h'); };
  }, [view]);

  const openItem = (id) => { setItemId(id); setView('item'); };
  const startReport = (type) => { setView('page'); onRequestReport(type); };

  // The three reports, always one tap away at the bottom of the page.
  // Neighbourhood opens the existing pincode page; Sun and Full start the
  // existing report flow (both need the 3D map, which they photograph).
  const busy = reportBusy || {};
  const reportBar = (
    <nav className="bsrp-dock" aria-label="Your reports" ref={dockRef}>
      {hasArea ? (
        <a className="bsrp-dock-btn" href={`/neighbourhood-report/${area.pinCode}`} target="_blank" rel="opener">
          <MapIcon size={18} strokeWidth={2} aria-hidden="true" />
          <span>Area report</span>
        </a>
      ) : (
        <span className="bsrp-dock-btn is-off" aria-disabled="true">
          <MapIcon size={18} strokeWidth={2} aria-hidden="true" />
          <span>Area report</span>
        </span>
      )}
      <button type="button" className="bsrp-dock-btn" disabled={!mapReady || busy.gallery} onClick={() => startReport('gallery')}>
        <Sun size={18} strokeWidth={2} aria-hidden="true" />
        <span>{busy.gallery ? 'Building…' : 'Sun report'}</span>
      </button>
      <button
        type="button"
        className="bsrp-dock-btn is-main"
        disabled={unitSet && (!mapReady || busy.full)}
        onClick={() => (unitSet ? startReport('full') : onChangeFlat())}
      >
        <FileText size={18} strokeWidth={2} aria-hidden="true" />
        <span>{busy.full ? 'Writing…' : 'Full report'}</span>
      </button>
    </nav>
  );

  const dec = sun?.by?.December?.hours;
  const jun = sun?.by?.June?.hours;
  // The two summary lines at the top (shared with the laptop layout).
  const sunLine = sunLineOf(unit?.sunYear);
  const areaLine = hasArea
    ? areaLineOf(area, `We looked at ${areaRows.length} things for pin ${area.pinCode} from public data. Tap any one below.`)
    : null;

  /* ---------------- item ---------------- */
  if (view === 'item') {
    const i = Math.max(0, all.findIndex((x) => x.id === itemId));
    const item = all[i];
    const next = all[(i + 1) % all.length];
    if (!item) return null;
    const check = item.kind === 'area'
      ? AREA_ACTIONS[item.key]
      : (typeof UNIT_ACTIONS[item.key] === 'function' ? UNIT_ACTIONS[item.key](facing) : UNIT_ACTIONS[item.key]);
    let detail = '';
    if (item.kind === 'area') {
      const f = areaFact(item.key, area?.raw, item.facts);
      detail = f ? `${f} ${AREA_MEASURES[item.key]}` : AREA_MEASURES[item.key];
    } else {
      const sub = (unit?.subScores || []).find((x) => x.key === item.key);
      const f = flatFact(item.key, sub, { sun, floor, facing });
      // View/privacy worked out from the buildings around: the summary
      // already says what was found and what it can't see.
      const d = sub?.source === 'buildings' && sub.summary ? '' : flatDetail(item.key, { sun, floor, facing });
      detail = sub?.source === 'buildings' && sub.summary
        ? sub.summary
        : f && !['sun', 'shadeHeat'].includes(item.key) ? `${f} ${d}` : d;
    }
    const updated = item.kind === 'area' ? monthYear(item.facts.asOf) : null;
    return (
      <div className="bsrp-sheet" role="dialog" aria-modal="true" aria-labelledby="bsrp-item-h">
        <div className="bsrp-sheet-top">
          <span className={`bsrp-tag is-${item.kind}`}>
            {item.kind === 'area' ? `Area · Pin ${area?.pinCode || ''}` : `Your flat · ${ord(floor)} floor, ${String(facing).toLowerCase()}`}
          </span>
          <button type="button" className="bsrp-icon-btn" onClick={() => setView('page')} aria-label="Close">
            <X size={22} strokeWidth={2} />
          </button>
        </div>
        <div className="bsrp-item-title">
          <h2 id="bsrp-item-h" className="bsrp-item-h">{item.name}</h2>
          {rate?.word(item.tagScore ?? item.score) && (
            <span className={`bsr-tag is-${rate.tone(item.tagScore ?? item.score)}`}>{rate.word(item.tagScore ?? item.score)}</span>
          )}
        </div>
        <p className="bsrp-item-p">{detail}</p>


        {WHY[item.key] && (
          <>
            <h3 className="bsrp-h3">Why it matters</h3>
            <p className="bsrp-item-why">{WHY[item.key]}</p>
          </>
        )}
        {(updated || item.facts?.modelled) && (
          <p className="bsrp-small">
            {updated ? `Data last updated ${updated}.` : ''}
            {item.facts?.modelled ? ' This one is a modelled estimate.' : ''}
          </p>
        )}

        {check && (
          <>
            <h3 className="bsrp-h3">Check on your visit</h3>
            <p className="bsrp-quote">{check}</p>
          </>
        )}
        {item.kind === 'area' && hasArea ? (
          <a className="bsrp-text-link" href={`/neighbourhood-report/${area.pinCode}`} target="_blank" rel="opener">
            Open the neighbourhood report <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </a>
        ) : (
          <button type="button" className="bsrp-text-link" onClick={() => setView('page')}>
            See your reports <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}

        <div className="bsrp-sheet-foot">
          <button type="button" className="bsrp-text-btn" onClick={() => setView('page')}>Back</button>
          {all.length > 1 && (
            <button type="button" className="bsrp-text-btn is-strong" onClick={() => setItemId(next.id)}>
              Next: {next.name} <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- sun ---------------- */
  if (view === 'sun') {
    const tab = SEASON_TABS.find((t) => t.key === seasonKey) || SEASON_TABS[0];
    const monthName = tab.month || MONTHS[new Date().getMonth()];
    const m = sun?.by?.[monthName];
    const year = unit?.sunYear || [];
    const max = Math.max(1, ...year.map((x) => x.hours || 0));
    const when = tab.key === 'today' ? 'today' : `on ${tab.label.toLowerCase()} days (${monthName})`;
    return (
      <>
      {/* Outside .bsrp-sun: that panel sits under the map (the map is the
          top of this view), and the back button has to sit over it. */}
      <button type="button" className="bsrp-icon-btn is-float" onClick={() => setView('page')} aria-label="Back">
        <ArrowLeft size={22} strokeWidth={2} />
      </button>
      <div className="bsrp-sun" role="dialog" aria-modal="true" aria-labelledby="bsrp-sun-h">
        <div className="bsrp-sun-body">
          {m && (
            <div className="bsrp-sun-now">
              <h2 id="bsrp-sun-h" className="bsrp-sun-say">
                {none(m.hours) ? `No direct sun on this side ${when}` : `${hrs(m.hours)} of direct sun ${when}`}
              </h2>
              <p className="bsrp-small">Sunrise {m.rise} · Sunset {m.set} · clear-sky estimate</p>
            </div>
          )}

          <p className="bsrp-seg-k" id="bsrp-seg-k">Pick a season</p>
          <div className="bsrp-seg" role="group" aria-labelledby="bsrp-seg-k">
            {SEASON_TABS.map((t) => (
              <button key={t.key} type="button" aria-pressed={seasonKey === t.key} onClick={() => setSeasonKey(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <SunTimeRow animating={animating} setAnimating={setAnimating} minutes={minutes} setMinutes={setMinutes} clock={clock} />

          {year.length === 12 && (
            <div className="bsrp-year">
              <h3 className="bsrp-h3">Direct sun through the year</h3>
              <div
                className="bsrp-bars"
                role="img"
                aria-label={`Estimated hours of direct sun per day: ${year.map((x) => `${x.month} ${hrs(x.hours)}`).join(', ')}`}
              >
                {year.map((x) => (
                  <span key={x.month} className={x.month === monthName ? 'is-on' : ''}>
                    {x.month === monthName && (
                      <em style={{ bottom: `calc(${Math.max(3, (x.hours / max) * 100)}% + 2px)` }}>{Math.round(x.hours * 10) / 10}h</em>
                    )}
                    <i style={{ height: `${Math.max(3, (x.hours / max) * 100)}%` }} />
                    <b>{x.month[0]}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="bsrp-sun-foot">
          <button type="button" className="bsrp-cta" disabled={!mapReady || reportBusy?.gallery} onClick={() => startReport('gallery')}>
            {reportBusy?.gallery ? 'Building the sun report…' : 'Get the sun report (PDF)'}
          </button>
        </div>
      </div>
      </>
    );
  }

  /* ---------------- page ---------------- */
  return (
    <div className="bsrp">
      {/* No map up here: people arrive from the map step, where they just
          picked the building. It stays loaded offscreen (the Sun and Full
          reports photograph it) and opens in the sun view below. */}
      <nav className="bsrp-bar" aria-label="BlindSpot">
        <Link href="/" className="bsrp-bar-home" aria-label="BlindSpot home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" width="22" height="22" />
          <span>BlindSpot</span>
        </Link>
        <span className="bsrp-bar-links">
          <Link href={compareHref || '/compare'}>Compare</Link>
          <Link href="/profile">My homes</Link>
        </span>
      </nav>
      <header className="bsrp-head">
        <p className="bsrp-place">
          <MapPin size={15} strokeWidth={2.4} aria-hidden="true" />
          <span>{place}</span>
        </p>
        {unitSet ? (
          <p className="bsrp-unit">
            {ord(floor)} floor · faces {String(facing).toLowerCase()} ·{' '}
            <button type="button" className="bsrp-link" onClick={onChangeFlat}>Change</button>
          </p>
        ) : (
          <p className="bsrp-unit is-warn">
            Floor and facing not set, so flat findings are for a typical flat ·{' '}
            <button type="button" className="bsrp-link" onClick={onChangeFlat}>Set them</button>
          </p>
        )}
        {pinClash && (
          <p className="bsrp-pinclash">
            Area data is for pin {area.pinCode}, but your address shows {pinClash}.{' '}
            <button type="button" className="bsrp-link" onClick={() => onUsePin?.(pinClash)}>Use {pinClash}</button>
          </p>
        )}
      </header>

      <div className="bsrp-intro">
        <h1 className="bsrp-visually-hidden">Your report</h1>
        {/* The laptop's verdict card (same gradient, dial and area / flat
            split), cut down for a phone, with the Sun and Area lines. */}
        <section className="bsrp-verdict" aria-label="Property score">
          <div className="bsrp-verdict-top">
            {typeof overall === 'number' && (
              <div className="bsr-sum-dial" role="img" aria-label={`Property score ${overall} out of 100`}>
                <svg viewBox="0 0 150 150" aria-hidden="true">
                  <circle cx="75" cy="75" r="60" className="bsr-sum-track" />
                  <circle
                    cx="75" cy="75" r="60" className="bsr-sum-arc"
                    strokeDasharray={`${(Math.max(0, Math.min(100, overall)) / 100) * 377} 377`}
                    transform="rotate(-90 75 75)"
                  />
                </svg>
                <span className="bsrp-dial-n">{overall}<small>/100</small></span>
              </div>
            )}
            <div className="bsrp-verdict-meta">
              <p className="bsr-sum-eyebrow">{hasArea ? 'Property score · area + this flat' : 'Property score · this flat'}</p>
              {hasArea && (
                <p className="bsr-sum-split">
                  <span><i className="bsr-sum-dot is-av" aria-hidden="true" />Neighbourhood <strong>{area.score}</strong></span>
                  {typeof unit?.score === 'number' && <span><i className="bsr-sum-dot is-ss" aria-hidden="true" />This flat <strong>{unit.score}</strong></span>}
                </p>
              )}
            </div>
          </div>
        </section>
        {(sunLine || areaLine) && (
          <section className="bsrp-glance" aria-label="In short">
            <p className="bsrp-glance-k">In short</p>
            {sunLine && <p className="bsrp-vline is-sun"><Sun size={16} strokeWidth={2.4} aria-hidden="true" /><span>{sunLine}</span></p>}
            {areaLine && <p className="bsrp-vline is-area"><MapIcon size={16} strokeWidth={2.4} aria-hidden="true" /><span>{areaLine}</span></p>}
          </section>
        )}
        <button type="button" className="bsrp-sunbtn" onClick={() => setView('sun')}>
          <span className="bsrp-sunbtn-ico" aria-hidden="true"><Sun size={18} strokeWidth={2.2} /></span>
          <span className="bsrp-sunbtn-text">
            <strong>See the sun through the year</strong>
            <span>Your building in 3D, any season and time</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {flatRows.length > 0 && (
        <section className="bsrp-sec bsrp-part is-flat" aria-labelledby="bsrp-flat-h">
          <h2 id="bsrp-flat-h" className="bsrp-h2">Your flat</h2>
          <p className="bsrp-part-sub">Floor {floor || '–'}{facing ? `, facing ${String(facing).toLowerCase()}` : ''}. Changes with floor and facing.</p>
          <ul className="bsrp-find-list">
            {flatRows.map((it) => <FindingRow key={it.id} item={it} onOpen={openItem} rate={rate} />)}
          </ul>
        </section>
      )}

      {areaRows.length > 0 && (
        <section className="bsrp-sec bsrp-part is-area" aria-labelledby="bsrp-area-h">
          <h2 id="bsrp-area-h" className="bsrp-h2">The area</h2>
          <p className="bsrp-part-sub">Pin {area?.pinCode}. The same for every flat around here.</p>
          <ul className="bsrp-find-list">
            {areaRows.map((it) => <FindingRow key={it.id} item={it} onOpen={openItem} rate={rate} />)}
          </ul>
        </section>
      )}

      {/* Same checklist as the laptop's "What to check before you decide":
          the items that scored lowest, each with what to look at on a visit.
          Ticks and notes are saved per address, shared with the laptop. */}
      <section className="bsrp-sec bsrp-part is-checks" aria-labelledby="bsrp-checks-h">
        <h2 id="bsrp-checks-h" className="bsrp-h2">What to check before you decide</h2>
        {checks.length === 0 ? (
          <p className="bsrp-part-sub">Nothing scored under 60. Still worth one visit at rush hour and one after dark.</p>
        ) : (() => {
          const doneN = checks.filter((c) => ticked?.has(c.key)).length;
          return (
            <>
              <div className="bsrp-progress" aria-label={`${doneN} of ${checks.length} checked`}>
                <span className="bsrp-progress-bar"><i style={{ width: `${(doneN / checks.length) * 100}%` }} /></span>
                <span className="bsrp-progress-n">{doneN} of {checks.length} checked</span>
              </div>
              <p className="bsrp-part-sub">Take these on your visit. Swipe through, mark each one when you've seen it.</p>
              <ul className="bsrp-cards">
                {checks.map((c, i) => {
                  const done = !!ticked?.has(c.key);
                  const isArea = AREA_ORDER.includes(c.key);
                  const Icon = ICONS[c.key];
                  return (
                    <li key={c.key} className={`bsrp-card${done ? ' is-done' : ''}${isArea ? ' is-area' : ' is-flat'}`}>
                      <div className="bsrp-card-top">
                        <span className="bsrp-card-ico" aria-hidden="true">{Icon ? <Icon size={18} strokeWidth={2.2} /> : null}</span>
                        <span className="bsrp-card-k">{isArea ? 'The area' : 'Your flat'} · {i + 1}/{checks.length}</span>
                      </div>
                      <h3 className="bsrp-card-t">{AREA_NAMES[c.key] || FLAT_NAMES[c.key] || c.label}</h3>
                      <p className="bsrp-card-x">{c.action}</p>
                      {done && (
                        <textarea
                          className="bsrp-card-note"
                          placeholder="What did you find? (optional)"
                          aria-label={`What did you find - ${c.label}`}
                          value={notes[c.key] || ''}
                          onChange={(e) => onNote?.(c.key, e.target.value)}
                          rows={2}
                        />
                      )}
                      <button type="button" className="bsrp-card-btn" aria-pressed={done} onClick={() => onTick?.(c.key)}>
                        {done ? '✓ Checked' : 'Mark as checked'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          );
        })()}
      </section>

      {/* Compare and Furnishing used to be only small header / footer links
          on phones, easy to miss. Same card style as the sun button. */}
      <section className="bsrp-sec bsrp-part bsrp-more" aria-labelledby="bsrp-more-h">
        <h2 id="bsrp-more-h" className="bsrp-h2">Next for this flat</h2>
        <Link href={compareHref || '/compare'} className="bsrp-sunbtn bsrp-morebtn">
          <span className="bsrp-sunbtn-ico is-compare" aria-hidden="true"><Scale size={18} strokeWidth={2.2} /></span>
          <span className="bsrp-sunbtn-text">
            <strong>Compare with another flat</strong>
            <span>Put two or three flats side by side</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <Link href="/floor-plan-analysis" className="bsrp-sunbtn bsrp-morebtn">
          <span className="bsrp-sunbtn-ico is-furnish" aria-hidden="true"><Sofa size={18} strokeWidth={2.2} /></span>
          <span className="bsrp-sunbtn-text">
            <strong>Furnishing ideas</strong>
            <span>Upload a floor plan, get room-by-room suggestions</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </section>

      {hasArea && (
        <p className="bsrp-meta">
          Area findings for pin {area.pinCode} ·{' '}
          <button type="button" className="bsrp-link" onClick={() => setPinFixOpen(!pinFixOpen)} aria-expanded={pinFixOpen}>
            {pinFixOpen ? 'Never mind' : 'Wrong pin?'}
          </button>
        </p>
      )}
      {hasArea && pinFixOpen && <div className="bsrp-meta-form">{pinFixForm}</div>}

      <p className="bsrp-foot">
        Tap any row for what the data shows and what to check. Estimates from public data and our sun model, not an inspection or advice.
      </p>

      {reportBar}
    </div>
  );
}
