'use client';
// components/sunscout/SunScoutPanel.js
// Native replacement for the old cross-origin iframe. Wires together the
// ported Map3DShadow, ReportModal, and LiveScoreModal. Location changes
// (click-on-map, search, or the parent's own lat/lon/GPS inputs) all
// bubble up to the parent via onLocationSelect, since BlindSpot's
// CombinedScoreFlow owns the actual lat/lon state.

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import ReportModal from './ReportModal';
import LiveScoreModal from './LiveScoreModal';

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
  lat, lon, address, onUnitSelected, onLiveScoreResult, onLocationSelect,
  // Combined-report context (AsliVastu record + combined/unit scores +
  // weights) forwarded straight through to ReportModal when the AI Report
  // is triggered from the Property Score flow via openReport(), rather than
  // from this panel's own toolbar (that button now lives in UnitVerdict).
  areaRecord, combinedScore, unitScore, areaWeight, unitWeight, unitSubScores, verdictLabel, personaId,
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
  const [showLiveScore, setShowLiveScore] = useState(false);
  const [reportPrefill, setReportPrefill] = useState(null); // { floor, facing } | null

  useImperativeHandle(ref, () => ({
    openReport(prefill) {
      setReportPrefill(prefill || null);
      setShowReport(true);
    },
  }), []);

  const captureRef = useRef(null);
  const screenshotResolverRef = useRef(null);
  const screenshotBufferRef = useRef([]);
  const screenshotIdxRef = useRef(0);

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
    console.log('[SunScoutPanel] Map3DShadow onReady fired — captureRef is now set');
  }, []);

  const handleScreenshot = useCallback((label, data) => {
    console.log(`[SunScoutPanel] screenshot received: "${label}" — ${data ? `${Math.round(data.length / 1024)}KB` : 'NULL (failed)'}`);
    if (data) screenshotBufferRef.current.push({ label, base64: data });
    screenshotIdxRef.current++;
    if (screenshotIdxRef.current < SHOTS.length) {
      const next = SHOTS[screenshotIdxRef.current];
      setTimeout(() => { captureRef.current?.(next.label, next.time, next.date); }, 350);
    } else if (screenshotResolverRef.current) {
      const buf = [...screenshotBufferRef.current];
      const totalKB = Math.round(buf.reduce((s, b) => s + b.base64.length, 0) / 1024);
      console.log(`[SunScoutPanel] all ${SHOTS.length} shots done — ${buf.length} captured successfully, ~${totalKB}KB total payload`);
      screenshotResolverRef.current(buf);
      screenshotResolverRef.current = null;
    }
  }, []);

  const captureScreenshots = useCallback(() => {
    console.log('[SunScoutPanel] captureRef.current is', captureRef.current ? 'SET' : 'NULL — Map3DShadow onReady may not have fired yet');
    return new Promise((resolve) => {
      screenshotBufferRef.current = [];
      screenshotIdxRef.current = 0;
      screenshotResolverRef.current = resolve;
      const first = SHOTS[0];
      setTimeout(() => { captureRef.current?.(first.label, first.time, first.date); }, 500);
    });
  }, []);

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
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: INK, fontWeight: 700, flexShrink: 0 }}>{simTime}</span>

        <div style={{ flex: '1 1 0', minWidth: 4 }} />
        <button onClick={() => setShowLiveScore(true)} style={{ background: INK, color: '#fff', border: 'none', borderRadius: 0, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '.03em', flexShrink: 0 }}>HOME COMFORT SCORE</button>
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: TEXT_SUB, padding: '5px 10px', background: '#FFFBF5', borderBottom: '1px solid rgba(224,123,0,0.08)' }}>
        Click anywhere on the map to move the pin — Home Comfort Score below and the AI Report (further down, once you confirm floor/facing) use wherever it lands.
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
            onScreenshot={handleScreenshot}
            onLocationSelect={onLocationSelect}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0C10', color: ORG, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
            {loading ? 'Loading solar data…' : 'No data yet'}
          </div>
        )}
      </div>

      {showReport && (
        <ReportModal
          lat={lat} lon={lon} tzOffset={tzOffset} address={address || searchQuery || undefined}
          onClose={() => { setShowReport(false); setReportPrefill(null); }}
          captureScreenshots={captureScreenshots}
          onFloorFacingSubmit={onUnitSelected}
          areaRecord={areaRecord} combinedScore={combinedScore} unitScore={unitScore}
          areaWeight={areaWeight} unitWeight={unitWeight}
          unitSubScores={unitSubScores} verdictLabel={verdictLabel}
          personaId={personaId}
          prefillFloor={reportPrefill?.floor} prefillFacing={reportPrefill?.facing}
        />
      )}
      {showLiveScore && (
        <LiveScoreModal
          lat={lat} lon={lon} tzOffset={tzOffset}
          onClose={() => setShowLiveScore(false)}
          onFloorFacingSubmit={onUnitSelected}
          onResult={onLiveScoreResult}
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
