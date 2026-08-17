'use client';
// components/sunscout/LiveScoreModal.js
// Ported from SunScout's components/LiveScoreModal.tsx. postMessage
// replaced with a direct onFloorFacingSubmit(floor, facing) callback --
// same-tree now, no cross-frame handoff needed.

import { useState } from 'react';
import LiveScoreCard from './LiveScoreCard';

const ORG = '#E07B00';
const INK = '#1A0A00';
const SUB = '#8A8A8A';
const LINE = 'rgba(26,10,0,0.15)';
const MONO = "'IBM Plex Mono', monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";
const DISPLAY = "'Space Grotesk', sans-serif";

const FACING = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

const SUBSCORE_WEIGHT_LABELS = [
  { key: 'sun', label: 'Sun' },
  { key: 'shadeHeat', label: 'Shade & Heat' },
  { key: 'view', label: 'View' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'wind', label: 'Wind' },
];

const DEFAULT_WEIGHTS = { sun: 30, shadeHeat: 25, view: 20, privacy: 15, wind: 10 };

export default function LiveScoreModal({ lat, lon, tzOffset, onClose, onFloorFacingSubmit, onResult }) {
  const [floor, setFloor] = useState('5');
  const [facing, setFacing] = useState('South');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    if (onFloorFacingSubmit) onFloorFacingSubmit(parseInt(floor, 10), facing);

    try {
      const params = new URLSearchParams({
        lat: String(lat), lon: String(lon), tzOffset: String(tzOffset),
        floor, facing,
        sunWeight: String(weights.sun), shadeHeatWeight: String(weights.shadeHeat),
        viewWeight: String(weights.view), privacyWeight: String(weights.privacy), windWeight: String(weights.wind),
      });
      const res = await fetch(`/api/sunscout/score?${params.toString()}`);
      if (!res.ok) throw new Error('score-failed');
      const data = await res.json();
      setResult(data);
      if (onResult) onResult({ liveScore: data.liveScore, grade: data.grade });
    } catch (e) {
      console.error('LiveScore generation failed:', e);
      setError("Could not compute a score for this unit right now. Try again in a minute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,5,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#FFFBF5', border: `1px solid ${LINE}`, padding: 0, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 90px rgba(0,0,0,0.35)', fontFamily: SANS }}>

        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 18px', borderBottom: `1px solid ${LINE}` }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: ORG, letterSpacing: '.14em', marginBottom: 6 }}>HOME COMFORT SCORE</div>
            <h2 className="modal-title" style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, color: INK, margin: 0 }}>Will This Unit Work For You?</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: SUB, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 24 }}>
          {!result && !loading && (
            <>
              <p style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginBottom: 26 }}>
                One score for this exact flat — sun, shade &amp; heat, view, privacy, and wind — with the full calculation shown, not just a number.
              </p>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 500, color: INK, letterSpacing: '.08em', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>Floor number</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="0" max="30" value={floor} onChange={e => setFloor(e.target.value)} style={{ flex: 1, accentColor: ORG }} />
                  <div style={{ background: INK, color: '#fff', fontFamily: MONO, fontSize: 13, fontWeight: 500, padding: '4px 12px', minWidth: 40, textAlign: 'center' }}>{floor}</div>
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 500, color: INK, letterSpacing: '.08em', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>Facing direction</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
                  {FACING.map(dir => (
                    <button key={dir} onClick={() => setFacing(dir)} style={{
                      background: facing === dir ? ORG : '#fff',
                      color: facing === dir ? '#fff' : INK,
                      border: `1px solid ${facing === dir ? ORG : LINE}`,
                      padding: '8px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      marginLeft: -1, marginTop: -1,
                    }}>{dir}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <button onClick={() => setShowWeights(!showWeights)} style={{
                  background: 'none', border: 'none', color: ORG, fontFamily: MONO, fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', padding: 0, letterSpacing: '.04em', textTransform: 'uppercase',
                }}>
                  [{showWeights ? '−' : '+'}] Customize weights
                </button>
                {showWeights && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${LINE}`, padding: 16 }}>
                    {SUBSCORE_WEIGHT_LABELS.map(({ key, label }) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700, color: INK }}>
                        <span style={{ width: 90, flexShrink: 0 }}>{label}</span>
                        <input
                          type="range" min="0" max="100" value={weights[key]}
                          onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                          style={{ flex: 1, accentColor: ORG }}
                        />
                        <span style={{ fontFamily: MONO, width: 28, textAlign: 'right', color: SUB, fontSize: 11 }}>{weights[key]}</span>
                      </label>
                    ))}
                    <div style={{ fontFamily: MONO, fontSize: 10, color: SUB, borderTop: `1px dashed ${LINE}`, paddingTop: 10 }}>
                      Weights are relative — normalized automatically, do not need to sum to 100.
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ border: '1px solid #dc2626', padding: '10px 14px', fontSize: 12, color: '#dc2626', marginBottom: 16, fontFamily: MONO }}>
                  ERROR: {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 0 }}>
                <button onClick={generate} style={{ flex: 1, background: ORG, color: '#fff', border: 'none', padding: '14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase' }}>
                  Get My Home Comfort Score
                </button>
                <button onClick={onClose} style={{ background: 'transparent', color: SUB, border: `1px solid ${LINE}`, borderLeft: 'none', padding: '14px 20px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{ marginBottom: 20, animation: 'ls-spin 1.6s linear infinite', display: 'inline-block', color: ORG }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
              </div>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 800, color: INK, marginBottom: 10 }}>Scoring this unit</h3>
              <p style={{ fontFamily: MONO, fontSize: 11.5, color: SUB, lineHeight: 1.8 }}>
                Checking sun geometry, nearby buildings, and wind data.
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              <LiveScoreCard result={result} />
              <div style={{ display: 'flex', gap: 0, marginTop: 20 }}>
                <button onClick={() => setResult(null)} style={{ flex: 1, background: 'transparent', color: INK, border: `1px solid ${LINE}`, padding: '12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase' }}>
                  ← Adjust &amp; Recalculate
                </button>
                <button onClick={onClose} style={{ background: INK, color: '#fff', border: 'none', padding: '12px 22px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase' }}>
                  Done
                </button>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes ls-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}
