'use client';

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
import { useSearchParams } from 'next/navigation';
import Map3DShadow from '@/components/sunscout/Map3DShadow';
import ReportModal from '@/components/sunscout/ReportModal';
import useMapCapture, { SHOTS } from '@/lib/sunscout/useMapCapture';
import { FACTOR_LABELS, FACING_OPTS } from '@/lib/property-score/ui';
import { getActionItems } from '@/lib/property-score/actionItems';
import {
  ShieldCheck, GraduationCap, Wind, Droplets, Zap, Route, Building2, Waves,
  Sun, Thermometer, Eye, Lock, Fan, CloudRain, Volume2, Snowflake,
} from 'lucide-react';
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
function headlineFor(score, hasArea) {
  if (!hasArea) {
    if (score >= 75) return 'This flat holds up well on its own.';
    if (score >= 50) return 'This flat is workable - a few things worth checking in person.';
    return 'Several things on this flat are worth a closer look before you commit.';
  }
  if (score >= 75) return 'Worth going ahead - with a few things to check.';
  if (score >= 58) return 'Worth a look, but go in with your eyes open.';
  return 'Worth a very close look before you commit to this one.';
}
// The API's quadrant copy is written for us, not for a buyer ("Location
// Play", "worth comparing other floors/facings"). Same logic, said
// plainly -- and naming the actual factor (light, outlook, airflow, the
// streets around it) rather than just judging "the flat" as a whole.
function verdictSay(areaScore, unitScore) {
  const areaOk = areaScore >= 60;
  const unitOk = unitScore >= 60;
  if (areaOk && unitOk) return 'The locality holds up and so does this particular flat - the combination is what people are actually looking for.';
  if (!areaOk && unitOk) return 'The flat itself holds up well. It is the streets around it that need scrutiny, and that is the half you cannot change later.';
  if (areaOk && !unitOk) return 'Good locality - but light, outlook or airflow on this exact floor and facing pull the score down. Ask to see a higher floor or a different facing in the same tower before deciding.';
  return 'Both halves are worth verifying in person - the locality and this specific floor and facing. Worth a close look before you put money down.';
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

export default function ReportScreen() {
  const params = useSearchParams();

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
  const [floorText, setFloorText] = useState(String(parseInt(params.get('floor'), 10) || DEFAULT_FLOOR));
  const [facing, setFacing] = useState(params.get('facing') || DEFAULT_FACING);
  // No longer user-adjustable (the "what matters more to you" toggle
  // was removed) -- kept as a plain constant so the score fetch and the
  // full report below, which both still read `areaWeight`, don't change.
  const areaWeight = 0.5;
  // A listing gives you the tower, not the unit -- so these two arrive
  // as defaults far more often than not. Say so until they're set.
  const [assumed, setAssumed] = useState(
    () => params.get('assumed') === '1' || !params.get('floor') || !params.get('facing')
  );

  // A listing gives you the tower, not the unit -- so on a genuinely
  // fresh visit (no floor/facing in the URL: not a bookmarked link, not
  // a "change address" round trip) nobody has said which flat this even
  // is yet. Gate the actual scoring on answering that, rather than
  // silently running the numbers for floor 5/South-East and hoping the
  // "assumed" note further down gets noticed -- see the unitgate modal
  // in the return below, and the early-out at the top of the scores
  // effect. Once true for this mount, it stays true (changing floor or
  // facing later, from within the report, is its own separate flow and
  // doesn't need to re-ask).
  const [unitChosen, setUnitChosen] = useState(
    () => Boolean(params.get('floor') && params.get('facing'))
  );
  const [gFloor, setGFloor] = useState('');
  const [gFacing, setGFacing] = useState('');

  const confirmUnit = useCallback(() => {
    const f = parseInt(gFloor, 10);
    if (Number.isFinite(f)) { setFloor(f); setFloorText(String(f)); }
    if (gFacing) setFacing(gFacing);
    setAssumed(false);
    setUnitChosen(true);
  }, [gFloor, gFacing]);

  // The floor/facing state already defaults to DEFAULT_FLOOR/
  // DEFAULT_FACING (see their useState initialisers above), and `assumed`
  // is already true whenever the URL arrived with no floor/facing -- so
  // skipping the popup needs nothing but letting the scores effect run.
  const skipUnit = useCallback(() => setUnitChosen(true), []);

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
  // One-time default at mount, not a standing CSS override -- a person
  // who then collapses a half on their own laptop stays collapsed.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 768px)').matches) {
      setHalfOpen({ area: true, unit: true });
    }
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
  // null | 'gallery' (sun & shadow only) | 'full' (both halves).
  const [reportOpen, setReportOpen] = useState(null);
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
  useEffect(() => {
    if (!hasPlace) { setState('error'); setFailure('no-place'); return; }
    // Waiting on the "which floor, which way does it face" popup -- see
    // unitChosen above. Nothing fetches, nothing scores, until it's
    // answered (explicitly, or via its "just browse" skip).
    if (!unitChosen) return;

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
    run().finally(() => { if (!cancelled && id === scoreReq.current) setBusy(false); });
    return () => { cancelled = true; };
  }, [hasPlace, lat, lon, pinCode, floor, facing, areaWeight, scoreNonce, unitChosen]);

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
  const moveTo = useCallback((toLat, toLon, label) => {
    if (!Number.isFinite(toLat) || !Number.isFinite(toLon)) return;
    setLocError('');
    setAddrEditOpen(false);
    setSolar(null); setSolarFailed(false); setAqi(null);
    setPlace({ lat: toLat, lon: toLon, pinCode: '', address: label || '' });
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
  const [reportBusy, setReportBusy] = useState(false);
  const reportRunning = reportOpen !== null && reportBusy;
  const onMapClick = useCallback((clickLat, clickLon) => {
    if (reportRunning) { setLocError('The report is being built from this spot - let it finish, then move the pin.'); return; }
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

  useEffect(() => { setFloorText(String(floor)); }, [floor]);

  // Anchor for the flat half, still used by the in-page "the flat" link.
  const unitRef = useRef(null);

  /* ---------------- the twelve map frames, captured once ----------------
     Photographing the map is the slow half of both reports -- twelve frames,
     about a minute -- and the frames depend only on where the pin is, not on
     the floor or the facing (the capture asks for a date and a time and
     nothing else). Generating the sun & shadow document and then the full
     report meant sitting through that minute twice for identical pictures.
     Keep them for as long as the pin doesn't move. */
  const frameCache = useRef({ key: '', frames: null });
  const captureOnce = useCallback(async (onProgress) => {
    const key = `${lat},${lon}`;
    const held = frameCache.current;
    if (held.key === key && held.frames?.length === SHOTS.length) {
      onProgress?.(held.frames.length, held.frames.length);
      return held.frames;
    }
    const frames = await capture.captureScreenshots(onProgress);
    // Only a COMPLETE set is worth keeping. Caching a run where eight of
    // twelve frames timed out meant every later report at this pin silently
    // reused the crippled set -- instantly, so it looked like a feature --
    // and the only way out was to move the pin.
    if (frames.length === SHOTS.length) frameCache.current = { key, frames };
    else frameCache.current = { key: '', frames: null };
    return frames;
    // capture.captureScreenshots is stable (useCallback inside the hook);
    // the object around it is not, so depend on the function itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.captureScreenshots, lat, lon]);

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
  const [expandedNotes, setExpandedNotes] = useState(() => new Set());
  const [collapsedNotes, setCollapsedNotes] = useState(() => new Set());
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
    q.set('floor', String(floor));
    q.set('facing', facing);
    // Carry the fact that these are still guesses. This effect writes the
    // defaults into the URL on mount, so on the next load `floor` was
    // present and `assumed` initialised false -- a refresh, or a link you
    // sent someone, presented floor 5 / south-east as confirmed when nobody
    // had confirmed anything, with the whole unit score resting on them.
    if (assumed) q.set('assumed', '1');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
  }, [hasPlace, lat, lon, pinCode, address, floor, facing, assumed]);

  /* ---------------- states that aren't the report ---------------- */
  if (!hasPlace) {
    return (
      <div className="bsr">
        <div className="bsr-empty">
          <h1>We need an address first.</h1>
          <p>Search one on the home page and this opens straight onto it.</p>
          <a className="bsr-cta" href="/">Search an address</a>
        </div>
      </div>
    );
  }

  // Before anything gets scored: which flat is this actually for? Sun,
  // shade, view, privacy, airflow, dampness and noise all depend on the
  // real unit, not just the building -- so this blocks the scores effect
  // above (see unitChosen) rather than running the numbers for floor 5/
  // South-East and hoping the "assumed" note further down gets noticed.
  // The address header still shows above it, so the popup reads as "one
  // more thing about this address" rather than a blank interstitial.
  if (!unitChosen) {
    return (
      <div className="bsr">
        <header className="bsr-head">
          <div className="bsr-head-top">
            <h1 className="bsr-title">Your BlindSpot report</h1>
            <span className="bsr-head-links">
              <a href="/compare" className="is-primary">Compare flats</a>
              <a href="/my-reports">My reports</a>
            </span>
          </div>
          <p className="bsr-addr">
            <span className="bsr-pin" aria-hidden="true" />
            <span className="bsr-addr-text">{address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}</span>
            <button
              type="button"
              className="bsr-addr-change"
              onClick={() => setAddrEditOpen((v) => !v)}
              aria-expanded={addrEditOpen}
            >
              {addrEditOpen ? 'Cancel' : 'Change address'}
            </button>
          </p>
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

        <div className="bsr-unitgate">
          <div className="bsr-unitgate-panel" role="dialog" aria-modal="true" aria-label="Set the floor and facing before scoring">
            <span className="bsr-unitgate-eyebrow">Before your score</span>
            <h2 className="bsr-unitgate-title">Which floor, which way does it face?</h2>
            <p className="bsr-unitgate-lede">
              Sun, shade, view, privacy, airflow, dampness and noise all depend on the actual unit, not
              just the address -- say which one and the score below is scored for it specifically.
            </p>

            <div className="bsr-unitgate-row">
              <label className="bsr-unitgate-floor">
                <span>Floor</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={gFloor}
                  onChange={(e) => setGFloor(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                  placeholder={String(DEFAULT_FLOOR)}
                  aria-label="Floor number"
                />
              </label>

              <div className="bsr-unitgate-facing" role="radiogroup" aria-label="Which way the flat faces">
                {FACING_OPTS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={f === gFacing}
                    className={`bsr-unitgate-chip${f === gFacing ? ' on' : ''}`}
                    onClick={() => setGFacing(f)}
                  >
                    {FACING_SHORT[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="bsr-unitgate-actions">
              <button
                type="button"
                className="bsr-unitgate-go"
                disabled={!gFloor || !gFacing}
                onClick={confirmUnit}
              >
                See my score
              </button>
              <button type="button" className="bsr-unitgate-skip" onClick={skipUnit}>
                I don&rsquo;t have a specific flat in mind - let me just browse
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="bsr">
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
            <a href="/">Start with another address</a>
          </p>
        </div>
      </div>
    );
  }
  if (state === 'loading' && !scores) {
    return (
      <div className="bsr">
        <div className="bsr-empty">
          <p className="bsr-boot">Reading the records for this address…</p>
        </div>
      </div>
    );
  }

  const area = scores.area;
  const unit = scores.unit;
  const hasArea = Boolean(area);
  const topScore = hasArea ? scores.combined : unit.score;
  const topTone = toneOf(topScore);

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

      {/* ---------- the page's own title, then which address this is ----------
          The page used to open directly on the address pill -- nothing said
          what this screen even was before the eye landed on a number a
          moment later. One real <h1> line first, the same on every report;
          the verdict headline further down is demoted to <h2> so there's
          exactly one top-level heading on the page, not two competing
          ones. */}
      <header className="bsr-head">
        <div className="bsr-head-top">
          <h1 className="bsr-title">Your BlindSpot report</h1>
          <span className="bsr-head-links">
            {/* First, not last. Someone reading a verdict on one flat is most
                likely to want the other two beside it -- that is a more common
                next step here than either of the other two links. */}
            <a href="/compare" className="is-primary">Compare flats</a>
            <a href="/my-reports">My reports</a>
          </span>
        </div>
        <p className="bsr-addr">
          <span className="bsr-pin" aria-hidden="true" />
          <span className="bsr-addr-text">{address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}</span>
          {/* Used to be a plain link back to "/" -- moving the pin meant
              leaving the report entirely and starting over. This reveals
              the same search-or-coordinates form the map toolbar used to
              carry, right where the address itself is written, and closes
              itself again once moveTo() actually lands a new pin. */}
          <button
            type="button"
            className="bsr-addr-change"
            onClick={() => setAddrEditOpen((v) => !v)}
            aria-expanded={addrEditOpen}
          >
            {addrEditOpen ? 'Cancel' : 'Change address'}
          </button>
        </p>
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

      {/* ---------- the answer, before anything else ---------- */}
      <section className={`bsr-answer is-${topTone}`} id="the-score" aria-live="polite">
        <p className="bsr-big">
          {/* Names what the number actually is before you see the number
              itself -- a bare "72 out of 100" with no label doesn't say
              what it's scoring or for what. */}
          <span className="bsr-big-label">
            {hasArea ? 'Neighbourhood + this flat, combined' : 'This flat, on its own'}
          </span>
          <span className="bsr-big-n">{topScore}</span>
          <span className="bsr-big-of">out of 100</span>
        </p>
        <div className="bsr-answer-say">
          <h2>{headlineFor(topScore, hasArea)}</h2>
          <p>
            {hasArea
              ? verdictSay(area.score, unit.score)
              : 'We don’t have neighbourhood records for this pin code yet, so this score is the flat on its own - sun, shade, view, privacy and airflow.'}
          </p>
          {/* This score's flat-half is only ever real once floor + facing
              are set below -- until then it's scored for a typical mid
              floor, South-East facing, and presenting it with no caveat
              read as if it were already this exact unit's verdict. Says
              so up here, where the number actually is, not only next to
              the inputs further down the page. */}
          {assumed && (
            <p className="bsr-assumed-note">
              Scored for a typical {ord(DEFAULT_FLOOR)} floor, {DEFAULT_FACING.toLowerCase()}-facing
              unit - <a href="#the-flat">set the actual floor and facing</a> to score this specific flat.
            </p>
          )}
        </div>

      </section>

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
                <span className={`bsr-word is-${toneOf(area.score)}`}>{word(area.score)}</span>
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
              <p className="bsr-more">
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
                    {areaFailed ? '' : ' BlindSpot has records for Delhi NCR, Bangalore, Chandigarh, Hyderabad and Mumbai.'}
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
          <p className="bsr-set">
            <label className="bsr-set-field">
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
                  if (Number.isFinite(n) && n >= 1 && n <= MAX_FLOOR) { setAssumed(false); setFloor(n); }
                }}
                onBlur={() => {
                  const n = parseInt(floorText, 10);
                  const clamped = Number.isFinite(n) ? Math.min(MAX_FLOOR, Math.max(1, n)) : floor;
                  setFloor(clamped);
                  setFloorText(String(clamped));
                }}
                aria-label={`Floor number, 1 to ${MAX_FLOOR}`}
                placeholder="5"
              />
            </label>
            <label className="bsr-set-field">
              <span>Faces</span>
              <select
                value={facing}
                onChange={(e) => { setAssumed(false); setFacing(e.target.value); }}
              >
                {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            {assumed ? <span className="bsr-assumed">assumed - set yours</span> : null}
          </p>

          <p className="bsr-rating" aria-live="polite">
            <span className={`bsr-word is-${toneOf(unit.score)}`}>{word(unit.score)}</span>
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
              half's report link opposite it. Used to generate the sun &
              shadow report directly from here -- before anyone had seen
              the day animate over the actual block below, or had a chance
              to nudge the pin/floor/facing first. That's backwards: you'd
              get a report for whatever the defaults happened to be, not
              what you'd actually looked at. This is a plain scroll down to
              the map now (an anchor, not a report trigger -- see .bsr-more
              a below), and the real "generate" action lives on the map's
              own toolbar instead, next to the controls it reports on. */}
          <p className="bsr-more">
            <a href="#the-block">See the sun and shadow on the map ↓</a>
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
      <section className="bsr-mapzone" id="the-block" aria-label="The block in 3D">
        <div className="bsr-map" onMouseLeave={() => setMapArmed(true)}>
          {solar?.pathData ? (
            <Map3DShadow
              lat={lat}
              lon={lon}
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
          {solar?.pathData && mapArmed && (
            <button
              type="button"
              className="bsr-map-guard"
              onClick={() => setMapArmed(false)}
              aria-label="Click to interact with the 3D map"
            >
              Click to interact with the map
            </button>
          )}

          <div className="bsr-mapbar">
            {/* The address search used to open this toolbar -- moved to the
                header instead (see .bsr-addr-edit, next to "Change
                address"), since moving the pin is an edit to the address
                itself, not something that belongs floating over the map
                with floor/faces/date. Play/pause is the toolbar's first
                row now. */}
            <p className="bsr-mapbar-time">
              <button
                type="button"
                className={`bsr-play${animating ? ' is-on' : ''}`}
                onClick={() => setAnimating((a) => !a)}
                aria-pressed={animating}
              >
                {animating ? '❙❙ Pause' : '▶ Play'}
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

            <p className="bsr-set">
              <label className="bsr-set-field bsr-set-floor">
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
                    if (Number.isFinite(n) && n >= 1 && n <= MAX_FLOOR) { setAssumed(false); setFloor(n); }
                  }}
                  onBlur={() => {
                    const n = parseInt(floorText, 10);
                    const clamped = Number.isFinite(n) ? Math.min(MAX_FLOOR, Math.max(1, n)) : floor;
                    setFloor(clamped);
                    setFloorText(String(clamped));
                  }}
                  aria-label={`Floor number, 1 to ${MAX_FLOOR}`}
                  placeholder="5"
                />
              </label>
              <label className="bsr-set-field">
                <span>Faces</span>
                <select
                  value={facing}
                  onChange={(e) => { setAssumed(false); setFacing(e.target.value); }}
                >
                  {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="bsr-set-field bsr-set-date">
                <span>Date</span>
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
              {assumed ? <span className="bsr-assumed">assumed</span> : null}
            </p>
            {/* Generating the sun & shadow report used to be one click from
                a button up top, before anyone had watched the day animate
                over this exact block or nudged the pin to the right spot --
                so the report could be built from a location/floor/facing
                nobody had actually looked at yet. That link now just
                scrolls here (see .bsr-genlink below); this is the real
                "make the report" action, living where the thing it reports
                on is actually visible. */}
            <button
              type="button"
              className="bsr-mapbar-report"
              disabled={!solar?.pathData}
              onClick={() => setReportOpen('gallery')}
            >
              Get the sun &amp; shadow report →
            </button>
          </div>
        </div>
        <p className="bsr-maphint">
          {reportRunning
            ? 'The pin is locked while the report is built from this spot - moving it now would mix two blocks into one report.'
            : 'Click again to move the pin to another building.'}
        </p>
      </section>

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

      {/* ---------- the written verdict ---------- */}
      <section className="bsr-close">
        <h2>Every property has a <em>blindspot.</em></h2>
        <p>
          {hasArea
            ? 'One written verdict on the area and the flat, with what to verify before you buy. PDF.'
            : 'One written verdict on this flat - sun, heat, view and what to verify. No neighbourhood records for this pincode, so it covers the flat only. PDF.'}
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
        <span className="bsr-also">
          Already have the floor plan? <a href="/floor-plan-analysis">Get room-by-room furnishing advice →</a>
        </span>
      </section>

      {scores.notes?.length ? <p className="bsr-foot">{scores.notes.join(' ')}</p> : null}

      {reportOpen && (
        <ReportModal
          /* Without a key React reuses this instance when the type changes,
             so switching from the sun & shadow run to the full report kept
             the finished gallery's state and simply relabelled it: "Your
             report is ready - the full write-up", opening the gallery blob,
             and saving the gallery under the full report's name. */
          key={reportOpen}
          lat={lat}
          lon={lon}
          tzOffset={TZ}
          address={address}
          captureScreenshots={captureOnce}
          galleryOnly={reportOpen === 'gallery'}
          prefillFloor={floor}
          prefillFacing={facing}
          prefillActionItems={actionsForAI.length ? actionsForAI : undefined}
          unitScore={unit.score}
          unitSubScores={unit.subScores}
          areaRecord={reportOpen === 'full' ? avRecord : undefined}
          combinedScore={reportOpen === 'full' ? scores.combined : undefined}
          areaWeight={reportOpen === 'full' ? areaWeight : undefined}
          unitWeight={reportOpen === 'full' ? 1 - areaWeight : undefined}
          onBusyChange={setReportBusy}
          onClose={() => { setReportOpen(null); setReportBusy(false); }}
        />
      )}
    </div>
  );
}
