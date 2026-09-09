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
import useMapCapture from '@/lib/sunscout/useMapCapture';
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
    () => !params.get('floor') || !params.get('facing')
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

  const scoreReq = useRef(0);
  const solarReq = useRef(0);

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
            setState('ready');
            return;
          }
          // 404 here means "we don't have this locality", not a failure --
          // fall through to the unit-only path and say so on screen.
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
  }, [hasPlace, lat, lon, pinCode, floor, facing, areaWeight]);

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

  const onMapClick = useCallback((clickLat, clickLon) => moveTo(clickLat, clickLon, ''), [moveTo]);

  const onSearchSubmit = useCallback(async (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setLocBusy(true); setLocError('');
    try {
      const j = await fetch(`/api/sunscout/geocode?q=${encodeURIComponent(q)}`).then((r) => r.json());
      if (Array.isArray(j?.result)) { moveTo(j.result[0], j.result[1], q); setSearch(''); }
      else setLocError('We couldn\u2019t find that address. Try adding the city.');
    } catch {
      setLocError('The address lookup didn\u2019t answer. Try again in a moment.');
    } finally { setLocBusy(false); }
  }, [search, moveTo]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError('This browser won\u2019t share your location.'); return; }
    setLocBusy(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocBusy(false); moveTo(pos.coords.latitude, pos.coords.longitude, ''); },
      () => { setLocBusy(false); setLocError('We couldn\u2019t get your location. Search the address instead.'); },
      { timeout: 10000 }
    );
  }, [moveTo]);

  // The detailed area report (opened from here) posts this when someone
  // clicks "Continue to the flat" and closes itself. Without a listener the
  // tab just vanished and this page did nothing.
  const unitRef = useRef(null);
  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'blindspot:continue-to-unit') return;
      unitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const bumpFloor = useCallback((d) => { setAssumed(false); setFloor((f) => Math.max(1, Math.min(60, f + d))); }, []);


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
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${q.toString()}`);
  }, [hasPlace, lat, lon, pinCode, address, floor, facing]);

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
          <a className="bsr-cta" href="/">Try another address</a>
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
            {hasArea ? `Government records for pin ${area.pinCode}.` : 'Not covered yet.'}
          </p>

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
              <p>
                BlindSpot has neighbourhood records for Delhi NCR, Bangalore, Chandigarh, Hyderabad and Mumbai.
                This pin isn&apos;t in them yet, so we won&apos;t guess at safety, water or schools here.
              </p>
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
              onClick={() => setReportOpen('gallery')}
            >
              Generate the sun &amp; shadow report →
            </button>
            <span className="bsr-more-note">
              12 map angles at this exact pin, 3 per season at 9am / noon / 3pm, each with its own
              analysis — plus the monthly sunlight table for this floor.
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
            placeholder="Move to another address"
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
        <p className="bsr-maphint">Click anywhere on the map to move the pin to another building.</p>
      </section>

      <section className="bsr-visit">
        <h2>What to check before you decide</h2>
        <p className="bsr-visit-lede">
          These come from the weakest scores above. Take the list with you on the site visit — it stays the
          same whatever you choose below.
        </p>
        <ul className="bsr-todo">
          {actions.length === 0 ? (
            <li>
              <span className="bsr-box" aria-hidden="true" />
              <span className="bsr-todo-body">
                <strong className="bsr-todo-title">Nothing scored poorly.</strong>
                <span className="bsr-todo-text">Still worth one visit at rush hour and one after dark before you commit.</span>
              </span>
            </li>
          ) : (
            actions.map((a) => (
              <li key={a.key}>
                <span className="bsr-box" aria-hidden="true" />
                <span className="bsr-todo-body">
                  <strong className="bsr-todo-title">{a.label} — {String(word(a.score)).toLowerCase()} ({a.score})</strong>
                  <span className="bsr-todo-text">{a.action}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* ---------- weighting, asked as a question ---------- */}

      {/* ---------- the written verdict ---------- */}
      <section className="bsr-close">
        <h2>Every property has a <em>blindspot.</em></h2>
        <p>
          One written verdict for this address — the area, the flat, and the two read together, with the
          questions to put to the seller. Downloadable as a PDF.
        </p>
        <button
          type="button"
          className="bsr-cta"
          onClick={() => setReportOpen('full')}
        >
          Generate the full report
        </button>
        <span className="bsr-free">Opens in a new tab, so this page keeps your floor and facing. Your first address is free.</span>
        <span className="bsr-also">
          Already have the floor plan? <a href="/floor-plan-analysis">Get room-by-room furnishing advice →</a>
        </span>
      </section>

      {scores.notes?.length ? <p className="bsr-foot">{scores.notes.join(' ')}</p> : null}

      {reportOpen && (
        <ReportModal
          lat={lat}
          lon={lon}
          tzOffset={TZ}
          address={address}
          captureScreenshots={capture.captureScreenshots}
          galleryOnly={reportOpen === 'gallery'}
          prefillFloor={floor}
          prefillFacing={facing}
          unitScore={unit.score}
          unitSubScores={unit.subScores}
          areaRecord={reportOpen === 'full' ? avRecord : undefined}
          combinedScore={reportOpen === 'full' ? scores.combined : undefined}
          areaWeight={reportOpen === 'full' ? areaWeight : undefined}
          unitWeight={reportOpen === 'full' ? 1 - areaWeight : undefined}
          onClose={() => setReportOpen(null)}
        />
      )}
    </div>
  );
}
