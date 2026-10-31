'use client';

// components/report/PhoneReport.js
//
// The report page on phones (<= 640px) only. Desktop keeps ReportScreen's
// own layout untouched; ReportScreen swaps this in for its verdict
// sections when useIsPhone() is true.
//
// One page, four views:
//   page   -- the 3D map full width at the top, one sentence from the sun
//             model, then two short groups of bars (the area, your flat),
//             lowest first. The three reports sit in a bar at the bottom.
//   item   -- one row opened: what our data shows, where this pincode sits
//             among the city's pincodes we cover, and what to check.
//   sun    -- the same 3D map, larger, with season / play / time and the
//             month-by-month hours.
//
// Wording: no verdict words (good / poor / strong / weak / risk). Every line
// says where it comes from -- "in our data", "our sun model" -- because we
// can rank against our own records and estimate from our model, and that
// is all we can claim.

import { useEffect, useMemo } from 'react';
import {
  ArrowLeft, ChevronRight, X, Play, Pause, MapPin, Sun, FileText, Map as MapIcon,
  ShieldCheck, GraduationCap, Wind, Droplets, Zap, Route, Building2, Waves,
  Thermometer, Eye, Lock, Fan, CloudRain, Volume2,
} from 'lucide-react';
import { AREA_ACTIONS, UNIT_ACTIONS } from '@/lib/property-score/actionItems';
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

const CITY_NAMES = { Bangalore: 'Bengaluru' };

const SEASON_TABS = [
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
const hrs = (h) => (typeof h === 'number' && Number.isFinite(h) ? `${Math.round(h * 10) / 10} h` : null);
const none = (h) => typeof h === 'number' && h < 0.05;
const monthYear = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

function sunStats(sunYear) {
  if (!Array.isArray(sunYear) || sunYear.length < 12) return null;
  const by = Object.fromEntries(sunYear.map((m) => [m.month, m]));
  const avg = sunYear.reduce((s, m) => s + (m.hours || 0), 0) / sunYear.length;
  const summer = ['April', 'May', 'June'].map((m) => by[m]?.hours || 0).reduce((a, b) => a + b, 0) / 3;
  const sorted = [...sunYear].sort((a, b) => b.hours - a.hours);
  return { by, avg, summer, best: sorted[0]?.month, worst: sorted[sorted.length - 1]?.month };
}

// 'low' | 'high' | 'mid' against the same city's pincodes we cover.
function rankBand(rank) {
  if (!rank || !rank.total) return null;
  if (rank.higher / rank.total >= 0.6) return 'low';
  if (rank.lower / rank.total >= 0.6) return 'high';
  return 'mid';
}
function rankLine(rank, city) {
  const band = rankBand(rank);
  if (!band) return null;
  const c = CITY_NAMES[city] || city || 'city';
  if (band === 'low') return `Lower than most ${c} pincodes we cover`;
  if (band === 'high') return `Higher than most ${c} pincodes we cover`;
  return `Around the middle of the ${c} pincodes we cover`;
}

function flatLine(key, sun) {
  switch (key) {
    case 'sun': return sun ? `About ${hrs(sun.avg)} of direct sun a day, averaged over the year` : 'From our sun model';
    case 'shadeHeat': return sun ? `About ${hrs(sun.summer)} of direct sun a day from April to June` : 'From our sun model';
    case 'view': return 'Estimated from your floor, not this building';
    case 'privacy': return 'Estimated from your floor, not this building';
    case 'wind': return 'From today’s wind forecast and your floor height';
    case 'dampness': return 'From how this side faces the monsoon rain';
    case 'noise': return 'From roads and rail lines mapped nearby';
    default: return '';
  }
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

// The rows: area and flat in two groups, lowest score first so what to ask
// about is at the top of each. An item is flagged "ask on your visit" when
// it is low on our 0-100 scale or lower than most of its city.
function buildItems({ area, unit, sun }) {
  const areaRows = [];
  if (area?.factors) {
    for (const key of AREA_ORDER) {
      const score = area.factors[key];
      if (typeof score !== 'number') continue;
      const rank = area.cityRank?.[key] || null;
      areaRows.push({
        id: `a-${key}`, kind: 'area', key, score, name: AREA_NAMES[key],
        rank, band: rankBand(rank), median: rank?.median ?? null,
        line: rankLine(rank, area.city), facts: area.facts?.[key] || {},
      });
    }
  }
  const flatRows = [];
  for (const s of unit?.subScores || []) {
    if (s.pending || typeof s.score !== 'number' || !FLAT_NAMES[s.key]) continue;
    if (/unavailable|neutral score/i.test(s.summary || '')) continue;
    flatRows.push({ id: `f-${s.key}`, kind: 'flat', key: s.key, score: s.score, name: FLAT_NAMES[s.key], line: flatLine(s.key, sun) });
  }
  const flag = (i) => ({ ...i, ask: i.score < 55 || i.band === 'low' });
  const byScore = (a, b) => a.score - b.score;
  const A = areaRows.map(flag).sort(byScore);
  const F = flatRows.map(flag).sort(byScore);
  return { areaRows: A, flatRows: F, all: [...A, ...F] };
}

function BarRow({ item, onOpen, showMid }) {
  const Icon = ICONS[item.key];
  return (
    <li>
      <button type="button" className="bsrp-bar" onClick={() => onOpen(item.id)}>
        <span className="bsrp-bar-icon" aria-hidden="true">{Icon ? <Icon size={18} strokeWidth={2} /> : null}</span>
        <span className="bsrp-bar-main">
          <span className="bsrp-bar-top">
            <strong>{item.name}</strong>
            {item.ask && <span className="bsrp-ask">Ask on visit</span>}
          </span>
          <span className="bsrp-bar-track" aria-hidden="true">
            <i style={{ width: `${Math.max(3, item.score)}%` }} />
            {showMid && typeof item.median === 'number' && <b style={{ left: `${item.median}%` }} />}
          </span>
        </span>
        <span className="bsrp-bar-n" aria-label={`${item.score} out of 100`}>{item.score}</span>
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  );
}

function Scale({ pos, label, kind = 'area', left = 'Lower', right = 'Higher' }) {
  const p = Math.max(0, Math.min(1, pos));
  return (
    <div className={`bsrp-scale is-${kind}`} role="img" aria-label={label}>
      <div className="bsrp-scale-track">
        <span className="bsrp-scale-mid" />
        <span className="bsrp-scale-dot" style={{ left: `${p * 100}%` }} />
        <span className="bsrp-scale-tag" style={{ left: `${Math.min(86, Math.max(14, p * 100))}%` }}>{label}</span>
      </div>
      <div className="bsrp-scale-ends"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

export default function PhoneReport({
  view, setView, itemId, setItemId,
  area, unit, address, floor, facing, unitSet,
  onChangeFlat, onRequestReport, reportBusy, pinFixForm, pinFixOpen, setPinFixOpen,
  seasonKey, setSeasonKey, animating, setAnimating, minutes, setMinutes, clock, mapReady,
}) {
  const hasArea = Boolean(area);
  const sun = useMemo(() => sunStats(unit?.sunYear), [unit?.sunYear]);
  const { areaRows, flatRows, all } = useMemo(() => buildItems({ area, unit, sun }), [area, unit, sun]);
  const place = (address || '').replace(/,\s*India\s*$/i, '').split(',').slice(0, 2).join(',').trim() || 'This address';
  const city = CITY_NAMES[area?.city] || area?.city;

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

  const openItem = (id) => { setItemId(id); setView('item'); };
  const startReport = (type) => { setView('page'); onRequestReport(type); };

  // The three reports, always one tap away at the bottom of the page.
  // Neighbourhood opens the existing pincode page; Sun and Full start the
  // existing report flow (both need the 3D map, which they photograph).
  const busy = reportBusy || {};
  const reportBar = (
    <nav className="bsrp-dock" aria-label="Your reports">
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
  const headline = sun && typeof dec === 'number' && typeof jun === 'number'
    ? (none(dec) && none(jun)
      ? 'Little or no direct sun on this side in December or June.'
      : `${none(dec) ? 'No direct sun' : `About ${hrs(dec)} of direct sun`} a day in December, ${none(jun) ? 'and none' : `about ${hrs(jun)}`} in June.`)
    : 'Here’s what we found for this flat.';

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
      detail = `${AREA_MEASURES[item.key]} This pincode scores ${item.score} out of 100 on our scale.`;
      if (item.key === 'schools' && typeof item.facts.count === 'number') {
        const b = Object.entries(item.facts.boards || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ');
        detail += ` ${item.facts.count} schools are listed in this pincode in our data${b ? ` (${b})` : ''}.`;
      }
    } else {
      detail = flatDetail(item.key, { sun, floor, facing });
    }
    const rk = item.rank;
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
        <h2 id="bsrp-item-h" className="bsrp-item-h">{item.name}</h2>
        <p className="bsrp-item-p">{detail}</p>

        {item.kind === 'area' && rk ? (
          <>
            <p className="bsrp-label">Among the {city} pincodes we cover</p>
            <Scale pos={(rk.lower + 0.5 * (rk.total - rk.lower - rk.higher)) / rk.total} label="This pincode" />
            <p className="bsrp-small">{rk.higher} of {rk.total} score higher, {rk.lower} score lower.</p>
          </>
        ) : (
          <>
            <p className="bsrp-label">On our 0–100 scale</p>
            <Scale pos={item.score / 100} label={`${item.score}`} kind={item.kind} />
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
    const tab = SEASON_TABS.find((t) => t.key === seasonKey);
    const monthName = tab ? tab.month : MONTHS[new Date().getMonth()];
    const m = sun?.by?.[monthName];
    const max = Math.max(1, ...((unit?.sunYear || []).map((x) => x.hours || 0)));
    return (
      <>
      {/* Outside .bsrp-sun: that panel sits under the map (the map is the
          top half of this view), and the back button has to sit over it. */}
      <button type="button" className="bsrp-icon-btn is-float" onClick={() => setView('page')} aria-label="Back">
        <ArrowLeft size={22} strokeWidth={2} />
      </button>
      <div className="bsrp-sun" role="dialog" aria-modal="true" aria-labelledby="bsrp-sun-h">
        <div className="bsrp-sun-body">
          <h2 id="bsrp-sun-h" className="bsrp-visually-hidden">Sunlight on your flat</h2>
          <div className="bsrp-seasons" role="group" aria-label="Time of year">
            {SEASON_TABS.map((t) => (
              <button key={t.key} type="button" aria-pressed={seasonKey === t.key} onClick={() => setSeasonKey(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="bsrp-time">
            <button
              type="button"
              className="bsrp-play"
              onClick={() => setAnimating(!animating)}
              aria-label={animating ? 'Pause the day' : 'Play the day'}
            >
              {animating ? <Pause size={16} strokeWidth={2.4} /> : <Play size={16} strokeWidth={2.4} />}
            </button>
            {animating ? (
              <span className="bsrp-small">Playing the day. Pause to pick a time.</span>
            ) : (
              <label className="bsrp-slider">
                <span className="bsrp-visually-hidden">Time of day</span>
                <input type="range" min="330" max="1140" step="10" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
                <strong>{clock(minutes)}</strong>
              </label>
            )}
          </div>
          {m && (
            <>
              <p className="bsrp-sun-say">
                {none(m.hours) ? `No direct sun on this side in ${monthName}.` : `About ${hrs(m.hours)} of direct sun a day on this side in ${monthName}.`}
              </p>
              <p className="bsrp-small">Our sun model, clear sky. Sunrise {m.rise} · sunset {m.set}.</p>
            </>
          )}

          {sun && (
            <>
              <h3 className="bsrp-h3">Through the year</h3>
              <div
                className="bsrp-bars"
                role="img"
                aria-label={`Estimated hours of direct sun per day: ${unit.sunYear.map((x) => `${x.month} ${hrs(x.hours)}`).join(', ')}`}
              >
                {unit.sunYear.map((x) => (
                  <span key={x.month} className={x.month === monthName ? 'is-on' : ''}>
                    <i style={{ height: `${Math.max(2, (x.hours / max) * 100)}%` }} />
                    <b>{x.month[0]}</b>
                  </span>
                ))}
              </div>
              <p className="bsrp-small">Hours of direct sun per day on this side, from our sun model.</p>
            </>
          )}

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
      <div className="bsrp-hero">
        <button type="button" className="bsrp-hero-tap" onClick={() => setView('sun')} aria-label="Open the sunlight view" />
        <div className="bsrp-hero-top">
          <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>{place}</span>
        </div>
        <span className="bsrp-hero-chip" aria-hidden="true">
          <Play size={13} strokeWidth={2.6} /> Tap to see the sun through the year
        </span>
      </div>

      <div className="bsrp-intro">
        <h1 className="bsrp-h1">{headline}</h1>
        <p className="bsrp-small">Our sun model’s estimate for this floor and facing.</p>
        {!unitSet && (
          <p className="bsrp-warn">
            Floor and facing aren’t set, so the flat numbers are for a typical flat.{' '}
            <button type="button" className="bsrp-link" onClick={onChangeFlat}>Set them</button>
          </p>
        )}
      </div>

      {hasArea && (
        <section className="bsrp-sec" aria-labelledby="bsrp-area-h">
          <div className="bsrp-sec-head">
            <h2 id="bsrp-area-h" className="bsrp-h2">The area</h2>
            <span>
              Pin {area.pinCode} ·{' '}
              <button type="button" className="bsrp-link" onClick={() => setPinFixOpen(!pinFixOpen)} aria-expanded={pinFixOpen}>
                {pinFixOpen ? 'Never mind' : 'Wrong pin?'}
              </button>
            </span>
          </div>
          {pinFixOpen && pinFixForm}
          <p className="bsrp-legend">
            Out of 100 on our scale. <b aria-hidden="true" /> marks the middle of the {city} pincodes we cover.
          </p>
          <ul className="bsrp-bars-list">
            {areaRows.map((it) => <BarRow key={it.id} item={it} onOpen={openItem} showMid />)}
          </ul>
        </section>
      )}

      {flatRows.length > 0 && (
        <section className="bsrp-sec" aria-labelledby="bsrp-flat-h">
          <div className="bsrp-sec-head">
            <h2 id="bsrp-flat-h" className="bsrp-h2">Your flat</h2>
            <span>
              {ord(floor)} floor · {String(facing).toLowerCase()} ·{' '}
              <button type="button" className="bsrp-link" onClick={onChangeFlat}>Change</button>
            </span>
          </div>
          <p className="bsrp-legend">Out of 100 on our scale, estimated for this floor and facing.</p>
          <ul className="bsrp-bars-list">
            {flatRows.map((it) => <BarRow key={it.id} item={it} onOpen={openItem} />)}
          </ul>
          <button type="button" className="bsrp-link is-go" onClick={() => setView('sun')}>
            See the sun through the year <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </section>
      )}

      {!hasArea && (
        <div className="bsrp-note">
          <p>We don’t have neighbourhood records for this pincode yet, so this covers the flat itself.</p>
          <button type="button" className="bsrp-link" onClick={() => setPinFixOpen(!pinFixOpen)} aria-expanded={pinFixOpen}>
            {pinFixOpen ? 'Never mind' : 'Know the pincode?'}
          </button>
          {pinFixOpen && pinFixForm}
        </div>
      )}

      <p className="bsrp-foot">
        Tap any row for what the data shows and what to check. Estimates from public data and our sun model, not an inspection or advice.
      </p>

      {reportBar}
    </div>
  );
}
