'use client';
// components/sunscout/SunScoutPanel.js
// Native replacement for the old cross-origin iframe. Wires together the
// ported Map3DShadow and ReportModal. Location changes
// (click-on-map, search, or the parent's own lat/lon/GPS inputs) all
// bubble up to the parent via onLocationSelect, since BlindSpot's
// CombinedScoreFlow owns the actual lat/lon state.

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import ReportModal from './ReportModal';

const Map3DShadow = dynamic(() => import('./Map3DShadow'), { ssr: false });

const ORG = '#E07B00';
const INK = '#1A0A00';
const WHITE = '#FFFFFF';
const TEXT_SUB = '#777';

const SEASONS_TEMPLATE = {
  'Select Season': null,
  'Spring equinox': '-03-20',
  'Summer solstice': '-06-21',
  'Autumn equinox': '-10-15',
  'Winter solstice': '-12-21',
  'Custom date': 'custom',
};

const SHOTS = [
  { label:'Summer · 9am',   date:'2025-06-21', time:'09:00' },
  { label:'Summer · Noon',  date:'2025-06-21', time:'12:00' },
  { label:'Summer · 3pm',   date:'2025-06-21', time:'15:00' },
  { label:'Winter · 9am',   date:'2025-12-21', time:'09:00' },
  { label:'Winter · Noon',  date:'2025-12-21', time:'12:00' },
  { label:'Winter · 3pm',   date:'2025-12-21', time:'15:00' },
  { label:'Spring · 9am',   date:'2025-03-20', time:'09:00' },
  { label:'Spring · Noon',  date:'2025-03-20', time:'12:00' },
  { label:'Spring · 3pm',   date:'2025-03-20', time:'15:00' },
  { label:'Autumn · 9am',   date:'2025-09-23', time:'09:00' },
  { label:'Autumn · Noon',  date:'2025-09-23', time:'12:00' },
  { label:'Autumn · 3pm',   date:'2025-09-23', time:'15:00' },
];

function getLocalDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

const SunScoutPanel = forwardRef(function SunScoutPanel({
  lat, lon, address, onLocationSelect,
  // The full AI Report modal (below) has its own floor/facing picker,
  // separate from the plain Home Comfort Score picker that now lives
  // inline on the page in UnitVerdict -- this syncs *that* modal's
  // picks back up to the parent, same as it always did.
  onReportFloorFacing,
  // Combined-report context (AsliVastu record + combined/unit scores +
  // weights) forwarded straight through to ReportModal when the AI Report
  // is triggered from the Property Score flow via openReport(), rather than
  // from this panel's own toolbar (that button now lives in UnitVerdict).
  areaRecord, combinedScore, unitScore, areaWeight, unitWeight, unitSubScores, verdictLabel, personaId,
  // Fires with true/false as the report modal opens/closes. UnitVerdict
  // uses this to keep this whole panel visible while the report is open
  // even on the Verdict tab (see the comment on openReport() below for
  // why that matters) -- this component has no other way to tell its
  // parent that a modal it fully owns just opened.
  onReportOpenChange,
}, ref) {
  const [targetDate, setTargetDate] = useState(getLocalDateStr);
  const [simTime, setSimTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  });
  const [animating, setAnimating] = useState(true);
  const [solarData, setSolarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tzOffset, setTzOffset] = useState(330);
  const tzRef = useRef(330);

  const [season, setSeason] = useState('Select Season');
  const [SEASONS, setSEASONS] = useState({});
  const [showCustom, setShowCustom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [reportPrefill, setReportPrefill] = useState(null); // { floor, facing, customNote?, actionItems? } | null

  useImperativeHandle(ref, () => ({
    // Called from UnitVerdict's Verdict tab -- at that moment this whole
    // panel is sitting inside a display:none ancestor (see UnitVerdict's
    // showUnit), since the Verdict tab has no use for the map itself.
    // The modal we're about to show would be invisible under that same
    // display:none (a hidden ancestor hides its entire subtree, position
    // or z-index inside it notwithstanding) -- onReportOpenChange(true)
    // tells UnitVerdict to lift that hiding for as long as this stays
    // open, regardless of which tab is actually selected.
    openReport(prefill) {
      setReportPrefill(prefill || null);
      setShowReport(true);
      onReportOpenChange?.(true);
    },
  }), [onReportOpenChange]);

  const captureRef = useRef(null);
  const screenshotResolverRef = useRef(null);
  const screenshotRejecterRef = useRef(null);
  const screenshotBufferRef = useRef([]);
  const screenshotIdxRef = useRef(0);
  const screenshotWatchdogRef = useRef(null);

  useEffect(() => {
    const y = new Date().getFullYear();
    setSEASONS(Object.fromEntries(Object.entries(SEASONS_TEMPLATE).map(([k, v]) => [k, v && v !== 'custom' ? y + v : v])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      let tz = Math.round(lon / 15) * 60;
      try {
        const r = await fetch(`/api/sunscout/timezone?lat=${lat}&lon=${lon}`);
        const d = await r.json();
        if (typeof d.offsetMinutes === 'number') tz = d.offsetMinutes;
      } catch {}
      if (cancelled) return;
      setTzOffset(tz); tzRef.current = tz;
      setLoading(true);
      try {
        const d = await fetch(`/api/sunscout/solar?lat=${lat}&lon=${lon}&date=${targetDate}&tzOffset=${tz}&simTime=${simTime}`).then(r => r.json());
        if (!cancelled) setSolarData(d);
      } catch {} finally { if (!cancelled) setLoading(false); }
    }
    go();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, targetDate]);

  useEffect(() => {
    if (!animating) {
      fetch(`/api/sunscout/solar?lat=${lat}&lon=${lon}&date=${targetDate}&tzOffset=${tzRef.current}&simTime=${simTime}`)
        .then(r => r.json()).then(d => setSolarData(d)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simTime, animating]);

  const handleMapReady = useCallback((fn) => {
    captureRef.current = fn;
  }, []);

  // Real state of the iframe document, reported BY that document (see
  // Map3DShadow's notifyParent). 'loading' until its script has run and
  // registered its message listener; 'failed' if the map CDN or WebGL let
  // us down. Capture is only meaningful in 'ready'.
  const mapStatusRef = useRef('loading');
  const handleMapStatus = useCallback((status, reason) => {
    mapStatusRef.current = status;
    if (status === 'failed') console.warn('[SunScoutPanel] 3D map failed to initialise:', reason);
    // A failure arriving mid-capture ends the run now, with a reason,
    // instead of leaving it waiting on shots that can never arrive.
    if (status === 'failed' && screenshotRejecterRef.current) {
      finishCapture(new Error(`map-failed:${reason || 'unknown'}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearScreenshotWatchdog = () => {
    if (screenshotWatchdogRef.current) { clearTimeout(screenshotWatchdogRef.current); screenshotWatchdogRef.current = null; }
  };

  // Single exit point for a capture run, so no path can leave the promise
  // pending. Called with an Error to fail, or with nothing to resolve
  // whatever shots we managed to collect.
  const finishCapture = useCallback((err) => {
    clearScreenshotWatchdog();
    const resolveFn = screenshotResolverRef.current;
    const rejectFn = screenshotRejecterRef.current;
    screenshotResolverRef.current = null;
    screenshotRejecterRef.current = null;
    if (!resolveFn && !rejectFn) return;
    if (err) { rejectFn?.(err); return; }
    resolveFn?.([...screenshotBufferRef.current]);
  }, []);

  // Ask the iframe for one shot, and start the clock on it. Each shot has
  // ~4.2s of deliberate settle time inside the iframe before it composites,
  // so 20s is far past "slow"; a shot still missing by then is a shot that
  // is never coming (a wedged tile fetch, a lost postMessage, a document
  // that reloaded underneath us). Rather than hang -- which is exactly what
  // this used to do, indefinitely and silently -- we count it as a failed
  // frame and move to the next one. A report with 11 of 12 frames is a real
  // report; a spinner that never resolves is not.
  const requestShot = useCallback((index) => {
    const shot = SHOTS[index];
    if (!shot) return;
    clearScreenshotWatchdog();
    screenshotWatchdogRef.current = setTimeout(() => {
      if (!screenshotResolverRef.current) return;
      console.warn(`[SunScoutPanel] screenshot "${shot.label}" (${index + 1}/${SHOTS.length}) timed out, skipping it`);
      handleScreenshotRef.current?.(shot.label, null);
    }, 20000);
    captureRef.current?.(shot.label, shot.time, shot.date);
  }, []);

  // handleScreenshot and requestShot call each other; a ref breaks the
  // definition cycle without making either of them unstable.
  const handleScreenshotRef = useRef(null);

  const handleScreenshot = useCallback((label, data) => {
    // Not in a capture run (a stray late message from a previous
    // attempt): ignore rather than corrupting the next run's buffer.
    if (!screenshotResolverRef.current) return;
    if (data) screenshotBufferRef.current.push({ label, base64: data });
    screenshotIdxRef.current++;
    const done = screenshotIdxRef.current;
    // The capture phase is the long half of report generation -- twelve
    // frames at ~4.5s each, close to a minute. The progress bar used to
    // sit motionless at 5% for all of it, which reads as frozen, and is
    // most of why a slow-but-working run is indistinguishable from a
    // hung one. Walk it 5 -> 35 as the frames land.
    onCaptureProgressRef.current?.(done, SHOTS.length);
    if (done < SHOTS.length) {
      setTimeout(() => requestShot(done), 350);
      return;
    }
    clearScreenshotWatchdog();
    // Every single frame failed -- that's not a report worth writing, and
    // the analysis step downstream would produce nonsense from it. Fail
    // with something the person can act on instead.
    if (screenshotBufferRef.current.length === 0) {
      finishCapture(new Error('no-frames-captured'));
      return;
    }
    finishCapture();
  }, [requestShot, finishCapture]);

  useEffect(() => { handleScreenshotRef.current = handleScreenshot; }, [handleScreenshot]);

  const onCaptureProgressRef = useRef(null);

  const captureScreenshots = useCallback((onProgress) => {
    return new Promise((resolve, reject) => {
      screenshotBufferRef.current = [];
      screenshotIdxRef.current = 0;
      screenshotResolverRef.current = resolve;
      screenshotRejecterRef.current = reject;
      onCaptureProgressRef.current = onProgress || null;

      if (mapStatusRef.current === 'failed') {
        finishCapture(new Error('map-failed'));
        return;
      }

      // Wait for the iframe to actually announce itself before posting
      // anything into it. It usually already has (the map has been on
      // screen since the Unit step), so this is normally a no-op -- but
      // when it hasn't, polling for it is the difference between a clean
      // "the map didn't load" error and an eternal spinner.
      const startedAt = Date.now();
      const beginWhenReady = () => {
        if (!screenshotResolverRef.current) return; // cancelled
        if (mapStatusRef.current === 'ready') { requestShot(0); return; }
        if (mapStatusRef.current === 'failed') { finishCapture(new Error('map-failed')); return; }
        if (Date.now() - startedAt > 20000) {
          console.warn('[SunScoutPanel] 3D map never reported ready, aborting report generation');
          finishCapture(new Error('map-not-ready'));
          return;
        }
        setTimeout(beginWhenReady, 250);
      };
      setTimeout(beginWhenReady, 300);
    });
  }, [requestShot, finishCapture]);

  // Nothing may outlive this component: a pending run would otherwise keep
  // its timer alive and its promise unsettled forever.
  useEffect(() => () => {
    clearScreenshotWatchdog();
    if (screenshotRejecterRef.current) finishCapture(new Error('cancelled'));
  }, [finishCapture]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/sunscout/geocode?q=${encodeURIComponent(searchQuery)}`);
      const d = await r.json();
      if (d.result && onLocationSelect) onLocationSelect(d.result[0], d.result[1]);
    } catch {} finally { setSearching(false); }
  };

  const handleSeason = (s) => {
    setSeason(s);
    if (s === 'Custom date') { setShowCustom(true); return; }
    setShowCustom(false);
    if (s === 'Select Season') { setTargetDate(getLocalDateStr()); return; }
    const d = SEASONS[s]; if (d) setTargetDate(d);
  };

  const toggleAnim = () => setAnimating(a => !a);

  const data = solarData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Toolbar -- wraps naturally on narrow screens */}
      <div className="ss-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: WHITE, borderBottom: '1px solid rgba(224,123,0,0.15)', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6, flex: '1 1 160px', minWidth: 130 }}>
          <input placeholder="Search for landmarks" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onFocus={e => e.target.select()}
            style={{ flex: 1, minWidth: 0, padding: '6px 9px', fontSize: 12.5, borderRadius: 0, border: '1px solid rgba(224,123,0,0.25)', fontFamily: 'inherit' }} />
          <button type="submit" disabled={searching} style={{ background: ORG, color: '#fff', border: 'none', borderRadius: 0, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
            {searching ? '…' : '🔍'}
          </button>
        </form>

        <select value={season} onChange={e => handleSeason(e.target.value)}
          style={{ border: '1px solid rgba(224,123,0,0.25)', borderRadius: 0, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }}>
          {Object.keys(SEASONS_TEMPLATE).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {showCustom && (
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            style={{ border: '1px solid rgba(224,123,0,0.25)', borderRadius: 0, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }} />
        )}

        <button onClick={toggleAnim} style={{ display: 'flex', alignItems: 'center', gap: 5, background: animating ? ORG : WHITE, color: animating ? '#fff' : INK, border: `1px solid ${animating ? ORG : 'rgba(224,123,0,0.25)'}`, borderRadius: 0, padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          {animating ? '❙❙' : '▶'}
        </button>

        {!animating && (
          <input type="range" min="0" max="1439" value={(() => { const [h, m] = simTime.split(':').map(Number); return h * 60 + m; })()}
            onChange={e => { const mins = Number(e.target.value); const h = Math.floor(mins / 60), m = mins % 60; setSimTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`); }}
            style={{ flex: '1 1 80px', minWidth: 60, accentColor: ORG }} />
        )}
      </div>

      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, color: TEXT_SUB, padding: '5px 10px', background: '#FFFBF5', borderBottom: '1px solid rgba(224,123,0,0.08)' }}>
        Click anywhere on the map to move the pin, Home Comfort Score below and the AI Report (further down, once you confirm floor/facing) use wherever it lands.
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {data ? (
          <Map3DShadow
            lat={lat} lon={lon}
            pathData={data.pathData}
            simTime={simTime}
            simPos={data.simPos}
            sunTimes={data.sunTimes}
            animating={animating}
            onReady={handleMapReady}
            onStatus={handleMapStatus}
            onScreenshot={handleScreenshot}
            onLocationSelect={onLocationSelect}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0C10', color: ORG, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
            {loading ? 'Loading solar data…' : 'No data yet'}
          </div>
        )}
      </div>

      {showReport && (
        <ReportModal
          lat={lat} lon={lon} tzOffset={tzOffset} address={address || searchQuery || undefined}
          onClose={() => { setShowReport(false); setReportPrefill(null); onReportOpenChange?.(false); }}
          captureScreenshots={captureScreenshots}
          onFloorFacingSubmit={onReportFloorFacing}
          areaRecord={areaRecord} combinedScore={combinedScore} unitScore={unitScore}
          areaWeight={areaWeight} unitWeight={unitWeight}
          unitSubScores={unitSubScores} verdictLabel={verdictLabel}
          personaId={personaId}
          prefillFloor={reportPrefill?.floor} prefillFacing={reportPrefill?.facing}
          prefillCustomNote={reportPrefill?.customNote}
          prefillActionItems={reportPrefill?.actionItems}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          .ss-toolbar { gap: 6px; padding: 6px 8px; }
          .ss-toolbar input[type="text"] { font-size: 12px; }
        }
      `}</style>
    </div>
  );
});

export default SunScoutPanel;
