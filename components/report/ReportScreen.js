'use client';
import Link from 'next/link';

// components/report/ReportScreen.js
//
// One address, both answers, side by side. Reads:
//   /api/property-score   the combined verdict (area factors + unit sub-scores)
//   /api/sunscout/score   the unit on its own, when the pin has no area data
//   /api/sunscout/solar   the sun path Map3DShadow draws
//   /api/aqi              today's air, which the static records often lack
//
// Every fetch is guarded against a stale response landing after a newer one
// (same request-id idiom as useLiveAqi), and every failure has a state on
// screen -- nothing here can end up as a blank page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Map3DShadow from '@/components/sunscout/Map3DShadow';
import ReportModal from '@/components/sunscout/ReportModal';
import useMapCapture, { SHOTS } from '@/lib/sunscout/useMapCapture';
import { FACTOR_LABELS, FACING_OPTS } from '@/lib/property-score/ui';
import { getActionItems } from '@/lib/property-score/actionItems';
import {
  ShieldCheck, GraduationCap, Wind, Droplets, Zap, Route, Building2, Waves,
  Sun, Thermometer, Eye, Lock, Fan, CloudRain, Volume2, Snowflake, Sofa, ArrowDown, MapPin, Scale, FolderOpen, FileText,
} from 'lucide-react';
import RoomPhotoAnalyzer from './RoomPhotoAnalyzer';
import { recordVisit } from '@/lib/profile/history';
import './report.css';


// Order the area rows the way a buyer reads them: what they asked about
// first, the plumbing of daily life after.
const FACTOR_ORDER = ['crime', 'schools', 'air', 'water', 'power', 'roads', 'infrastructure', 'sewerage'];

// What each government-sourced factor actually measures. The API sends a
// number and a label; "Sewerage: Excellent" means nothing on its own.
const FACTOR_MEANS = {
  crime: 'Recorded crime, against other localities in the city',
  schools: 'How many schools are within reach, and their boards',
  air: 'Air quality across the year',
  water: 'Supply hours, coverage and water quality',
  power: 'How often the power goes, and for how long',
  roads: 'Road condition, potholes and when it was last resurfaced',
  infrastructure: 'Metro, highways and what is planned nearby',
  sewerage: 'Drainage coverage, treatment and waterlogging risk',
};

// One small icon per row -- same keys as FACTOR_MEANS above, plus the
// live AQI row (shares the 'air' icon) and the sub-scores on the flat
// side. Purely decorative scanning aids, so every <Icon> below is
// rendered aria-hidden and the row's own text still carries the meaning.
const FACTOR_ICONS = {
  crime: ShieldCheck,
  schools: GraduationCap,
  air: Wind,
  water: Droplets,
  power: Zap,
  roads: Route,
  infrastructure: Building2,
  sewerage: Waves,
};

const SUBSCORE_ICONS = {
  sun: Sun,
  shadeHeat: Thermometer,
  view: Eye,
  privacy: Lock,
  wind: Fan,
  dampness: CloudRain,
  noise: Volume2,
};

// North at the top, the way a compass is read. null is the middle cell.

const MAX_FLOOR = 60;

const TZ = 330;
const DEFAULT_FLOOR = 5;
const DEFAULT_FACING = 'South-East';

// Compact labels for the unitgate popup's 8-chip compass grid -- same
// FACING_OPTS values everywhere else on this page use in full ("South-
// East"), just abbreviated for a grid of buttons rather than a sentence.
const FACING_SHORT = {
  North: 'N', 'North-East': 'NE', East: 'E', 'South-East': 'SE',
  South: 'S', 'South-West': 'SW', West: 'W', 'North-West': 'NW',
};

function word(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}
function toneOf(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'none';
  if (score >= 60) return 'good';
  if (score >= 40) return 'avg';
  return 'poor';
}
// The half-level rating word. Same bands as word(), but the bottom one
// says what it means for a buyer -- "Poor" in big red type under a flat
// read as us calling someone's prospective home bad, which is neither
// kind nor what a single composite number can actually claim.
function halfWord(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  return 'Below average';
}
function halfTone(score) {
  const t = toneOf(score);
  return t === 'poor' ? 'avg' : t;
}

// The summary at the top of the report is built from the actual rows
// below it, strengths first -- not a judgement on the whole home. Two
// short noun forms per dimension: how it reads as a strength ("Strong on
// schools and air quality") and as something to ask about ("Worth
// asking about water supply").
const SUMMARY_WORDS = {
  crime: ['safety', 'safety after dark'],
  schools: ['schools', 'schools nearby'],
  air: ['air quality', 'air quality'],
  water: ['water supply', 'water supply'],
  power: ['power supply', 'power cuts'],
  roads: ['roads', 'the approach roads'],
  infrastructure: ['connectivity', 'nearby construction'],
  sewerage: ['drainage', 'monsoon drainage'],
  sun: ['natural light', 'natural light'],
  shadeHeat: ['staying cool', 'summer heat'],
  view: ['views', 'the view'],
  privacy: ['privacy', 'privacy'],
  wind: ['airflow', 'airflow'],
  dampness: ['staying dry', 'monsoon damp'],
  noise: ['quiet', 'street noise'],
};
function joinWords(list) {
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
function buildSummary(area, unit) {
  const items = [];
  if (area?.factors) {
    for (const [k, v] of Object.entries(area.factors)) {
      if (typeof v === 'number' && SUMMARY_WORDS[k]) items.push({ key: k, score: v });
    }
  }
  for (const sub of unit?.subScores || []) {
    // Skip rows still loading, or showing a neutral placeholder because
    // the live data wasn't there -- neither is a finding.
    if (sub.pending || typeof sub.score !== 'number' || !SUMMARY_WORDS[sub.key]) continue;
    if (/unavailable|neutral score/i.test(sub.summary || '')) continue;
    items.push({ key: sub.key, score: sub.score });
  }
  const strengths = items.filter((i) => i.score >= 75).sort((a, b) => b.score - a.score).slice(0, 3);
  const checks = items.filter((i) => i.score < 55).sort((a, b) => a.score - b.score).slice(0, 2);
  const good = strengths.map((i) => SUMMARY_WORDS[i.key][0]);
  const ask = checks.map((i) => SUMMARY_WORDS[i.key][1]);
  const headline = good.length
    ? `Strong on ${joinWords(good)}.`
    : 'A balanced home, without one big standout.';
  const line = ask.length
    ? `Worth asking about ${joinWords(ask)} on your visit. Everything is broken down below.`
    : 'Nothing stands out as a concern. One visit at rush hour and one after dark is still a good idea.';
  return { headline, line, strengths, checks };
}

function ord(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
function clock(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}
// The four dates the shadow map is worth looking at, plus today.
//
// Solstices and equinoxes are the year's extremes and midpoints: the winter
// solstice is the worst light this flat will ever get and the summer
// solstice the best, so a flat that holds up on 21 December holds up all
// year. Picking a date is the whole point of a shadow map -- "is it sunny
// right now" is a question you can answer by looking out of a window.
//
// Month/day only; the year is filled in at render so these never go stale.
const SEASONS = [
  { key: 'today',  label: 'Today',          md: null,      note: 'The sun where it is right now' },
  { key: 'spring', label: 'Spring equinox', md: '03-20',   note: 'Day and night equal' },
  { key: 'summer', label: 'Summer solstice',md: '06-21',   note: 'The most sun this flat ever gets' },
  { key: 'autumn', label: 'Autumn equinox', md: '09-23',   note: 'Day and night equal again' },
  { key: 'winter', label: 'Winter solstice',md: '12-21',   note: 'The least sun this flat ever gets' },
];

function todayStr() {
  // Local date, not UTC -- toISOString() on an IST evening returns
  // yesterday, which quietly shifts the whole sun path by a day.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seasonDate(key) {
  const s = SEASONS.find((x) => x.key === key);
  if (!s || !s.md) return todayStr();
  return `${new Date().getFullYear()}-${s.md}`;
}

function prettyDate(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function simTimeOf(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
function aqiWord(v) {
  if (v == null) return null;
  if (v <= 50) return 'Good';
  if (v <= 100) return 'Fair';
  if (v <= 200) return 'Poor';
  return 'Very poor';
}

// `view` is which of the two screens this is. They are separate routes --
// /report/locate is the map step, /report is the verdict -- so moving
// between them is a real navigation and the browser's own Back button
// works the way it looks like it should: back from the verdict returns
// to the map you placed the pin on, not to the landing page. As one
// route with an internal flag, Back skipped the whole flow, which is
// what someone reaching for it is least likely to want.
export default function ReportScreen({ view = 'verdict' }) {
  const params = useSearchParams();
  const router = useRouter();

  const [place, setPlace] = useState(() => ({
    lat: parseFloat(params.get('lat')),
    lon: parseFloat(params.get('lon')),
    pinCode: (params.get('pin_code') || '').trim(),
    address: params.get('address') || '',
  }));
  const { lat, lon, pinCode, address } = place;
  // ?debug=1 turns the map handshake logging on in any build.
  const debug = params.get('debug') === '1';
  const hasPlace = Number.isFinite(lat) && Number.isFinite(lon);

  const [floor, setFloor] = useState(parseInt(params.get('floor'), 10) || DEFAULT_FLOOR);
  // What is actually in the box while you type. Kept separate from `floor`
  // so a half-typed "1" on the way to "12" isn't clamped out from under you.
  const [floorText, setFloorText] = useState(
    () => (params.get('assumed') !== '1' && params.get('floor')) ? String(parseInt(params.get('floor'), 10) || DEFAULT_FLOOR) : ''
  );
  const [facing, setFacing] = useState(params.get('facing') || DEFAULT_FACING);
  // No longer user-adjustable (the "what matters more to you" toggle
  // was removed) -- kept as a plain constant so the score fetch and the
  // full report below, which both still read `areaWeight`, don't change.
  const areaWeight = 0.5;
  // A listing gives you the tower, not the unit -- so these two arrive
  // as defaults far more often than not. Say so until they're set.
  // Whether each of the two was actually CHOSEN, separately. One shared
  // `assumed` flag meant that picking a facing flipped the floor to
  // "chosen" too, and a box showing 5 that nobody typed reads as an
  // answer. Now an unset field shows nothing at all -- an empty floor box,
  // a facing select saying "Select" -- and the scoring underneath quietly
  // uses the defaults until each one is answered, which the verdict still
  // says out loud.
  // (?assumed=1 is read for links made before this, and means neither.)
  const legacyAssumed = params.get('assumed') === '1';
  const [floorSet, setFloorSet] = useState(() => !legacyAssumed && Boolean(params.get('floor')));
  const [facingSet, setFacingSet] = useState(() => !legacyAssumed && Boolean(params.get('facing')));
  const assumed = !(floorSet && facingSet);

  // WHERE the pin sits is what has to be right before any of this means
  // anything, and geocoding an address returns the centre of whatever it
  // matched -- the middle of a six-tower complex, the centroid of a road.
  // Every number on this page is computed at that point: which buildings
  // shade it, how far the road is, how open the outlook is. Scoring the
  // centre of a complex and presenting it as someone's flat is wrong in a
  // way no floor/facing answer can fix, and the old popup asked for floor
  // and facing FIRST -- the two least consequential inputs in front of the
  // one that decides everything.
  //
  // So the map is the first step now. A fresh arrival opens full screen on
  // the 3D block with the day running, and the only question is which
  // building is yours: a tap moves the pin, every score re-runs against
  // the new spot, and confirming it is what opens the written verdict.
  // Floor and facing still live on the map's own toolbar, where they can
  // be set while looking at the thing they describe.
  // Whether the pin has been moved off the geocoded point on this visit.
  // Only changes what the map asks for -- "tap your building" before,
  // "use this spot" after.
  // Carried across the navigation in the query string (?pin=1), so the
  // verdict knows whether the pin was actually placed or the map step
  // was skipped -- that decides the "scored at the centre of this
  // address" caveat below.
  const [pinTouched, setPinTouched] = useState(() => params.get('pin') === '1');

  // The map section below can take over the whole viewport (SunScout's
  // own screen is nothing BUT the map, and that is the view people
  // actually want when the question is "where does the sun land"). It
  // is the same DOM node either way -- only the class changes -- so
  // going full screen never remounts the iframe and the map never
  // reloads or loses the angle you dragged it to.
  // ?view=map so it survives a refresh and travels in a shared link --
  // "here is the shadow on this block" is exactly the thing someone
  // sends to the person they are buying with, and without this it
  // reopened on the written verdict instead.
  // Which screen this is comes from the route, not from a flag.
  // Derived from the route, not held in state: this component now stays
  // mounted across /report/locate <-> /report (see app/report/layout.js),
  // so `view` changes on a live instance and the screen has to follow it.
  const fullMap = view === 'map';
  // The full-screen map carries the address search on itself, the way
  // the SunScout top bar does, rather than sending you back up to the
  // report header to move the pin.
  const [mapSearchOpen, setMapSearchOpen] = useState(false);
  // A pointer at the floor/faces controls, shown while both are still the
  // defaults. It points, it doesn't ask: the controls are right there and
  // already work, so standing a dialog in front of them to collect the
  // same two values was a second copy of a thing that wasn't broken.
  const [showUnitTip, setShowUnitTip] = useState(() => view === 'map');

  // The address, the unit and whether a pin was placed -- everything the
  // other screen needs to open on exactly what this one is showing.
  const flowQuery = useCallback((extra = {}) => {
    const q = new URLSearchParams();
    q.set('lat', String(lat));
    q.set('lon', String(lon));
    if (pinCode) q.set('pin_code', pinCode);
    if (address) q.set('address', address);
    // Only what was actually chosen travels -- a missing param IS "not set",
    // so there is no separate flag to keep in step with it.
    if (floorSet) q.set('floor', String(floor));
    if (facingSet) q.set('facing', facing);
    Object.entries(extra).forEach(([k, v]) => v && q.set(k, v));
    return q.toString();
  }, [lat, lon, pinCode, address, floor, facing, floorSet, facingSet]);

  // Confirming the spot ends the map step -- a real navigation to the
  // verdict, so Back comes back here with the pin still on it.
  const confirmSpot = useCallback(() => {
    router.push(`/report?${flowQuery({ pin: pinTouched ? '1' : '' })}`);
  }, [router, flowQuery, pinTouched]);

  // ...and the way back to it from the verdict's own map toolbar.
  const openLocate = useCallback(() => {
    router.push(`/report/locate?${flowQuery({ pin: pinTouched ? '1' : '' })}`);
  }, [router, flowQuery, pinTouched]);

  // Both confirmSpot and openLocate above are router.push()es, not a
  // local class toggle -- .bsr-mapzone.is-full itself is a cheap
  // opacity fade (see report.css), but a real route change that was
  // never prefetched costs a round trip for the new route's RSC payload
  // before that fade even starts, which is what "Full screen" was
  // actually waiting on. Both /report and /report/locate render nothing
  // of their own (see their page.js files -- the shared layout is what
  // holds the map, kept mounted across this exact navigation), so
  // there's no per-query data to get wrong by warming them up front
  // rather than on click.
  useEffect(() => {
    router.prefetch('/report/locate');
    router.prefetch('/report');
  }, [router]);

  // "The area" and "the flat" each carry a full breakdown (every factor
  // row, the sub-scores) underneath a short summary (name/floor, rating
  // word, score) -- one tap away behind "Show the full breakdown" rather
  // than forced scrolling. Used to force this open on tablet/desktop via
  // a min-width override in report.css (a phone-only collapse); that read
  // as two long walls of rows on a laptop too, so it now collapses the
  // same way at every width. The "see the detailed report" links for each
  // half live outside this toggle in the JSX below (not inside
  // bsr-half-detail) so collapsing the breakdown never hides them.
  const [halfOpen, setHalfOpen] = useState({ area: false, unit: false });
  const toggleHalf = (key) => setHalfOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  // Default open at 768px+, not a standing CSS override -- a person who
  // then collapses a half on their own laptop stays collapsed. This used
  // to be a mount-only check, so someone who opened the page narrow (or
  // in the phone-width layout) and then widened the same window/tab --
  // no reload in between -- kept whatever halfOpen was at mount even
  // after crossing into the desktop width, where .bsr-half-toggle itself
  // is hidden by CSS. With no button left to reopen it, a half that
  // happened to be closed stayed permanently stuck closed. A 'change'
  // listener on the same query re-checks on every crossing, not just
  // at mount, so widening past 768px opens both halves; narrowing back
  // below it intentionally leaves whatever the person set, same as it
  // always has on a laptop that starts wide.
  //
  // The macOS "enter full screen" window transition (the green button /
  // the toolbar's own full-screen toggle backing out to a maximised
  // window) is exactly this crossing, but it is an animated, native
  // resize rather than a single discrete change -- matchMedia's 'change'
  // event is the standard way to catch a breakpoint crossing, but a
  // plain 'resize' fires on every step of that animation in every
  // browser and never misses it, so it backs the matchMedia listener up
  // rather than replacing it. openIfWide only ever sets both halves to
  // true, never false, so having both listeners fire is harmless.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const openIfWide = () => {
      if (window.innerWidth >= 768) setHalfOpen({ area: true, unit: true });
    };
    openIfWide();
    mq.addEventListener('change', openIfWide);
    window.addEventListener('resize', openIfWide);
    return () => {
      mq.removeEventListener('change', openIfWide);
      window.removeEventListener('resize', openIfWide);
    };
  }, []);

  const [scores, setScores] = useState(null);   // { area|null, unit, combined|null }
  const [state, setState] = useState('loading'); // loading | ready | error
  const [failure, setFailure] = useState('');
  const [solar, setSolar] = useState(null);
  const [solarFailed, setSolarFailed] = useState(false);
  const [aqi, setAqi] = useState(null);
  const [busy, setBusy] = useState(false);
  // The sun & shadow report generates here, from the map already on this
  // page -- no second screen, no second map, nothing to navigate back from.
  // Both reports can run at once: 'gallery' (sun & shadow only) and
  // 'full' (both halves) each get their own card. `reportsOpen` is the
  // open ones in the order they were started; `reportFront` is the one
  // shown as a full card -- every other open one is folded to a thin bar,
  // so two cards never stack on top of each other.
  const [reportsOpen, setReportsOpen] = useState([]);
  const [reportFront, setReportFront] = useState(null);
  const reportOpen = reportsOpen.length > 0;
  const setReportOpen = useCallback((type) => {
    setReportsOpen((list) => (list.includes(type) ? list : [...list, type]));
    setReportFront(type);
  }, []);
  // Asked for the sunlight report before floor/facing were set: no new
  // popup -- point at the Floor/Facing fields already on screen nearest
  // the button (shake them, outline the empty ones, focus the first), so
  // it isn't quietly built for a default 5th floor, south-east.
  const nudgeTimer = useRef(null);
  const requestSunReport = (e) => {
    if (floorSet && facingSet) { setReportOpen('gallery'); return; }
    const btn = e?.currentTarget;
    let target = null;
    if (btn?.closest('.bsr-fullbar')) {
      target = document.querySelector('.bsr-dock');
      setShowUnitTip(true);
    } else if (btn?.closest('.bsr-mapbar')) {
      target = btn.closest('.bsr-mapbar').querySelector('.bsr-set-unit');
    } else {
      target = document.querySelector('#the-flat .bsr-set');
    }
    if (!target) return;
    const r = target.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.remove('bsr-nudge');
    void target.offsetWidth; // restart the animation on a second tap
    target.classList.add('bsr-nudge');
    const empty = target.querySelector('.is-unset input, .is-unset select');
    empty?.focus({ preventScroll: true });
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => target.classList.remove('bsr-nudge'), 2600);
  };
  const closeReport = useCallback((type) => {
    setReportsOpen((list) => list.filter((t) => t !== type));
    setReportFront((f) => (f === type ? null : f));
  }, []);
  // The raw locality record the report generator wants -- the summary the
  // scoring API returns isn't the same shape.
  const [avRecord, setAvRecord] = useState(null);
  // True while the arrival lookup is in flight, so the area half says
  // "still looking" rather than flashing "not covered" at a pin we simply
  // haven't asked about yet.
  const [pinPending, setPinPending] = useState(false);
  // Nominatim's postcode tagging for India misses and mis-tags often enough
  // that the old flow let people correct it by hand. Same here.
  const [pinEntry, setPinEntry] = useState('');
  const [pinFixOpen, setPinFixOpen] = useState(false);
  // The area half didn't load because something broke, not because this
  // pincode is uncovered. Those need different words in front of a person.
  const [areaFailed, setAreaFailed] = useState(false);
  const capture = useMapCapture();
  const [minutes, setMinutes] = useState(630);   // only meaningful while paused
  // The animation runs inside Map3DShadow while `animating` is true --
  // SunScoutPanel starts it playing, and the shadows moving is the whole
  // reason the map is here. Passing false was switching it off.
  const [animating, setAnimating] = useState(true);
  // Second way out of the floor/facing popup: same floor, same facing,
  // same scoring -- it only decides which of the two views opens first.
  // Defined here rather than next to confirmUnit because it needs
  // setAnimating, which is declared on the line above.
  // Which date the map is simulating. 'today' by default -- someone who has
  // just dropped a pin wants to recognise what they are looking at before
  // they start asking about December.
  const [seasonKey, setSeasonKey] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const simDate = seasonKey === 'custom' ? (customDate || todayStr()) : seasonDate(seasonKey);
  // The 3D map's own wheel handling (zoom) and drag handling (rotate/tilt)
  // live inside an iframe -- a separate document the page's own scroll
  // listeners can never see. Left unguarded, hovering the map while
  // scrolling the page silently eats the scroll instead of moving the
  // page. Armed by default: a click disarms it so the map can be used,
  // leaving the map re-arms it so the page scrolls normally again.
  const [mapArmed, setMapArmed] = useState(true);

  // Moving the pin: typed address, browser location, or a click on the map.
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState('');
  const [search, setSearch] = useState('');
  // Whether the header's inline "change address" form is open -- the
  // search box used to live permanently in the map toolbar; now it's a
  // rare action tucked next to the address itself, revealed on demand.
  const [addrEditOpen, setAddrEditOpen] = useState(false);

  // Bumped by the retry button, so the scores effect can be re-run without
  // changing the address it is scoring.
  const [scoreNonce, setScoreNonce] = useState(0);
  const scoreReq = useRef(0);
  const solarReq = useRef(0);
  // Which coordinates we've already asked the postcode for, so a pin with
  // genuinely no postcode is asked about once and not on every render.
  const pinAsked = useRef('');

  /* ---------------- scores ---------------- */
  const lastScored = useRef(null);
  useEffect(() => {
    if (!hasPlace) { setState('error'); setFailure('no-place'); return; }
    // Scoring runs from the moment there is a pin, including while the
    // map step is still open -- that is the point of it. Every tap that
    // moves the pin re-runs this, and the score in the map's header
    // updates, so you can see the number change as you move from the
    // middle of the complex onto your own tower.

    const id = ++scoreReq.current;
    let cancelled = false;
    setBusy(true);
    setState((s) => (s === 'ready' ? 'ready' : 'loading')); // keep the page up while re-scoring

    const common = `lat=${lat}&lon=${lon}&floor=${floor}&facing=${encodeURIComponent(facing)}&tzOffset=${TZ}`;

    // The Noise Risk sub-score is the one live external lookup slow
    // enough (a cold Overpass/OSM map patch) to have been making the
    // WHOLE report wait on it. Both fetches below ask for the fast pass
    // first (skipLiveNoise=1 -- everything else, noise shown as
    // "checking..."), so the report renders as soon as that's back, then
    // fire the exact same request again without that flag once the
    // pending row shows up, letting the noise score patch itself into
    // the already-visible report in place, rather than being capped and
    // discarded the way the old soft-deadline version did.
    function noiseIsPending(subScores) {
      return Boolean((subScores || []).find((s) => s.key === 'noise')?.pending);
    }

    async function run() {
      try {
        // With a pin we can ask for both halves at once.
        if (pinCode) {
          const propertyScoreUrl =
            `/api/property-score?pin_code=${encodeURIComponent(pinCode)}&${common}` +
            `&weightArea=${areaWeight}&weightUnit=${1 - areaWeight}`;
          const res = await fetch(`${propertyScoreUrl}&skipLiveNoise=1`);
          const json = await res.json();
          if (cancelled || id !== scoreReq.current) return;

          if (res.ok && !json.error) {
            setScores({ area: json.area, unit: json.unit, combined: json.combinedScore, notes: json.dataNotes });
            setFailure('');
            setState('ready');
            if (noiseIsPending(json.unit?.subScores)) {
              fetch(propertyScoreUrl)
                .then((r) => r.json())
                .then((full) => {
                  if (cancelled || id !== scoreReq.current || full.error) return;
                  setScores({ area: full.area, unit: full.unit, combined: full.combinedScore, notes: full.dataNotes });
                })
                .catch(() => {}); // best-effort patch -- the fast-pass report already stands on its own
            }
            return;
          }
          // ONLY a 404 means "we don't have this locality". Every other
          // status is a failure, and treating them all the same told people
          // their pincode wasn't covered when the truth was that the route
          // threw -- a 502 for a pin that is in the shipped dataset, with
          // the whole neighbourhood half quietly vanishing and the top score
          // switching to unit-only with no sign anything had gone wrong.
          if (res.status !== 404) {
            console.error('[report] property-score failed:', res.status, json?.error || '');
            setAreaFailed(true);
          } else {
            setAreaFailed(false);
          }
        } else {
          setAreaFailed(false);
        }

        const sunscoutScoreUrl = `/api/sunscout/score?${common}`;
        const res = await fetch(`${sunscoutScoreUrl}&skipLiveNoise=1`);
        const json = await res.json();
        if (cancelled || id !== scoreReq.current) return;

        const unitScore = json.liveScore ?? json.score;
        if (typeof unitScore !== 'number') throw new Error('no unit score');

        setScores({
          area: null,
          unit: {
            score: unitScore, grade: json.grade, floor, facing,
            subScores: json.subScores || [], thermalCost: json.thermalCost,
          },
          combined: null,
          notes: json.dataNotes,
        });
        setState('ready');
        if (noiseIsPending(json.subScores)) {
          fetch(sunscoutScoreUrl)
            .then((r) => r.json())
            .then((full) => {
              if (cancelled || id !== scoreReq.current) return;
              const fullUnitScore = full.liveScore ?? full.score;
              if (typeof fullUnitScore !== 'number') return;
              setScores({
                area: null,
                unit: {
                  score: fullUnitScore, grade: full.grade, floor, facing,
                  subScores: full.subScores || [], thermalCost: full.thermalCost,
                },
                combined: null,
                notes: full.dataNotes,
              });
            })
            .catch(() => {}); // best-effort patch -- the fast-pass report already stands on its own
        }
      } catch {
        if (cancelled || id !== scoreReq.current) return;
        setState('error');
        setFailure('scoring');
      }
    }
    // Typing a floor ("1" on the way to "12") or flicking through facings
    // used to fire two scoring requests per keystroke (fast pass + live
    // noise). Only the unit changed -> wait a beat; anything else -> now.
    const prev = lastScored.current;
    const unitOnly = prev && prev.lat === lat && prev.lon === lon && prev.pinCode === pinCode
      && (prev.floor !== floor || prev.facing !== facing);
    lastScored.current = { lat, lon, pinCode, floor, facing };
    const startT = setTimeout(() => {
      run().finally(() => { if (!cancelled && id === scoreReq.current) setBusy(false); });
    }, unitOnly ? 320 : 0);
    return () => { cancelled = true; clearTimeout(startT); };
  }, [hasPlace, lat, lon, pinCode, floor, facing, areaWeight, scoreNonce]);

  /* ---------------- this device's "homes you've looked at" ----------------
     Written once the scores for this spot are in, so the profile page can
     list the flats someone has checked and reopen them. Local only. */
  useEffect(() => {
    if (!hasPlace || !scores) return;
    const unitScore = scores.unit?.score ?? null;
    recordVisit({
      lat, lon, pinCode: pinCode || '', address: address || '',
      floor: floorSet ? floor : null, facing: facingSet ? facing : null,
      pin: pinTouched,
      score: scores.area ? scores.combined : unitScore,
      area: scores.area?.score ?? null, areaName: scores.area?.name ?? null,
      unit: unitScore,
    });
  }, [hasPlace, scores, lat, lon, pinCode, address, floor, facing, floorSet, facingSet, pinTouched]);

  /* ---------------- full-screen map housekeeping ----------------
     Locking the body while the map owns the viewport: without it a
     wheel gesture that misses the iframe scrolls the report underneath,
     so leaving full screen drops you somewhere you never navigated to.

     Deliberately a CLASS, not `document.body.style.overflow`. ReportModal
     does its own inline save-and-restore of that property, and the report
     is generated from the map's own toolbar -- so full screen and the
     modal overlap by design. Two owners of one inline style is a stuck
     page: leave full screen with the modal open and the modal's later
     restore writes back the 'hidden' it captured from us, locking the
     body with nothing on screen to explain it. A class and an inline
     style don't collide, so each can come and go in any order.

     Gated on the report actually being on screen, because the overlay
     only exists in the main return: the floor/facing popup, the boot
     screen and the error screen all return above it, and every one of
     them is an ordinary page that has to stay scrollable. Deliberately
     not `state === 'ready'` -- a re-score (changing the floor from
     inside full screen) flips state back to 'loading' while `scores`
     stays up and the map stays on screen, and unlocking mid-recalc
     would let the page scroll away underneath it. */
  // The map renders as soon as there is a sun path, with or without a
  // score, so the things that follow the overlay -- the scroll lock,
  // Escape, focus -- follow the overlay, not the scoring call.
  const fullMapLive = fullMap;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!fullMapLive) { setMapArmed(true); return; }
    // The scroll guard exists to stop the map eating the page's scroll;
    // there is no page scroll to protect here, so it is only in the way.
    setMapArmed(false);
    document.body.classList.add('bsr-noscroll');
    return () => document.body.classList.remove('bsr-noscroll');
  }, [fullMapLive]);

  // Escape leaves full screen, the way it leaves any other overlay --
  // unless the report modal is up, in which case Escape belongs to it
  // and pulling the map out from under a running capture would mean
  // photographing a map that is mid-resize.
  useEffect(() => {
    if (!fullMapLive || reportOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') confirmSpot(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullMapLive, reportOpen]);

  // Below 900px the map step's Floor/Facing card is a bottom sheet. Publish
  // its height as --bsr-dock-h so the report cards/bars (ReportModal) sit
  // above it instead of on top of "See the analysis".
  const dockzoneRef = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = dockzoneRef.current;
    if (!fullMap || !el) { root.style.removeProperty('--bsr-dock-h'); return; }
    const mq = window.matchMedia('(max-width: 899px)');
    const update = () => {
      root.style.setProperty('--bsr-dock-h', mq.matches ? `${Math.ceil(el.getBoundingClientRect().height) + 10}px` : '0px');
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    mq.addEventListener?.('change', update);
    return () => {
      ro?.disconnect();
      mq.removeEventListener?.('change', update);
      root.style.removeProperty('--bsr-dock-h');
    };
  }, [fullMap]);

  // The moment either control is touched, the tip has said what it had to
  // say -- leaving it up would be pointing at something already answered.
  useEffect(() => { if (!assumed && pinTouched) setShowUnitTip(false); }, [assumed, pinTouched]);

  // A half-typed address search shouldn't still be sitting open the next
  // time full screen is entered.
  useEffect(() => { if (!fullMap) setMapSearchOpen(false); }, [fullMap]);

  // Keyboard focus follows the view. Without this, tabbing after going
  // full screen walks the report hidden underneath it.
  const fullBackRef = useRef(null);
  const fullToggleRef = useRef(null);
  useEffect(() => {
    if (fullMapLive) fullBackRef.current?.focus({ preventScroll: true });
  }, [fullMapLive]);

  // Leaving full screen should put you back at the map you were just
  // looking at, not at whatever scroll position the page happened to
  // hold before it was locked.
  const leftFull = useRef(false);
  useEffect(() => {
    if (fullMap) { leftFull.current = true; return; }
    if (!leftFull.current) return;
    leftFull.current = false;
    // Leaving the map now always means going on to the verdict (the
    // continue button, the corner x, Escape), so it lands on the answer
    // at the top -- not on the map section halfway down, which read as
    // though the button had done nothing.
    window.scrollTo(0, 0);
    // The button that was focused (back-to-verdict) has just been
    // unmounted, which drops focus to the body and sends the next Tab
    // to the top of the document. Hand it to the control that now does
    // the same job -- the toolbar's full-screen toggle.
    fullToggleRef.current?.focus({ preventScroll: true });
  }, [fullMap]);

  /* ---------------- sun path for the map ---------------- */
  useEffect(() => {
    if (!hasPlace) return;
    const id = ++solarReq.current;
    const date = simDate;
    const t = setTimeout(() => {
      fetch(`/api/sunscout/solar?lat=${lat}&lon=${lon}&date=${date}&tzOffset=${TZ}&simTime=${simTimeOf(minutes)}`)
        .then((r) => r.json())
        .then((j) => {
          if (id !== solarReq.current) return;
          if (j?.pathData) { setSolar(j); setSolarFailed(false); }
          else setSolarFailed(true);
        })
        .catch(() => id === solarReq.current && setSolarFailed(true));
    }, animating ? 0 : 180); // the slider fires fast; don't chase every pixel
    return () => clearTimeout(t);
    // `minutes` re-runs this only while paused: with the animation on, the
    // iframe drives its own clock and a per-minute refetch would fight it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPlace, lat, lon, simDate, animating, animating ? null : minutes]);

  /* ---------------- the raw locality record, for the report ---------------- */
  useEffect(() => {
    if (!pinCode) { setAvRecord(null); return; }
    let live = true;
    fetch(`/api/av-localities/lookup?pin=${encodeURIComponent(pinCode)}`)
      .then((r) => r.json())
      .then((j) => live && setAvRecord(j?.found ? j.record : null))
      .catch(() => {});
    return () => { live = false; };
  }, [pinCode]);

  /* ---------------- today's air ---------------- */
  useEffect(() => {
    if (!hasPlace) return;
    let live = true;
    fetch(`/api/aqi?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((j) => live && setAqi(typeof j?.aqi === 'number' ? j.aqi : null))
      .catch(() => {});
    return () => { live = false; };
  }, [hasPlace, lat, lon]);

  /* ---------------- the postcode, when we arrived without one ----------------
     The area half is looked up by postcode, so a pin that arrives with only
     coordinates -- a hero suggestion that carried no postcode, a shared link,
     a saved bookmark -- had nothing to look up, and the page said "not
     covered yet" when the truth was that we never asked. Ask on arrival, the
     same way moving the pin does. */
  useEffect(() => {
    if (!hasPlace || pinCode) return;
    const key = `${lat},${lon}`;
    if (pinAsked.current === key) return;
    pinAsked.current = key;

    let live = true;
    setPinPending(true);
    fetch(`/api/sunscout/reverse-geocode?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((j) => {
        const res = j?.result;
        if (!live) return;
        if (res) {
          setPlace((p) => (p.lat === lat && p.lon === lon && !p.pinCode
            ? { ...p, pinCode: res.postcode || '', address: p.address || res.displayName || '' }
            : p));
        }
      })
      .catch(() => {})
      .finally(() => { if (live) setPinPending(false); });
    return () => { live = false; setPinPending(false); };
  }, [hasPlace, lat, lon, pinCode]);

  const actions = useMemo(
    () => getActionItems({
      areaFactors: scores?.area?.factors,
      factorLabels: FACTOR_LABELS,
      unitSubScores: scores?.unit?.subScores,
      facing,
    }),
    [scores, facing]
  );

  // Coordinates land at once so the map and the flat's half react
  // immediately; the postcode and label follow from the reverse lookup,
  // which is what the area half needs.
  // The building the last tap landed on, tinted on the map. Tied to the
  // spot it was tapped at, so a search or "my location" that moves the
  // pin elsewhere drops the tint on its own.
  const [picked, setPicked] = useState(null);
  const placeRef = useRef(null);
  useEffect(() => { placeRef.current = hasPlace ? { lat, lon } : null; }, [hasPlace, lat, lon]);
  const moveTo = useCallback((toLat, toLon, label) => {
    if (!Number.isFinite(toLat) || !Number.isFinite(toLon)) return;
    setLocError('');
    setAddrEditOpen(false);
    setMapSearchOpen(false);
    // A tap on a nearby tower keeps the 3D map up (the pin is moved inside
    // it); clearing the sun path here unmounted the map and reloaded the
    // whole scene on every tap. Only a jump to somewhere else resets it.
    const here = placeRef.current;
    const far = !here || Math.abs(here.lat - toLat) > 0.004 || Math.abs(here.lon - toLon) > 0.004;
    if (far) { setSolar(null); setSolarFailed(false); }
    setAqi(null);
    // Same neighbourhood: keep the pincode we have until the reverse lookup
    // answers, instead of blanking the area half for a moment on every tap.
    setPlace((p) => ({ lat: toLat, lon: toLon, pinCode: far ? '' : p.pinCode, address: label || (far ? '' : p.address) }));
    pinAsked.current = `${toLat},${toLon}`;
    fetch(`/api/sunscout/reverse-geocode?lat=${toLat}&lon=${toLon}`)
      .then((r) => r.json())
      .then((j) => {
        const res = j?.result;
        if (!res) return;
        setPlace((p) => (p.lat === toLat && p.lon === toLon
          ? { ...p, pinCode: res.postcode || '', address: label || res.displayName || p.address }
          : p));
      })
      .catch(() => {});
  }, []);

  // Moving the pin mid-capture put frames of two different blocks into one
  // report: the iframe is replaced, but the run in flight keeps
  // photographing whatever is now on screen, while the modal still holds the
  // original address to title and analyse it with. The result was cached
  // under the OLD pin, so regenerating there returned the mixed set.
  // Locked while a capture is actually running, not for as long as the
  // card is on screen. The finished and failed cards both stay mounted
  // until the person closes them, and the pin was staying locked -- with
  // "the report is being built from this spot" -- for a report that had
  // finished five minutes earlier.
  const [reportBusy, setReportBusy] = useState({ gallery: false, full: false });
  const reportRunning = reportBusy.gallery || reportBusy.full;
  const onGalleryBusy = useCallback((b) => setReportBusy((r) => (r.gallery === b ? r : { ...r, gallery: b })), []);
  const onFullBusy = useCallback((b) => setReportBusy((r) => (r.full === b ? r : { ...r, full: b })), []);
  const onMapClick = useCallback((clickLat, clickLon, meta) => {
    if (reportRunning) { setLocError('The report is being built from this spot - let it finish, then move the pin.'); return; }
    setPicked(meta?.buildingId ? { id: meta.buildingId, lat: clickLat, lon: clickLon } : null);
    // This is the whole point of the map step: the tap that moves the pin
    // off the geocoded centre and onto the actual building.
    setPinTouched(true);
    moveTo(clickLat, clickLon, '');
  }, [moveTo, reportRunning]);

  const onSearchSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (reportRunning) { setLocError('The report is being built from this spot - let it finish, then search.'); return; }
    const q = search.trim();
    if (!q) return;

    // Typed coordinates go straight through. When the lookup services are
    // unreachable -- a VPN, an egress rule, a rate limit -- this is the one
    // way in that depends on nothing, and it costs a regex.
    const pair = q.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (pair) {
      const toLat = parseFloat(pair[1]);
      const toLon = parseFloat(pair[2]);
      if (Math.abs(toLat) <= 90 && Math.abs(toLon) <= 180) {
        moveTo(toLat, toLon, '');
        setSearch('');
        return;
      }
    }

    setLocBusy(true);
    setLocError('');
    try {
      const j = await fetch(`/api/sunscout/geocode?q=${encodeURIComponent(q)}`).then((r) => r.json());
      if (Array.isArray(j?.result)) {
        moveTo(j.result[0], j.result[1], q);
        setSearch('');
      } else if (j?.reason === 'unreachable') {
        // Say which of the two it is. "We couldn't find that address" for a
        // service that never answered sends people to re-type a correct
        // address, over and over.
        setLocError('The address lookup service isn\u2019t reachable from this network (a VPN will often do it). You can paste coordinates instead \u2014 for example 12.9716, 77.5946.');
      } else {
        setLocError('We couldn\u2019t find that address. Try adding the city, or paste coordinates like 12.9716, 77.5946.');
      }
    } catch {
      setLocError('The address lookup didn\u2019t answer. Try again, or paste coordinates like 12.9716, 77.5946.');
    } finally {
      setLocBusy(false);
    }
  }, [search, moveTo, reportRunning]);

  const useMyLocation = useCallback(() => {
    if (reportRunning) { setLocError('The report is being built from this spot - let it finish first.'); return; }
    if (!navigator.geolocation) { setLocError('This browser won\u2019t share your location.'); return; }
    setLocBusy(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocBusy(false); moveTo(pos.coords.latitude, pos.coords.longitude, ''); },
      () => { setLocBusy(false); setLocError('We couldn\u2019t get your location. Search the address instead.'); },
      { timeout: 10000 }
    );
  }, [moveTo, reportRunning]);

  // Only mirrors a floor someone actually chose. Unconditionally, this ran
  // on mount and wrote the default 5 into a box meant to start empty.
  useEffect(() => { if (floorSet) setFloorText(String(floor)); }, [floor, floorSet]);

  // Anchor for the flat half, still used by the in-page "the flat" link.
  const unitRef = useRef(null);

  // Where "set the actual floor and facing" (in the assumed-score note
  // above "the area", and anywhere else that link appears) actually
  // lands: the Floor/Faces row itself, not just the top of the whole
  // "the flat" half. A bare #the-flat jump jumps to the right section
  // but leaves you to spot the two fields yourself among everything
  // else in it -- this scrolls straight to them and flashes the row for
  // two seconds, the same "jump to it and light it up briefly" pattern
  // a chat app uses when you tap a reply to jump to the original
  // message.
  const unitSetRef = useRef(null);
  const unitSetFlashTimer = useRef(null);
  const scrollToUnitSet = useCallback((e) => {
    e.preventDefault();
    const el = unitSetRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('bsr-set-flash');
    // Restarts the animation if this is clicked again while a previous
    // flash is still fading -- without the reflow the class re-add is a
    // no-op as far as the browser's concerned, since it never actually
    // left.
    void el.offsetWidth;
    el.classList.add('bsr-set-flash');
    if (unitSetFlashTimer.current) clearTimeout(unitSetFlashTimer.current);
    unitSetFlashTimer.current = setTimeout(() => {
      el.classList.remove('bsr-set-flash');
    }, 2000);
  }, []);
  useEffect(() => () => {
    if (unitSetFlashTimer.current) clearTimeout(unitSetFlashTimer.current);
  }, []);

  /* ---------------- the twelve map frames, captured once ----------------
     Photographing the map is the slow half of both reports -- twelve frames,
     about a minute -- and the frames depend only on where the pin is, not on
     the floor or the facing (the capture asks for a date and a time and
     nothing else). Generating the sun & shadow document and then the full
     report meant sitting through that minute twice for identical pictures.
     Keep them for as long as the pin doesn't move. */
  const frameCache = useRef({ key: '', frames: null });
  // Both reports can be started together. The second one doesn't start a
  // second capture (the hook refuses: 'capture-already-running', and two
  // runs would fight over one camera) -- it joins the one in flight and
  // gets the same progress and the same frames.
  const inflight = useRef(null); // { key, promise, owners: Map<owner, {onProgress, cancel}>, last }
  const captureOnce = useCallback((onProgress, owner = 'gallery') => {
    const key = `${lat},${lon}`;
    const held = frameCache.current;
    if (held.key === key && held.frames?.length === SHOTS.length) {
      onProgress?.(held.frames.length, held.frames.length);
      return Promise.resolve(held.frames);
    }
    let f = inflight.current && inflight.current.key === key ? inflight.current : null;
    if (!f) {
      f = { key, owners: new Map(), last: null };
      f.promise = capture.captureScreenshots((done, total) => {
        f.last = [done, total];
        f.owners.forEach((o) => o.onProgress?.(done, total));
      }).then((frames) => {
        // Only a COMPLETE set is worth keeping. Caching a run where eight of
        // twelve frames timed out meant every later report at this pin
        // silently reused the crippled set.
        if (frames.length === SHOTS.length) frameCache.current = { key, frames };
        else frameCache.current = { key: '', frames: null };
        return frames;
      }).finally(() => { if (inflight.current === f) inflight.current = null; });
      inflight.current = f;
    }
    // Each report gets its own way out: cancelling one leaves the capture
    // running for the other, and only stops it when nobody is left.
    let cancelMine;
    const mine = new Promise((_, reject) => { cancelMine = () => reject(new Error('capture-cancelled')); });
    f.owners.set(owner, { onProgress, cancel: cancelMine });
    if (f.last) onProgress?.(...f.last);
    return Promise.race([f.promise, mine]).finally(() => { f.owners.delete(owner); });
    // capture.captureScreenshots is stable (useCallback inside the hook);
    // the object around it is not, so depend on the function itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.captureScreenshots, lat, lon]);
  const cancelCaptureFor = useCallback((owner) => {
    const f = inflight.current;
    if (!f || !f.owners.has(owner)) return;
    const o = f.owners.get(owner);
    f.owners.delete(owner);
    if (f.owners.size === 0) capture.cancel?.();
    else o.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.cancel]);
  const captureGallery = useCallback((p) => captureOnce(p, 'gallery'), [captureOnce]);
  const captureFull = useCallback((p) => captureOnce(p, 'full'), [captureOnce]);
  const cancelGallery = useCallback(() => cancelCaptureFor('gallery'), [cancelCaptureFor]);
  const cancelFull = useCallback(() => cancelCaptureFor('full'), [cancelCaptureFor]);

  /* ---------------- the site-visit checklist ----------------
     These rendered as squares that looked exactly like checkboxes and did
     nothing when you pressed them -- the one thing on this page that
     invites a click and then ignores it. They are real now, and they
     remember what you ticked for this address, because the whole point of
     the list is that you carry it around a flat and tick things off.

     `notes` sits alongside `ticked` in the same storage entry -- free text
     per item, "what did you actually find", not just whether you looked.
     On its own that would only ever live on this one device/browser, same
     as the ticks always have -- the part that makes it worth writing is
     feeding it to the AI report below (see actionsForAI / prefillActionItems)
     so a finding written here becomes part of the report you actually save,
     not a note that evaporates the moment you close the tab. */
  const [ticked, setTicked] = useState(() => new Set());
  const [notes, setNotes] = useState(() => ({}));
  const tickKey = hasPlace ? `bs-checklist:${lat.toFixed(5)},${lon.toFixed(5)}` : '';

  useEffect(() => {
    if (!tickKey) return;
    try {
      const raw = window.localStorage.getItem(tickKey);
      const parsed = raw ? JSON.parse(raw) : null;
      // Old entries are a bare array of ticked keys, written before notes
      // existed -- still read those as ticks-only rather than losing them.
      if (Array.isArray(parsed)) {
        setTicked(new Set(parsed));
        setNotes({});
      } else {
        setTicked(new Set(Array.isArray(parsed?.ticked) ? parsed.ticked : []));
        setNotes(parsed?.notes && typeof parsed.notes === 'object' ? parsed.notes : {});
      }
    } catch { setTicked(new Set()); setNotes({}); }
  }, [tickKey]);

  const persistChecklist = useCallback((nextTicked, nextNotes) => {
    if (!tickKey) return;
    try {
      // Private browsing and blocked site data both throw here. Ticking/
      // noting still works for this visit; it just won't be remembered.
      window.localStorage.setItem(tickKey, JSON.stringify({ ticked: [...nextTicked], notes: nextNotes }));
    } catch {}
  }, [tickKey]);

  // Ticking an item is the natural moment to reveal its note field --
  // but re-ticking one whose note field was explicitly closed (see
  // collapseNote below) should reopen it too, not leave it stuck hidden
  // just because it was closed once before.
  // Declared before toggleTick, which reopens a collapsed note on tick.
  const [expandedNotes, setExpandedNotes] = useState(() => new Set());
  const [collapsedNotes, setCollapsedNotes] = useState(() => new Set());
  const toggleTick = useCallback((key) => {
    const willTick = !ticked.has(key);
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persistChecklist(next, notes);
      return next;
    });
    if (willTick) {
      setCollapsedNotes((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [persistChecklist, notes, ticked]);

  const updateNote = useCallback((key, text) => {
    setNotes((prev) => {
      const next = { ...prev, [key]: text };
      persistChecklist(ticked, next);
      return next;
    });
  }, [persistChecklist, ticked]);

  // Purely this-render UI toggles, not persisted -- whether a note field
  // is showing doesn't need to survive a reload the way the ticks/notes
  // themselves do. Two sets, not one: expandedNotes is "opened on
  // request" (the "+ Add a note" link, for an item you haven't ticked
  // and that has no note yet); collapsedNotes is "closed on request" and
  // overrides EVERY reason a field would otherwise show (ticked, has a
  // saved note, or expanded) -- without it there was no way to hide a
  // note field again once it opened, which is exactly what it's for.
  const revealNote = useCallback((key) => {
    setExpandedNotes((prev) => new Set(prev).add(key));
    setCollapsedNotes((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);
  const collapseNote = useCallback((key) => {
    setCollapsedNotes((prev) => new Set(prev).add(key));
    setExpandedNotes((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Only count ticks against items actually on the list. The ticks are
  // stored per address, but the list is derived from the floor and facing --
  // change the floor and items drop off it, which used to leave the counter
  // reading "3 of 1 checked".
  const tickedHere = useMemo(
    () => actions.filter((a) => ticked.has(a.key)).length,
    [actions, ticked]
  );

  // Fed to ReportModal as prefillActionItems -- a finding typed above is
  // what actually turns "noted on this device" into "in the report you
  // save": app/api/sunscout/report/analyse/route.js writes a userFinding
  // into the report as something you confirmed, not a thing still to check.
  const actionsForAI = useMemo(
    () => actions.map((a) => ({
      key: a.key, label: a.label, score: a.score, action: a.action,
      userFinding: (notes[a.key] || '').trim(),
    })),
    [actions, notes]
  );




  // Keep the URL honest as the floor/facing change, so a refresh or a
  // shared link reopens the same flat rather than the defaults.
  useEffect(() => {
    if (!hasPlace || typeof window === 'undefined') return;
    const q = new URLSearchParams();
    q.set('lat', String(lat));
    q.set('lon', String(lon));
    if (pinCode) q.set('pin_code', pinCode);
    if (address) q.set('address', address);
    // Only what was actually chosen goes in the URL. A missing param now
    // means "not set", which is what ?assumed=1 used to have to say
    // separately -- and a link carrying floor=5 that nobody chose was
    // exactly the problem that flag existed to paper over.
    if (floorSet) q.set('floor', String(floor));
    if (facingSet) q.set('facing', facing);
    // Which of the two views you are in, so a refresh and a shared link
    // both reopen on the map you were actually looking at rather than
    // dropping you back into the written verdict.
    // Which screen you are on is the path now, not a flag. What the URL
    // still has to carry is whether the pin was actually placed, so a
    // refresh or a shared link keeps the caveat honest.
    if (pinTouched) q.set('pin', '1');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
  }, [hasPlace, lat, lon, pinCode, address, floor, facing, floorSet, facingSet, pinTouched]);

  // The report modal, built once and rendered from both screens. It used
  // to live only at the bottom of the full report, so the map step -- which
  // returns early, without the report, so it doesn't wait for scoring --
  // had the "Build the sun report" button in its toolbar and no modal to
  // open: the click set reportOpen and nothing appeared. The gallery run
  // only needs the map and the coordinates; the unit score it forwards is
  // optional, so this is safe before scores have landed.
  // Folded bars stack from the corner up; the one full card sits above
  // them. 46px = a 38px bar + gap.
  const folded = reportsOpen.filter((t) => t !== reportFront);
  const stackOffsetOf = (t) => (t === reportFront ? folded.length : folded.indexOf(t)) * 46;
  const renderReport = (type) => (
      <ReportModal
        /* One instance per report type, keyed by type, so starting the
           full report never tears down a sun & shadow run in progress. */
        key={type}
        lat={lat}
        lon={lon}
        tzOffset={TZ}
        address={address}
        captureScreenshots={type === 'gallery' ? captureGallery : captureFull}
        cancelCapture={type === 'gallery' ? cancelGallery : cancelFull}
        galleryOnly={type === 'gallery'}
        prefillFloor={floor}
        prefillFacing={facing}
        prefillActionItems={actionsForAI.length ? actionsForAI : undefined}
        unitScore={scores?.unit?.score}
        unitSubScores={scores?.unit?.subScores}
        areaRecord={type === 'full' ? avRecord : undefined}
        combinedScore={type === 'full' ? scores?.combined : undefined}
        areaWeight={type === 'full' ? areaWeight : undefined}
        unitWeight={type === 'full' ? 1 - areaWeight : undefined}
        onBusyChange={type === 'gallery' ? onGalleryBusy : onFullBusy}
        minimized={reportFront !== type}
        onMinimizedChange={(m) => setReportFront(m ? (reportFront === type ? null : reportFront) : type)}
        stackOffset={stackOffsetOf(type)}
        dockAware={fullMap}
        onClose={() => { closeReport(type); (type === 'gallery' ? onGalleryBusy : onFullBusy)(false); }}
      />
    );
  const reportModal = reportOpen && (
    <>
      {reportsOpen.includes('gallery') && renderReport('gallery')}
      {reportsOpen.includes('full') && renderReport('full')}
    </>
  );

  // The map section, built once and rendered from two places: on its own
  // (the /report/locate step, which must not wait for scoring) and inside
  // the full report below. Same element either way, so moving between the
  // two never remounts Map3DShadow and never reloads the 3D scene.
  const unitFieldsNode = (
    <span className="bsr-set-unit">
      {/* Floor and faces as one group: they are the unit, they are
          asked together, and the pointer below aims at the gap
          between them -- left:50% of this group, whatever widths
          the two fields end up at. */}
      <label className={`bsr-set-field bsr-set-floor${floorSet ? '' : ' is-unset'}`}>
        <span>Floor</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={floorText}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 2);
            setFloorText(raw);
            const n = parseInt(raw, 10);
            if (Number.isFinite(n) && n >= 1 && n <= MAX_FLOOR) { setFloorSet(true); setFloor(n); }
          }}
          onBlur={() => {
            const n = parseInt(floorText, 10);
            // Left empty: stays empty. It used to snap back to the
            // default on blur, filling in a 5 nobody chose.
            if (!Number.isFinite(n)) { if (!floorSet) setFloorText(''); else setFloorText(String(floor)); return; }
            const clamped = Math.min(MAX_FLOOR, Math.max(1, n));
            setFloorSet(true);
            setFloor(clamped);
            setFloorText(String(clamped));
          }}
          aria-label={`Floor number, 1 to ${MAX_FLOOR}`}
        />
      </label>
      <label className={`bsr-set-field${facingSet ? '' : ' is-unset'}`}>
        <span>Balcony faces</span>
        <select
          value={facingSet ? facing : ''}
          onChange={(e) => { if (!e.target.value) return; setFacingSet(true); setFacing(e.target.value); }}
          aria-label="Which way the balcony or main window faces"
        >
          {!facingSet && <option value="" disabled>Select</option>}
          {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>

    </span>
  );

  // Season alone -- shared between the inline map's toolbar and the
  // locate step's top bar (see mapbarNode and mapZone's .bsr-fullbar).
  const seasonFieldNode = (
    <>
      <label className="bsr-set-field bsr-set-date">
        <span>Select season</span>
        <select
          value={seasonKey}
          onChange={(e) => setSeasonKey(e.target.value)}
          aria-label="Which day to simulate"
        >
          {SEASONS.map((sn) => (
            <option key={sn.key} value={sn.key}>
              {sn.label}{sn.md ? ` - ${prettyDate(seasonDate(sn.key))}` : ''}
            </option>
          ))}
          <option value="custom">Pick a date…</option>
        </select>
      </label>
      {seasonKey === 'custom' && (
        <input
          type="date"
          className="bsr-datein"
          value={customDate || todayStr()}
          onChange={(e) => setCustomDate(e.target.value)}
          aria-label="Date to simulate"
        />
      )}
    </>
  );

  // Play/pause + the time-of-day slider -- also shared between the
  // inline map's toolbar and the locate step's top bar.
  const playControlNode = (
    <p className="bsr-mapbar-time">
      <button
        type="button"
        className={`bsr-play${animating ? ' is-on' : ''}`}
        onClick={() => setAnimating((a) => !a)}
        aria-pressed={animating}
        aria-label={animating ? 'Pause the sun and shadow animation' : 'Play the sun and shadow animation'}
      >
        {animating ? '❙❙ Pause shadows' : '▶ Play shadows'}
      </button>
      {!animating && (
        <>
          <input
            id="bsr-time"
            type="range"
            min="330"
            max="1140"
            step="10"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            aria-label="Time of day"
          />
          <span className="bsr-clock">{clock(minutes)}</span>
        </>
      )}
    </p>
  );

  const mapbarNode = (
          <div className="bsr-mapbar">
            {/* The address search used to open this toolbar -- moved to the
                header instead (see .bsr-addr-edit, next to "Change
                address"), since moving the pin is an edit to the address
                itself, not something that belongs floating over the map
                with floor/faces/date. */}
            {/* Filters (what to simulate) on the left, controls + the
                report action on the right -- one unified row on the
                inline verdict map's bar, split by a hairline. The
                wrapper divs are `display:contents` until that layout
                kicks in (see report.css), so every already-verified
                narrow-width wrap order and the /report/locate dock's own
                centered layout keep matching .bsr-set / .bsr-mapbar-time
                / .bsr-mapbar-report / .bsr-mapbar-full exactly as before
                -- only the inline map's wide bar changes shape. */}
            <div className="bsr-mapbar-filters">
            <p className="bsr-set">
              {unitFieldsNode}
              {seasonFieldNode}
            </p>
            </div>

            <div className="bsr-mapbar-actions">
              {playControlNode}

              {/* Same toolbar, both states -- so the way in and the way
                  out of full screen live in the same place rather than
                  being two different controls in two different corners. A
                  compact icon button once "Build the sun report" sits right
                  next to it to compare against; the label comes back on a
                  phone, where it's often the only other control on its
                  row. */}
              {/* Leaving full screen IS confirming the spot -- otherwise
                  this was a second exit that bypassed the header's button,
                  dropping someone on the verdict with `confirmed` still
                  false, so the next reload sent them back round the map
                  step they thought they had finished. */}
              {/* Only on the verdict's inline map. On the map step, the way
                  out is the small x in the top-right corner of the screen,
                  which is where people look for it -- as a wide labelled
                  button at the end of this bar it was the most prominent
                  thing in the least important position. */}
              {!fullMap && (
                <button
                  type="button"
                  className="bsr-mapbar-full"
                  ref={fullToggleRef}
                  onClick={openLocate}
                  aria-label="Full screen"
                  title="Full screen"
                >
                  <span aria-hidden="true">⤢</span>
                  <span className="bsr-mapbar-full-label">Full screen</span>
                </button>
              )}
              {/* Generating the sun & shadow report used to be one click from
                  a button up top, before anyone had watched the day animate
                  over this exact block or nudged the pin to the right spot --
                  so the report could be built from a location/floor/facing
                  nobody had actually looked at yet. That link now just
                  scrolls here (see .bsr-genlink below); this is the real
                  "make the report" action, living where the thing it reports
                  on is actually visible. The only solid-filled button in
                  this bar -- Pause and Full screen are both outline/tinted,
                  so this is unambiguously the one thing to press. */}
              {/* Only on the verdict's inline map. The locate step
                  (fullMap) already has its own one action lower down --
                  "Continue to the verdict" / "Tap your building" -- so a
                  second, competing CTA up here in the toolbar was one too
                  many asks on a screen that just wants the pin placed. */}
              {!fullMap && (
                <button
                  type="button"
                  className="bsr-mapbar-report"
                  disabled={!solar?.pathData}
                  onClick={requestSunReport}
                >
                  <Sun size={15} strokeWidth={2.2} aria-hidden="true" /> Year-round sunlight report
                </button>
              )}
            </div>
          </div>
  );

  const mapZone = (
      <section
        className={`bsr-mapzone${fullMap ? ' is-full' : ''}${!fullMap && !scores && state !== 'error' ? ' is-parked' : ''}`}
        id="the-block"
        aria-label="The block in 3D"
      >
        {/* Full screen only: the SunScout-style header strip. Search,
            the live score for whatever the toolbar below is currently
            set to, and the way back to the written verdict. Everything
            else on the map (play/pause, floor, faces, date, report) is
            the same toolbar the inline map uses -- one set of controls,
            two sizes. */}
        {fullMap && (
          <div className="bsr-fullbar">
            {/* Used to also carry "Tap your building" / "Pin placed" here,
                the same message .bsr-mapcta already says once, clearly, at
                the bottom, with the actual next-step button attached --
                saying it twice (once as quiet supporting text up here, in
                competition with a score pill and a search button) is what
                made neither read as the instruction. This line's only job
                now is showing where you searched. A score pill used to
                sit here too, live against whatever floor/facing/pin are
                CURRENTLY set -- including the un-set defaults on a first
                visit -- with nothing saying it wasn't final. Dropped
                rather than captioned: the actual score belongs to the
                verdict, after "Continue", not a preview here. */}
            {/* No x up here any more: it looked like "cancel" but actually
                confirmed the pin and moved on. "See the analysis" (or
                Escape) is the one way forward. */}

            <p className="bsr-fullbar-where">
              <span className="bsr-fullbar-addr">
                {address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}
              </span>
              {/* The pin lock has a one-line explanation under the inline
                  map (.bsr-maphint), which is off screen here -- so the
                  same warning takes this line while a capture is
                  running, rather than the map silently ignoring taps
                  with nothing saying why. */}
              {reportRunning && (
                <span className="bsr-fullbar-unit">Pin locked while the report is built</span>
              )}
            </p>

            {/* Play/pause and the season used to live down in the dock
                with Floor/Faces -- moved up here so the top bar carries
                every control for what's being simulated, and the dock
                below is just the unit (Floor/Faces) and the one action
                this step exists for. Same state, same handlers as the
                inline map's toolbar -- see playControlNode/seasonFieldNode
                above mapbarNode. */}
            {/* Pause/play sits right beside the address, quiet: it's a
                viewing toggle, not something to act on. */}
            <span className="bsr-fullbar-play">{playControlNode}</span>

            <div className="bsr-fullbar-controls">
              <span className="bsr-fullbar-season">
                {seasonFieldNode}
              </span>
            </div>

            {/* The sunlight report lives up here, in the bar, as its own
                solid CTA -- the card at the bottom right is only about
                moving on to the analysis. It needs just the map, the pin
                and floor/facing, keeps building in the background, and
                carries on if you continue to the analysis. */}
            <button
              type="button"
              className="bsr-fullbar-sun"
              disabled={!solar?.pathData}
              onClick={requestSunReport}
              title="Light and shadow on this unit across all four seasons"
            >
              <Sun size={16} strokeWidth={2.2} aria-hidden="true" />
              <span className="bsr-fullbar-sun-full">Year-round sunlight report</span>
              <span className="bsr-fullbar-sun-short">Sunlight report</span>
            </button>

            <button
              type="button"
              className="bsr-fullbar-search-toggle"
              onClick={() => setMapSearchOpen((v) => !v)}
              aria-expanded={mapSearchOpen}
            >
              {mapSearchOpen ? 'Cancel' : 'Not this address?'}
            </button>

            {mapSearchOpen && (
              <form className="bsr-fullbar-search bsr-locbar" onSubmit={onSearchSubmit}>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Address or coordinates"
                  aria-label="Move the pin to another address or coordinates -- press Enter to search"
                  autoFocus
                />
                {locBusy ? <span className="bsr-loc-busy" aria-live="polite">Finding…</span> : null}
                <button type="button" className="bsr-loc-me" onClick={useMyLocation} disabled={locBusy}>
                  My location
                </button>
                {locError ? <p className="bsr-locerror">{locError}</p> : null}
              </form>
            )}
          </div>
        )}
        <div className="bsr-map" onMouseLeave={() => setMapArmed(true)}>
          {solar?.pathData ? (
            <Map3DShadow
              lat={lat}
              lon={lon}
              highlightId={picked && picked.lat === lat && picked.lon === lon ? picked.id : null}
              pathData={solar.pathData}
              simTime={simTimeOf(minutes)}
              simPos={solar.simPos}
              sunTimes={solar.sunTimes}
              animating={animating}
              onLocationSelect={onMapClick}
              onReady={capture.onReady}
              onScreenshot={capture.onScreenshot}
              onStatus={capture.onStatus}
              debug={debug}
            />
          ) : (
            <p className="bsr-map-wait">
              {solarFailed ? 'The 3D view couldn’t load. The scores below are unaffected.' : 'Building the 3D view…'}
            </p>
          )}
          {/* The guard exists to stop the map eating the PAGE's scroll.
              Full screen there is no page scrolling behind it, so it is
              only in the way. */}
          {solar?.pathData && mapArmed && !fullMap && (
            <button
              type="button"
              className="bsr-map-guard"
              onClick={() => setMapArmed(false)}
              aria-label="Click to interact with the 3D map"
            >
              Click to interact with the map
            </button>
          )}

          {/* The step's own action, on the map rather than tucked in the
              bar above it -- the one thing this screen exists to make
              someone do, not styled like the least important control on
              it. The panel carries only the unit (Floor/Faces) and that
              action -- play/pause and season moved up to the top bar
              (see .bsr-fullbar-controls above), so this reads as "who
              lives here" -> "where's the pin" -> "go", not a second copy
              of the whole toolbar. Right side rather than bottom-centre
              so it doesn't sit over the part of the building someone is
              trying to tap. */}
          {/* .bsr-dockzone is one bottom sheet below 900px (there's no
              room to split the fields from the go button on a phone) and
              becomes an invisible wrapper past it, where .bsr-dock and
              .bsr-mapcta each take their own spot -- see report.css. */}
          {fullMap && (
            <div className="bsr-dockzone" ref={dockzoneRef}>
              <div className="bsr-dock">
                {/* Attached to the card's own top edge, full width, instead
                    of a pill floating above its right corner -- it lines up
                    with the box it's about. */}
                {/* One yellow strip, one step at a time: pick the building
                    first, then floor and facing. */}
                {showUnitTip && (!pinTouched || assumed) && (
                  <p className="bsr-docktip" role="note">
                    <span className="bsr-docktip-icon" aria-hidden="true">
                      {pinTouched ? <ArrowDown size={15} strokeWidth={2.6} /> : <MapPin size={15} strokeWidth={2.6} />}
                    </span>
                    <span className="bsr-docktip-text">
                      {pinTouched ? (
                        <>
                          <strong>Set your floor and facing</strong>
                          <span>Scores change a lot between floors</span>
                        </>
                      ) : (
                        <>
                          <strong>Tap your building on the map</strong>
                          <span>{assumed ? 'Then set your floor and facing below' : 'So we score your exact tower'}</span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      className="bsr-docktip-x"
                      onClick={() => setShowUnitTip(false)}
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </p>
                )}
                <p className="bsr-dock-title">Pinpoint your unit</p>
                <p className="bsr-set bsr-dock-fields">
                  {unitFieldsNode}
                </p>
              </div>
              <div className={`bsr-mapcta${pinTouched ? ' is-ready' : ''}`}>
                <p className="bsr-mapcta-say">
                  {pinTouched
                    ? 'Pin placed - every score below is for this exact spot.'
                    : 'Without a pin, scores use the centre of the complex.'}
                </p>
                <button
                  type="button"
                  className="bsr-mapcta-go"
                  ref={fullBackRef}
                  onClick={confirmSpot}
                >
                  {pinTouched ? 'See the analysis' : 'Continue without placing a pin'}
                  <span aria-hidden="true"> →</span>
                </button>
              </div>
            </div>
          )}

          {!fullMap && mapbarNode}
        </div>
        {!fullMap && (
          <p className={`bsr-maphint${reportRunning ? ' is-locked' : ''}`}>
            {reportRunning
              ? 'The pin is locked while the report is built from this spot - moving it now would mix two blocks into one report.'
              : 'Click again to move the pin to another building.'}
          </p>
        )}
      </section>
  );

  /* ---------------- states that aren't the report ---------------- */
  if (!hasPlace) {
    return (
      <div className="bsr">
        <div className="bsr-empty">
          <h1>We need an address first.</h1>
          <p>Search one on the home page and this opens straight onto it.</p>
          <Link className="bsr-cta" href="/">Search an address</Link>
        </div>
      </div>
    );
  }


  // What the verdict screen is showing. The map step shows none of it --
  // just the map and the report modal, in the same slots they occupy here
  // (see the return below for why the slots matter).
  const verdictMode = fullMap ? 'none'
    : state === 'error' ? 'error'
    : !scores ? 'boot'
    : 'ready';

  const errorNode = (
    <div className="bsr-empty">
      <h1>We couldn&apos;t score this address.</h1>
      <p>
        {failure === 'scoring'
          ? 'The scoring service didn’t answer. This is on us, not the address - try again in a moment.'
          : 'Something went wrong reading this address.'}
      </p>
      {/* This screen returns above the map, the search bar and the
          floor/facing controls, so nothing on the page could change the
          inputs the failed effect depends on -- "try again in a moment"
          with no way to try again, and a browser reload the only escape.
          Retry re-runs it in place. */}
      <p className="bsr-empty-actions">
        <button type="button" onClick={() => { setFailure(''); setState('loading'); setScoreNonce((n) => n + 1); }}>
          Try again
        </button>
        <Link href="/">Start with another address</Link>
      </p>
    </div>
  );

  const bootNode = (
    <div className="bsr-empty">
      <p className="bsr-boot">Reading the records for this address…</p>
    </div>
  );

  const area = scores?.area;
  const unit = scores?.unit ?? { score: null, subScores: [] };
  const hasArea = Boolean(area);
  const topScore = hasArea ? scores?.combined : unit.score;

  // One form, used from both the covered and the not-covered state. The
  // reverse lookup is a best guess -- it returns the pincode of whatever
  // OSM object sits nearest the pin, which on a boundary is the one next
  // door. Whoever is buying the flat knows theirs; let them say it.
  const applyPin = (e) => {
    e.preventDefault();
    const v = pinEntry.trim();
    if (!/^\d{6}$/.test(v)) return;
    setPlace((p) => ({ ...p, pinCode: v }));
    setPinEntry('');
    setPinFixOpen(false);
  };
  const pinFixForm = (
    <form className="bsr-pinfix" onSubmit={applyPin}>
      <label htmlFor="bsr-pin">
        {pinCode ? 'Type the correct pincode:' : 'Know the pincode? Type it in:'}
      </label>
      <span>
        <input
          id="bsr-pin"
          inputMode="numeric"
          maxLength={6}
          placeholder="560067"
          value={pinEntry}
          onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button type="submit" disabled={!/^\d{6}$/.test(pinEntry.trim())}>Use this pincode</button>
      </span>
    </form>
  );

  const factorKeys = hasArea
    ? FACTOR_ORDER.filter((k) => typeof area.factors?.[k] === 'number')
    : [];
  const missingKeys = hasArea
    ? FACTOR_ORDER.filter((k) => typeof area.factors?.[k] !== 'number')
    : [];

  return (
    <div className="bsr">
      {/* Fixed slots, and the order matters more than it looks. This one
          component serves both /report/locate and /report, and the two
          screens are the same tree with different parts switched on --
          so the map (and the report modal after it) sit in the same
          position among these children whichever screen is showing.
          React keeps an element across a re-render only if it stays in
          the same slot; if the map moved, the iframe would be torn down
          and rebuilt, the 3D scene would reload, and a sun report in the
          middle of photographing it would lose its camera. With the
          slots fixed, going from the map to the verdict mid-report just
          re-styles the same map and lets the report carry on. */}
      {verdictMode === 'ready' && (
        <>

          {/* ---------- the page's own title, then which address this is ----------
              The page used to open directly on the address pill -- nothing said
              what this screen even was before the eye landed on a number a
              moment later. One real <h1> line first, the same on every report;
              the verdict headline further down is demoted to <h2> so there's
              exactly one top-level heading on the page, not two competing
              ones. */}
          <header className="bsr-head">
            {/* One row: which address this is on the left, the tools on
                the right. Used to be a mono caption, a full-width grey
                input-looking pill holding the whole geocoder string, and
                three links of different styles floating above it. */}
            <div className="bsr-head-row">
              <div className="bsr-head-where">
                <span className="bsr-head-pin" aria-hidden="true">
                  <MapPin size={18} strokeWidth={2.2} />
                </span>
                <div className="bsr-head-text">
                  <h1 className="bsr-title">Your BlindSpot report</h1>
                  <p className="bsr-addr">
                    {(() => {
                      const full = address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                      const parts = full.replace(/,\s*India\s*$/i, '').split(',').map((x) => x.trim()).filter(Boolean);
                      return (
                        <span className="bsr-addr-text" title={full}>
                          <strong>{parts[0]}</strong>
                          {parts.length > 1 && <span className="bsr-addr-rest">{parts.slice(1).join(', ')}</span>}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      className="bsr-addr-change"
                      onClick={() => setAddrEditOpen((v) => !v)}
                      aria-expanded={addrEditOpen}
                    >
                      {addrEditOpen ? 'Cancel' : 'Change'}
                    </button>
                  </p>
                </div>
              </div>
              <nav className="bsr-head-links" aria-label="Report tools">
                <a href="/compare" className="bsr-tool">
                  <Scale size={16} strokeWidth={2} aria-hidden="true" />
                  <span>Compare flats</span>
                </a>
                <a href="/floor-plan-analysis" className="bsr-tool">
                  <Sofa size={16} strokeWidth={2} aria-hidden="true" />
                  <span>Furnish your home</span>
                </a>
                <Link href="/profile" className="bsr-tool is-quiet" title="Your profile and saved reports">
                  <FolderOpen size={16} strokeWidth={2} aria-hidden="true" />
                  <span>Profile</span>
                </Link>
              </nav>
            </div>
            {addrEditOpen && (
              <form className="bsr-addr-edit bsr-locbar" onSubmit={onSearchSubmit}>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Address or coordinates"
                  aria-label="Move the pin to another address or coordinates -- press Enter to search"
                  autoFocus
                />
                {locBusy ? <span className="bsr-loc-busy" aria-live="polite">Finding…</span> : null}
                <button type="button" className="bsr-loc-me" onClick={useMyLocation} disabled={locBusy}>
                  My location
                </button>
                {locError ? <p className="bsr-locerror">{locError}</p> : null}
              </form>
            )}
          </header>

          {/* ---------- the summary, before anything else ----------
              Used to open on a big traffic-light number and a one-line
              judgement ("Worth a very close look before you commit").
              For a lot of real homes that read as us calling the place
              bad. Now: a quiet dial for the number, and a headline built
              from what the flat and the area are actually strong on,
              with the one or two things worth asking about after it. */}
          {(() => {
            const sum = buildSummary(hasArea ? area : null, unit);
            const pct = Math.max(0, Math.min(100, Number(topScore) || 0));
            return (
          <section className="bsr-answer bsr-sum" id="the-score" aria-live="polite">
            <div className="bsr-sum-dial" role="img" aria-label={`Property score ${topScore} out of 100`}>
              <svg viewBox="0 0 150 150" aria-hidden="true">
                <defs>
                  <path id="bsr-sum-label-arc" d="M 13 75 A 62 62 0 0 1 137 75" />
                </defs>
                {/* The name of the number, set along the top of the ring. */}
                <text className="bsr-sum-label" textAnchor="middle">
                  <textPath href="#bsr-sum-label-arc" startOffset="50%">PROPERTY SCORE</textPath>
                </text>
                <circle cx="75" cy="75" r="48" className="bsr-sum-track" />
                <circle
                  cx="75" cy="75" r="48" className="bsr-sum-arc"
                  strokeDasharray={`${(pct / 100) * 301.6} 301.6`}
                  transform="rotate(-90 75 75)"
                />
              </svg>
              <span className="bsr-sum-n">{topScore}</span>
              <span className="bsr-sum-of">/ 100</span>
            </div>
            <div className="bsr-answer-say">
              <p className="bsr-sum-eyebrow">
                <span className="bsr-sum-eyebrow-full">{hasArea ? 'At a glance · area + this flat' : 'At a glance · this flat'}</span>
                {/* Phone: the dial is too small for the curved label, so it's said here. */}
                <span className="bsr-sum-eyebrow-ph">Property score</span>
              </p>
              <h2>{sum.headline}</h2>
              <p>
                {hasArea
                  ? sum.line
                  : `${sum.line} We don\u2019t have neighbourhood records for this pincode yet, so this covers the flat itself.`}
              </p>
              {hasArea && (
                <p className="bsr-sum-split">
                  <span><i className="bsr-sum-dot is-av" aria-hidden="true" />Neighbourhood <strong>{area.score}</strong></span>
                  <span><i className="bsr-sum-dot is-ss" aria-hidden="true" />This flat <strong>{unit.score}</strong></span>
                </p>
              )}
              {/* The pin and the floor/facing caveats, next to the number
                  they qualify, each one click from being fixed. */}
              {!pinTouched && (
                <p className="bsr-assumed-note">
                  Scored at the centre of this address, not a specific building -{' '}
                  <button type="button" className="bsr-inline-link" onClick={openLocate}>
                    open the map and tap your tower
                  </button>{' '}
                  to score the real spot.
                </p>
              )}
              {assumed && (
                <p className="bsr-assumed-note">
                  Scored for a typical {ord(DEFAULT_FLOOR)} floor, {DEFAULT_FACING.toLowerCase()}-facing
                  unit - <a href="#the-flat" onClick={scrollToUnitSet}>set the actual floor and facing</a> to score this specific flat.
                </p>
              )}
            </div>
            {/* The full report is one of the main things BlindSpot does --
                it used to live only at the very bottom of the page. */}
            <div className="bsr-sum-cta">
              <p className="bsr-sum-cta-title"><FileText size={16} strokeWidth={2.2} aria-hidden="true" /> The full BlindSpot report</p>
              <p className="bsr-sum-cta-sub">
                {hasArea
                  ? 'Area + this flat, written up with what to verify before you buy.'
                  : 'This flat, written up with what to verify before you buy.'}
              </p>
              <button
                type="button"
                className="bsr-sum-cta-go"
                disabled={!solar?.pathData}
                onClick={() => setReportOpen('full')}
              >
                Generate full report <span aria-hidden="true">→</span>
              </button>
              <span className="bsr-sum-cta-note">
                {solar?.pathData ? 'About two minutes · keep browsing' : 'Waiting for the 3D map to load'}
              </span>
            </div>
          </section>
            );
          })()}

          <div className="bsr-halves">

            {/* ================= THE AREA ================= */}
            <section className="bsr-half bsr-area">
              <p className="bsr-kicker">The area around it</p>
              <h2>{hasArea ? area.name : 'This locality'}</h2>
              <p className="bsr-sub">
                {hasArea
                  ? `Government records for pin ${area.pinCode}.`
                  : pinPending
                    ? 'Finding the pincode for this pin\u2026'
                    : areaFailed
                      ? 'Couldn\u2019t be loaded.'
                      : 'Not covered yet.'}
                {hasArea && (
                  <>
                    {' '}
                    <button type="button" className="bsr-pinlink" onClick={() => setPinFixOpen((v) => !v)}>
                      {pinFixOpen ? 'Never mind' : 'Wrong pincode?'}
                    </button>
                  </>
                )}
              </p>

              {/* The lookup lands on a neighbouring pincode often enough that
                  this has to be reachable from the covered state too, not only
                  when nothing was found. 560066 and 560067 are both Whitefield
                  and they are not the same set of records. */}
              {hasArea && pinFixOpen && pinFixForm}

              {hasArea ? (
                <>
                  <p className="bsr-rating">
                    <span className={`bsr-word is-${halfTone(area.score)}`}>{halfWord(area.score)}</span>
                    <span className="bsr-outof">{area.score} out of 100 · grade {area.grade}</span>
                  </p>

                  {/* Collapsed to the rating above by default at every width --
                      the factor-by-factor breakdown and the methodology note
                      are one tap away instead of a wall of rows nobody reads
                      top to bottom. The "see detailed report" link just below
                      stays outside this toggle (see bsr-more after the closing
                      div) so it's never hidden by a collapsed state. */}
                  <button
                    type="button"
                    className="bsr-half-toggle"
                    aria-expanded={halfOpen.area}
                    onClick={() => toggleHalf('area')}
                  >
                    <span className={`bsr-half-toggle-chevron${halfOpen.area ? ' is-open' : ''}`} aria-hidden="true">▾</span>
                    {halfOpen.area ? 'Show less' : 'Show the full breakdown'}
                  </button>

                  <div className={`bsr-half-detail${halfOpen.area ? '' : ' is-collapsed'}`}>
                  <ul className="bsr-rows">
                    {factorKeys.map((k) => {
                      const RowIcon = FACTOR_ICONS[k];
                      return (
                      <li key={k}>
                        {RowIcon ? <RowIcon className="bsr-row-icon" size={16} strokeWidth={2} aria-hidden="true" /> : null}
                        <span className="bsr-row-what">
                          {FACTOR_LABELS[k] || k}
                          {FACTOR_MEANS[k] ? <span className="bsr-row-note">{FACTOR_MEANS[k]}</span> : null}
                        </span>
                        <span className={`bsr-tag is-${toneOf(area.factors[k])}`}>{word(area.factors[k])}</span>
                      </li>
                      );
                    })}

                    {aqi != null && (
                      <li>
                        <Wind className="bsr-row-icon" size={16} strokeWidth={2} aria-hidden="true" />
                        <span className="bsr-row-what">
                          Air quality today
                          <span className="bsr-row-note">Live reading, AQI {aqi}</span>
                        </span>
                        <span className={`bsr-tag is-${aqi <= 100 ? 'good' : aqi <= 200 ? 'avg' : 'poor'}`}>{aqiWord(aqi)}</span>
                      </li>
                    )}

                    {missingKeys.filter((k) => !(k === 'air' && aqi != null)).map((k) => {
                      const RowIcon = FACTOR_ICONS[k];
                      return (
                      <li key={k}>
                        {RowIcon ? <RowIcon className="bsr-row-icon" size={16} strokeWidth={2} aria-hidden="true" /> : null}
                        <span className="bsr-row-what">
                          {FACTOR_LABELS[k] || k}
                          <span className="bsr-row-note">Not in the records for this pin</span>
                        </span>
                        <span className="bsr-tag is-none">Not recorded</span>
                      </li>
                      );
                    })}
                  </ul>

                  <p className="bsr-methodology-note">
                    Scores use a zone-level model, so nearby pincodes can score identically. School names in the full report are the one part sourced locality by locality.
                  </p>
                  </div>

                  {/* Outside bsr-half-detail on purpose -- "see the detailed
                      report" stays visible whether the breakdown above is
                      open or collapsed. margin-top:auto in report.css lines
                      this up with the flat's own link opposite it. No
                      rel="noopener" on purpose: that report's own Close button
                      is window.close(), which the browser refuses without an
                      opener. Same call AVAreaCard's link makes. */}
                  <p className="bsr-more bsr-more-cta">
                    <a href={`/neighbourhood-report/${area.pinCode}`} target="_blank">See the detailed area report →</a>
                  </p>
                </>
              ) : (
                <div className="bsr-nocover">
                  {pinPending ? (
                    <p>Looking up which pincode this pin falls in…</p>
                  ) : (
                    <>
                      <p>
                        {areaFailed
                          ? `We couldn't load the neighbourhood records for pin ${pinCode} just now - that's a fault on our side, not a gap in coverage. The flat's own scores below are unaffected.`
                          : pinCode
                            ? `Pin ${pinCode} isn't in our neighbourhood records yet, so we won't guess at safety, water or schools here.`
                            : "We couldn't work out the pincode for this exact spot, so there's nothing to look the area up by."}
                        {areaFailed ? '' : ' BlindSpot has records for Delhi NCR, Bangalore, Chandigarh, Hyderabad, Mumbai and Chennai.'}
                      </p>
                      {areaFailed && (
                        <p style={{ marginTop: 10 }}>
                          <button type="button" className="bsr-pinlink" onClick={() => setScoreNonce((n) => n + 1)}>
                            Try loading the area again
                          </button>
                        </p>
                      )}
                    </>
                  )}

                  {!pinPending && pinFixForm}
                  {aqi != null && (
                    <p className="bsr-nocover-aqi">
                      What we can tell you: air today is <strong>{aqiWord(aqi).toLowerCase()}</strong>, AQI {aqi}.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* ================= THE FLAT ================= */}
            <section className="bsr-half bsr-unit" id="the-flat" ref={unitRef}>
              <p className="bsr-kicker">The flat itself</p>

              {/* Used to be an h2 ("34th floor, faces east") sitting directly
                  on top of these same two inputs saying the same thing again
                  right below it -- one fact shown twice a few pixels apart.
                  The inputs ARE the heading now: they're what's actually true
                  (and editable), so there's nothing left to restate in prose. */}
              {/* Floor was a dropdown of sixty options. Nobody scrolls to 43 --
                  they know their floor and want to type it. The arrows still
                  work for nudging, and the value is only clamped when you leave
                  the field, so typing "1" on the way to "12" isn't fought. */}
              <p className="bsr-set" ref={unitSetRef}>
                <label className={`bsr-set-field${floorSet ? '' : ' is-unset'}`}>
                  <span>Floor</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={floorText}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 2);
                      setFloorText(raw);
                      const n = parseInt(raw, 10);
                      if (Number.isFinite(n) && n >= 1 && n <= MAX_FLOOR) { setFloorSet(true); setFloor(n); }
                    }}
                    onBlur={() => {
                      const n = parseInt(floorText, 10);
                      // Left empty: stays empty. It used to snap back to the
                      // default on blur, filling in a 5 nobody chose.
                      if (!Number.isFinite(n)) { if (!floorSet) setFloorText(''); else setFloorText(String(floor)); return; }
                      const clamped = Math.min(MAX_FLOOR, Math.max(1, n));
                      setFloorSet(true);
                      setFloor(clamped);
                      setFloorText(String(clamped));
                    }}
                    aria-label={`Floor number, 1 to ${MAX_FLOOR}`}
                  />
                </label>
                <label className={`bsr-set-field${facingSet ? '' : ' is-unset'}`}>
                  <span>Faces</span>
                  <select
                    value={facingSet ? facing : ''}
                    onChange={(e) => { if (!e.target.value) return; setFacingSet(true); setFacing(e.target.value); }}
                    aria-label="Which way the flat faces"
                  >
                    {!facingSet && <option value="" disabled>Select</option>}
                    {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
              </p>

              <p className="bsr-rating" aria-live="polite">
                <span className={`bsr-word is-${halfTone(unit.score)}`}>{halfWord(unit.score)}</span>
                <span className="bsr-outof">{unit.score} out of 100</span>
                {busy ? <span className="bsr-busy">recalculating…</span> : null}
              </p>

              {/* Same collapse-at-every-width pattern as "the area" above --
                  the sub-score breakdown is one tap away. Floor/facing inputs
                  and the rating stay outside this, above -- they're the
                  actionable part, not detail to hide. The "see the sun and
                  shadow" link stays outside the toggle too (below the closing
                  div) so collapsing this never hides it. */}
              <button
                type="button"
                className="bsr-half-toggle"
                aria-expanded={halfOpen.unit}
                onClick={() => toggleHalf('unit')}
              >
                <span className={`bsr-half-toggle-chevron${halfOpen.unit ? ' is-open' : ''}`} aria-hidden="true">▾</span>
                {halfOpen.unit ? 'Show less' : 'Show the full breakdown'}
              </button>

              <div className={`bsr-half-detail${halfOpen.unit ? '' : ' is-collapsed'}`}>
              {/* The seven scores below are computed off the 3D model further
                  down the page (five from the solar/floor model, plus
                  dampness from monsoon climate + orientation, plus noise
                  from live OSM road/rail proximity). Without saying so
                  they read as seven numbers from nowhere. */}
              <p className="bsr-source">
                Worked out from the sun&apos;s real path over the buildings around this one.{' '}
                <a href="#the-block">See the block in 3D ↓</a>
              </p>


              <ul className="bsr-rows">
                {(unit.subScores || []).map((s) => {
                  const RowIcon = SUBSCORE_ICONS[s.key];
                  return (
                  <li key={s.key}>
                    {RowIcon ? <RowIcon className="bsr-row-icon" size={16} strokeWidth={2} aria-hidden="true" /> : null}
                    <span className="bsr-row-what">
                      {s.label}
                      {s.summary ? <span className="bsr-row-note">{s.summary}</span> : null}
                    </span>
                    {/* `pending` (currently only Noise Risk, on its very
                        first live view of an address) means this row's
                        score/tone below isn't a real judgement yet, just a
                        neutral placeholder -- tagging it "Fair" would read
                        as a finished answer instead of one still loading, so
                        it gets its own quiet in-progress pill instead. It
                        swaps for the real tag in place once the background
                        fetch resolves (see the scores effect above). */}
                    {s.pending ? (
                      <span className="bsr-tag is-pending">Checking…</span>
                    ) : (
                      <span className={`bsr-tag is-${toneOf(s.score)}`}>{word(s.score)}</span>
                    )}
                  </li>
                  );
                })}
                {/* A ₹ figure, not a Good/Fair/Poor judgement -- riding on the
                    same Shade & Heat exposure data, but shown as its own row
                    with a neutral tag rather than a sixth graded score. The
                    full formula sits in the title attribute for anyone who
                    hovers; the visible note stays a one-line caveat. */}
                {unit.thermalCost && (
                  <li>
                    <Snowflake className="bsr-row-icon" size={16} strokeWidth={2} aria-hidden="true" />
                    <span className="bsr-row-what">
                      Est. summer AC cost
                      <span className="bsr-row-note" title={unit.thermalCost.methodology}>
                        Standard 1.5-ton AC, typical summer use - an estimate to compare units, not a bill.
                      </span>
                    </span>
                    <span className="bsr-tag is-none">
                      ₹{unit.thermalCost.estCostRange[0].toLocaleString('en-IN')}–{unit.thermalCost.estCostRange[1].toLocaleString('en-IN')}/mo
                    </span>
                  </li>
                )}
              </ul>
              </div>

              {/* Outside bsr-half-detail on purpose -- stays visible whether
                  the breakdown above is open or collapsed, same as the area
                  half's report link opposite it. Used to be a plain scroll
                  link ("generating straight from here is backwards -- you'd
                  get a report for whatever the defaults happened to be"),
                  because floor/facing then lived only on the map toolbar
                  below. They're set right above in this same card now (see
                  the Floor/Faces fields at the top of this section), so
                  that objection doesn't apply here any more -- this button
                  generates from exactly the floor/facing already showing on
                  this card, the same as .bsr-mapbar-report on the map
                  toolbar does, and gives the flat half the same weight of
                  CTA the area half has opposite it instead of a quiet
                  scroll-down link with nothing to match. */}
              <p className="bsr-more bsr-more-cta">
                <button
                  type="button"
                  disabled={!solar?.pathData}
                  onClick={requestSunReport}
                >
                  Get the year-round sunlight report →
                </button>
              </p>
            </section>
          </div>
          {/* ---------- the map, full width ----------
              It lived inside the flat's card until the card's ~500px made
              Map3DShadow hide its own view-angle pad (its stylesheet drops
              .view-controls under 768px), so half the map was unreachable.
              Full width gives the controls back and gives the shadows room.
              The toolbar (search, floor, facing, date) sits ON the map itself
              now, not in a bar above it -- a floating card over the top-left
              corner, so it's always physically part of the map you're looking
              at rather than something that scrolls away from it. It has its
              own z-index above .bsr-map-guard's dimming layer, so it stays
              usable whether the map is armed for interaction or not. On
              768px+, where Map3DShadow's own "set view angle" pad occupies
              the top-right corner, the toolbar is kept clear of it (see
              .bsr-mapbar's right clearance in report.css) rather than
              overlapping it the way the old pill row once did. */}
        </>
      )}
      {verdictMode === 'boot' && bootNode}
      {verdictMode === 'error' && errorNode}
      {mapZone}
      {verdictMode === 'ready' && (
        <>

          <section className="bsr-visit" id="the-visit">
            <h2>What to check before you decide</h2>

            <ul className="bsr-todo">
              {actions.length === 0 ? (
                <li className="bsr-todo-plain">
                  <span className="bsr-todo-body">
                    <strong className="bsr-todo-title">Nothing scored under 60.</strong>
                    <span className="bsr-todo-text">Still worth one visit at rush hour and one after dark before you commit.</span>
                  </span>
                </li>
              ) : (
                actions.map((a) => {
                  const isTicked = ticked.has(a.key);
                  const hasNote = Boolean((notes[a.key] || '').trim());
                  // A box for every item, all empty, read as one repeated wall
                  // regardless of how short the placeholder was -- so nothing
                  // renders here at all until it's actually relevant: ticking
                  // an item (you've been and checked it -- the natural moment
                  // to say what you found) reveals its note field, a written
                  // note keeps it visible even if you later untick, and "+ Add
                  // a note" covers writing one without ticking. collapsedNotes
                  // overrides all three -- otherwise a field, once opened, had
                  // no way back to "+ Add a note" at all.
                  const showNote = !collapsedNotes.has(a.key) && (isTicked || hasNote || expandedNotes.has(a.key));
                  return (
                    <li key={a.key} className={isTicked ? 'is-done' : undefined}>
                      <label className="bsr-todo-row">
                        <input
                          type="checkbox"
                          className="bsr-box"
                          checked={isTicked}
                          onChange={() => toggleTick(a.key)}
                        />
                        <span className="bsr-todo-body">
                          <strong className="bsr-todo-title">{a.label} - {String(word(a.score)).toLowerCase()} ({a.score})</strong>
                          <span className="bsr-todo-text">{a.action}</span>
                        </span>
                      </label>
                      {/* Both sit outside the <label> on purpose -- clicking
                          either must never toggle the checkbox above it. */}
                      {showNote ? (
                        <span className="bsr-todo-notewrap">
                          <textarea
                            className="bsr-todo-note"
                            placeholder="Notes (optional)"
                            aria-label={`What did you find - ${a.label}`}
                            value={notes[a.key] || ''}
                            onChange={(e) => updateNote(a.key, e.target.value)}
                            rows={2}
                            autoFocus={isTicked && !hasNote}
                          />
                          {/* Closing keeps whatever's already typed -- this
                              only hides the field, ticking it again (or "+ Add
                              a note") brings it right back with the text
                              still there. */}
                          <button
                            type="button"
                            className="bsr-todo-notehide"
                            onClick={() => collapseNote(a.key)}
                            aria-label={`Hide the note field for ${a.label}`}
                            title="Hide this note field"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="bsr-todo-addnote" onClick={() => revealNote(a.key)}>
                          + Add a note
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
            {actions.length > 0 && tickedHere > 0 && (
              <p className="bsr-todo-count">
                {tickedHere} of {actions.length} checked.{' '}
                <button type="button" onClick={() => {
                  setTicked(new Set());
                  if (tickKey) { try { window.localStorage.removeItem(tickKey); } catch {} }
                }}>Clear</button>
              </p>
            )}
          </section>

          <RoomPhotoAnalyzer lat={lat} lon={lon} floor={floor} tzOffset={TZ} />

          {/* ---------- the written verdict ---------- */}
          <section className="bsr-close">
            <h2>Every property has a <em>blindspot.</em></h2>
            <p>
              {hasArea
                ? 'A written summary of the area and the flat, with what to verify before you buy. PDF.'
                : 'A written summary of this flat - sun, heat, view and what to verify. No neighbourhood records for this pincode, so it covers the flat only. PDF.'}
            </p>
            {/* Both reports are built from photographs of the map. With no map
                there is nothing to photograph, and the run used to fail with
                "something went wrong, things are busy" -- which is neither true
                nor actionable. Say the real reason before they click. */}
            <button
              type="button"
              className="bsr-cta"
              disabled={!solar?.pathData}
              onClick={() => setReportOpen('full')}
            >
              {hasArea ? 'Generate the full report' : 'Generate the full flat report'}
            </button>
            <span className="bsr-free">
              {solar?.pathData
                ? 'About two minutes. Builds on this page - keep browsing.'
                : 'Waiting for the 3D map to load - the report is built from it.'}
            </span>
            <a className="bsr-furnish" href="/floor-plan-analysis">
              <span className="bsr-furnish-icon" aria-hidden="true"><Sofa size={20} strokeWidth={1.8} /></span>
              <span className="bsr-furnish-body">
                <strong>Furnish your home</strong>
                <span>Upload the floor plan, get room-by-room furniture and layout ideas.</span>
              </span>
              <span className="bsr-furnish-go" aria-hidden="true">→</span>
            </a>
          </section>

          {scores?.notes?.length ? <p className="bsr-foot">{scores.notes.join(' ')}</p> : null}
        </>
      )}
      {reportModal}
    </div>
  );
}
