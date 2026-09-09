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

// North at the top, the way a compass is read. null is the middle cell.
const COMPASS = ['North-West', 'North', 'North-East', 'West', null, 'East', 'South-West', 'South', 'South-East'];
const SHORT = {
  'North': 'N', 'North-East': 'NE', 'East': 'E', 'South-East': 'SE',
  'South': 'S', 'South-West': 'SW', 'West': 'W', 'North-West': 'NW',
};

const FLOORS = Array.from({ length: 60 }, (_, i) => i + 1);

const TZ = 330;
const DEFAULT_FLOOR = 5;
const DEFAULT_FACING = 'South-East';

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
    if (score >= 75) return 'The flat itself looks good.';
    if (score >= 50) return 'The flat is workable, with things to check.';
    return 'This flat has real problems.';
  }
  if (score >= 75) return 'Worth going ahead — with a few things to check.';
  if (score >= 58) return 'Worth a look, but go in with your eyes open.';
  return 'We would think hard about this one.';
}
// The API's quadrant copy is written for us, not for a buyer ("Location
// Play", "worth comparing other floors/facings"). Same logic, said plainly.
function verdictSay(areaScore, unitScore) {
  const areaOk = areaScore >= 60;
  const unitOk = unitScore >= 60;
  if (areaOk && unitOk) return 'The locality holds up and so does this particular flat — the combination is what people are actually looking for.';
  if (!areaOk && unitOk) return 'The flat itself is good. It is the streets around it that have real weaknesses, and those are the ones you cannot change later.';
  if (areaOk && !unitOk) return 'Good locality, but this specific flat is the weak half — light, outlook or airflow. Ask to see a higher floor or a different facing in the same tower before deciding.';
  return 'Both the locality and this flat score below average. Worth a very close look before you put money down.';
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
  const [facing, setFacing] = useState(params.get('facing') || DEFAULT_FACING);
  const [areaWeight, setAreaWeight] = useState(0.5);
  // A listing gives you the tower, not the unit -- so these two arrive
  // as defaults far more often than not. Say so until they're set.
  const [assumed, setAssumed] = useState(
    () => params.get('assumed') === '1' || !params.get('floor') || !params.get('facing')
  );

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

  // Moving the pin: typed address, browser location, or a click on the map.
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState('');
  const [search, setSearch] = useState('');

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

    const id = ++scoreReq.current;
    let cancelled = false;
    setBusy(true);
    setState((s) => (s === 'ready' ? 'ready' : 'loading')); // keep the page up while re-scoring

    const common = `lat=${lat}&lon=${lon}&floor=${floor}&facing=${encodeURIComponent(facing)}&tzOffset=${TZ}`;

    async function run() {
      try {
        // With a pin we can ask for both halves at once.
        if (pinCode) {
          const res = await fetch(
            `/api/property-score?pin_code=${encodeURIComponent(pinCode)}&${common}` +
            `&weightArea=${areaWeight}&weightUnit=${1 - areaWeight}`
          );
          const json = await res.json();
          if (cancelled || id !== scoreReq.current) return;

          if (res.ok && !json.error) {
            setScores({ area: json.area, unit: json.unit, combined: json.combinedScore, notes: json.dataNotes });
            setFailure('');
            setState('ready');
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

        const res = await fetch(`/api/sunscout/score?${common}`);
        const json = await res.json();
        if (cancelled || id !== scoreReq.current) return;

        const unitScore = json.liveScore ?? json.score;
        if (typeof unitScore !== 'number') throw new Error('no unit score');

        setScores({
          area: null,
          unit: { score: unitScore, grade: json.grade, floor, facing, subScores: json.subScores || [] },
          combined: null,
          notes: json.dataNotes,
        });
        setState('ready');
      } catch {
        if (cancelled || id !== scoreReq.current) return;
        setState('error');
        setFailure('scoring');
      }
    }
    run().finally(() => { if (!cancelled && id === scoreReq.current) setBusy(false); });
    return () => { cancelled = true; };
  }, [hasPlace, lat, lon, pinCode, floor, facing, areaWeight, scoreNonce]);

  /* ---------------- sun path for the map ---------------- */
  useEffect(() => {
    if (!hasPlace) return;
    const id = ++solarReq.current;
    const date = new Date().toISOString().slice(0, 10);
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
  }, [hasPlace, lat, lon, animating, animating ? null : minutes]);

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
    }),
    [scores]
  );

  // Coordinates land at once so the map and the flat's half react
  // immediately; the postcode and label follow from the reverse lookup,
  // which is what the area half needs.
  const moveTo = useCallback((toLat, toLon, label) => {
    if (!Number.isFinite(toLat) || !Number.isFinite(toLon)) return;
    setLocError('');
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
    if (reportRunning) { setLocError('The report is being built from this spot — let it finish, then move the pin.'); return; }
    moveTo(clickLat, clickLon, '');
  }, [moveTo, reportRunning]);

  const onSearchSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (reportRunning) { setLocError('The report is being built from this spot — let it finish, then search.'); return; }
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
    if (reportRunning) { setLocError('The report is being built from this spot — let it finish first.'); return; }
    if (!navigator.geolocation) { setLocError('This browser won\u2019t share your location.'); return; }
    setLocBusy(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocBusy(false); moveTo(pos.coords.latitude, pos.coords.longitude, ''); },
      () => { setLocBusy(false); setLocError('We couldn\u2019t get your location. Search the address instead.'); },
      { timeout: 10000 }
    );
  }, [moveTo, reportRunning]);

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
     the list is that you carry it around a flat and tick things off. */
  const [ticked, setTicked] = useState(() => new Set());
  const tickKey = hasPlace ? `bs-checklist:${lat.toFixed(5)},${lon.toFixed(5)}` : '';

  useEffect(() => {
    if (!tickKey) return;
    try {
      const raw = window.localStorage.getItem(tickKey);
      setTicked(new Set(raw ? JSON.parse(raw) : []));
    } catch { setTicked(new Set()); }
  }, [tickKey]);

  const toggleTick = useCallback((key) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      if (tickKey) {
        // Private browsing and blocked site data both throw here. Ticking
        // still works for this visit; it just won't be remembered.
        try { window.localStorage.setItem(tickKey, JSON.stringify([...next])); } catch {}
      }
      return next;
    });
  }, [tickKey]);

  // Only count ticks against items actually on the list. The ticks are
  // stored per address, but the list is derived from the floor and facing --
  // change the floor and items drop off it, which used to leave the counter
  // reading "3 of 1 checked".
  const tickedHere = useMemo(
    () => actions.filter((a) => ticked.has(a.key)).length,
    [actions, ticked]
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
  if (state === 'error') {
    return (
      <div className="bsr">
        <div className="bsr-empty">
          <h1>We couldn&apos;t score this address.</h1>
          <p>
            {failure === 'scoring'
              ? 'The scoring service didn’t answer. This is on us, not the address — try again in a moment.'
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

      {/* ---------- which address this is ---------- */}
      <header className="bsr-head">
        <p className="bsr-addr">
          <span className="bsr-pin" aria-hidden="true" />
          <span className="bsr-addr-text">{address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}</span>
        </p>
        <span className="bsr-head-links">
          <a href="/my-reports">My reports</a>
          <a href="/">Change address</a>
        </span>
      </header>

      {/* ---------- the answer, before anything else ---------- */}
      <section className={`bsr-answer is-${topTone}`} aria-live="polite">
        <p className="bsr-big">
          <span className="bsr-big-n">{topScore}</span>
          <span className="bsr-big-of">out of 100</span>
        </p>
        <div className="bsr-answer-say">
          <h1>{headlineFor(topScore, hasArea)}</h1>
          <p>
            {hasArea
              ? verdictSay(area.score, unit.score)
              : 'We don’t have neighbourhood records for this pin code yet, so this score is the flat on its own — sun, shade, view, privacy and airflow.'}
          </p>
        </div>

        {/* Sits with the number it changes -- nobody should have to scroll
            down, choose, and scroll back up to see what it did. */}
        {hasArea && (
          <div className="bsr-matters">
            <p className="bsr-q">What matters more to you?</p>
            <span className="bsr-opts">
              {[['The area', 0.7], ['Both equally', 0.5], ['The flat', 0.3]].map(([label, w]) => (
                <button key={label} type="button" aria-pressed={areaWeight === w} onClick={() => setAreaWeight(w)}>
                  {label}
                </button>
              ))}
            </span>
            <span className="bsr-matters-note">Changes this score only. The checklist below stays as it is.</span>
          </div>
        )}
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

              <ul className="bsr-rows">
                {factorKeys.map((k) => (
                  <li key={k}>
                    <span className="bsr-row-what">
                      {FACTOR_LABELS[k] || k}
                      {FACTOR_MEANS[k] ? <span className="bsr-row-note">{FACTOR_MEANS[k]}</span> : null}
                    </span>
                    <span className={`bsr-tag is-${toneOf(area.factors[k])}`}>{word(area.factors[k])}</span>
                  </li>
                ))}

                {aqi != null && (
                  <li>
                    <span className="bsr-row-what">
                      Air quality today
                      <span className="bsr-row-note">Live reading, AQI {aqi}</span>
                    </span>
                    <span className={`bsr-tag is-${aqi <= 100 ? 'good' : aqi <= 200 ? 'avg' : 'poor'}`}>{aqiWord(aqi)}</span>
                  </li>
                )}

                {missingKeys.filter((k) => !(k === 'air' && aqi != null)).map((k) => (
                  <li key={k}>
                    <span className="bsr-row-what">
                      {FACTOR_LABELS[k] || k}
                      <span className="bsr-row-note">Not in the records for this pin</span>
                    </span>
                    <span className="bsr-tag is-none">Not recorded</span>
                  </li>
                ))}
              </ul>

              <p className="bsr-more">
                {/* No rel="noopener" on purpose: that report's own Close
                    button is window.close(), which the browser refuses
                    without an opener. Same call AVAreaCard's link makes. */}
                <a href={`/neighbourhood-report/${area.pinCode}`} target="_blank">See the detailed area report →</a>
                <span className="bsr-more-note">
                  Every figure behind these, the schools by name and board, price band, and nearby localities compared.
                </span>
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
                      ? `We couldn't load the neighbourhood records for pin ${pinCode} just now — that's a fault on our side, not a gap in coverage. The flat's own scores below are unaffected.`
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

          <h2>{ord(floor)} floor, faces {facing.toLowerCase()}</h2>

          {/* Two inputs, said the way a form says them, directly under the
              title they change and directly above the score they move. */}
          <p className="bsr-set">
            <label>
              <span>Floor</span>
              <select
                value={floor}
                onChange={(e) => { setAssumed(false); setFloor(Number(e.target.value)); }}
              >
                {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>
              <span>Faces</span>
              <select
                value={facing}
                onChange={(e) => { setAssumed(false); setFacing(e.target.value); }}
              >
                {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            {assumed ? <span className="bsr-assumed">assumed — set yours</span> : null}
          </p>

          <p className="bsr-rating" aria-live="polite">
            <span className={`bsr-word is-${toneOf(unit.score)}`}>{word(unit.score)}</span>
            <span className="bsr-outof">{unit.score} out of 100</span>
            {busy ? <span className="bsr-busy">recalculating…</span> : null}
          </p>
          {/* The five scores below are computed off the 3D model further
              down the page. Without saying so they read as five numbers
              from nowhere. */}
          <p className="bsr-source">
            Worked out from the sun&apos;s real path over the buildings around this one.{' '}
            <a href="#the-block">See the block in 3D ↓</a>
          </p>


          <ul className="bsr-rows">
            {(unit.subScores || []).map((s) => (
              <li key={s.key}>
                <span className="bsr-row-what">
                  {s.label}
                  {s.summary ? <span className="bsr-row-note">{s.summary}</span> : null}
                </span>
                <span className={`bsr-tag is-${toneOf(s.score)}`}>{word(s.score)}</span>
              </li>
            ))}
          </ul>

          <p className="bsr-more">
            <button
              type="button"
              className="bsr-genlink"
              disabled={!solar?.pathData}
              title={!solar?.pathData ? 'The 3D map has to load first — there is nothing to photograph without it.' : undefined}
              onClick={() => setReportOpen('gallery')}
            >
              See the sun and shadow through the year →
            </button>
            <span className="bsr-more-note">
              The evidence behind the five scores above: this block photographed at 12 points through
              the year, 3 per season at 9am / noon / 3pm, each described, with the month-by-month
              sunlight figures for this floor. About a minute, and the full report below then builds
              on the same photographs instead of taking them again.
            </span>
          </p>
        </section>
      </div>

      {/* ---------- the map, full width ----------
          It lived inside the flat's card until the card's ~500px made
          Map3DShadow hide its own view-angle pad (its stylesheet drops
          .view-controls under 768px), so half the map was unreachable.
          Full width gives the controls back and gives the shadows room. */}
      <section className="bsr-mapzone" id="the-block" aria-label="The block in 3D">
        <p className="bsr-kicker">Where the flat&apos;s score comes from</p>
        <p className="bsr-mapzone-lede">
          The sun&apos;s path across this block today, over the real buildings around it. Sun, Shade &amp; Heat and
          Wind for the {ord(floor)} floor facing {facing.toLowerCase()} are read off this.{' '}
          <a href="#the-flat">Back to the flat&apos;s scores ↑</a>
        </p>
        <form className="bsr-locbar" onSubmit={onSearchSubmit}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Move to another address, or paste lat, lon"
            aria-label="Move to another address"
          />
          <button type="submit" disabled={locBusy}>{locBusy ? 'Finding…' : 'Go'}</button>
          <button type="button" className="bsr-loc-me" onClick={useMyLocation} disabled={locBusy}>
            Use my location
          </button>
        </form>
        {locError ? <p className="bsr-locerror">{locError}</p> : null}

        <div className="bsr-map">
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
        </div>

        <p className="bsr-timerow">
          <button
            type="button"
            className={`bsr-play${animating ? ' is-on' : ''}`}
            onClick={() => setAnimating((a) => !a)}
            aria-pressed={animating}
          >
            {animating ? '\u2759\u2759  Pause' : '\u25B6  Watch the day'}
          </button>
          {animating ? (
            <span className="bsr-sunhint">Sunrise to sunset, shadows falling where they really fall.</span>
          ) : (
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
        <p className="bsr-maphint">
          {reportRunning
            ? 'The pin is locked while the report is built from this spot — moving it now would mix two blocks into one report.'
            : 'Click anywhere on the map to move the pin to another building.'}
        </p>
      </section>

      <section className="bsr-visit">
        <h2>What to check before you decide</h2>
        <p className="bsr-visit-lede">
          These come from the weakest scores on this page. Tick them off as you go — the list doesn&apos;t
          change with the area-or-flat choice above, and your ticks are remembered on this device.
        </p>
        <ul className="bsr-todo">
          {actions.length === 0 ? (
            <li className="bsr-todo-plain">
              <span className="bsr-todo-body">
                <strong className="bsr-todo-title">Nothing scored poorly.</strong>
                <span className="bsr-todo-text">Still worth one visit at rush hour and one after dark before you commit.</span>
              </span>
            </li>
          ) : (
            actions.map((a) => (
              <li key={a.key} className={ticked.has(a.key) ? 'is-done' : undefined}>
                <label className="bsr-todo-row">
                  <input
                    type="checkbox"
                    className="bsr-box"
                    checked={ticked.has(a.key)}
                    onChange={() => toggleTick(a.key)}
                  />
                  <span className="bsr-todo-body">
                    <strong className="bsr-todo-title">{a.label} — {String(word(a.score)).toLowerCase()} ({a.score})</strong>
                    <span className="bsr-todo-text">{a.action}</span>
                  </span>
                </label>
              </li>
            ))
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
            ? 'One written verdict for this address — the area, the flat, and the two read together, with the questions to put to the seller. Downloadable as a PDF.'
            : 'One written verdict for this flat — the sun, the shade, the view and the questions to put to the seller. We have no neighbourhood records for this pincode, so this report covers the flat only. Downloadable as a PDF.'}
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
            ? 'Takes about two minutes. It builds here on this page, so you keep your floor and facing, and you open it when it\u2019s ready.'
            : 'Waiting for the 3D map — both reports are built from photographs of it, so there\u2019s nothing to make until it loads.'}
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
             report is ready — the full write-up", opening the gallery blob,
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
