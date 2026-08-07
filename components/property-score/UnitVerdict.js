'use client';
// components/property-score/UnitVerdict.js
// Shared tail for both Property Score entry modes (locality-picked or
// direct-address). Renders the native SunScout panel for the exact pin,
// then either a combined AsliVastu+SunScout verdict (if an AsliVastu area
// was matched) or a SunScout-only Home Comfort Score (if not).

import { useState, useCallback, useEffect } from 'react';
import SunScoutPanel from '@/components/sunscout/SunScoutPanel';

const FACING_OPTS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

export default function UnitVerdict({ areaRecord, pinCode, city, lat, lon, setLat, setLon, addressLabel }) {
  const [floor, setFloor] = useState(null);
  const [facing, setFacing] = useState(null);
  const [capturedFromSS, setCapturedFromSS] = useState(false);
  const [ssPreview, setSsPreview] = useState(null);

  const [combined, setCombined] = useState(null);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const [combinedError, setCombinedError] = useState('');
  const [areaWeight, setAreaWeight] = useState(50);

  const [gpsError, setGpsError] = useState('');

  // A new location (new locality pick, or a fresh address confirm) should
  // clear out any stale verdict from the previous one.
  useEffect(() => {
    setCombined(null); setFloor(null); setFacing(null);
    setCapturedFromSS(false); setSsPreview(null); setAreaWeight(50);
  }, [pinCode, lat, lon]);

  const handleUnitSelected = useCallback((f, d) => {
    setFloor(f); setFacing(d); setCapturedFromSS(true); setCombined(null);
  }, []);
  const handleLiveScoreResult = useCallback((result) => { setSsPreview(result); }, []);
  const handleLocationSelect = useCallback((newLat, newLon) => {
    setLat(String(newLat)); setLon(String(newLon));
  }, [setLat, setLon]);

  const useMyLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) { setGpsError('This browser does not support location access.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLon(pos.coords.longitude.toFixed(6)); },
      err => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — check your browser/site settings and try again.'
            : 'Could not get your location right now — try entering lat/lon manually instead.'
        );
      }
    );
  };

  const computeCombined = useCallback(async (customAreaWeight, floorOverride, facingOverride) => {
    const useFloor = floorOverride ?? floor;
    const useFacing = facingOverride ?? facing;
    if (!lat || !lon || useFloor == null || !useFacing) return;
    const aw = customAreaWeight ?? areaWeight;
    setLoadingCombined(true);
    setCombinedError('');
    try {
      if (pinCode) {
        const params = new URLSearchParams({
          pin_code: pinCode, lat, lon, floor: String(useFloor), facing: useFacing, tzOffset: '330',
          weightArea: String(aw / 100), weightUnit: String((100 - aw) / 100),
        });
        const res = await fetch(`/api/property-score?${params}`);
        if (!res.ok) throw new Error('failed');
        setCombined(await res.json());
      } else {
        const params = new URLSearchParams({ lat, lon, floor: String(useFloor), facing: useFacing, tzOffset: '330' });
        const res = await fetch(`/api/sunscout/score?${params}`);
        if (!res.ok) throw new Error('failed');
        const ss = await res.json();
        setCombined({
          combinedScore: ss.liveScore,
          verdict: { label: 'Home Comfort Score', detail: 'No AsliVastu neighbourhood data for this pincode yet — this is the unit-only SunScout score.' },
          area: null,
          unit: { source: 'Home Comfort Score', floor: ss.unit?.floor ?? useFloor, facing: ss.unit?.facing ?? useFacing, score: ss.liveScore, grade: ss.grade, weight: 100, subScores: ss.subScores },
          formula: null,
          dataNotes: ss.dataNotes || [],
        });
      }
    } catch {
      setCombinedError('Could not compute the score right now — please try again in a minute.');
    } finally {
      setLoadingCombined(false);
    }
  }, [pinCode, lat, lon, floor, facing, areaWeight]);

  return (
    <>
      {/* SUNSCOUT PANEL */}
      <div style={{ marginBottom: 36 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>SUN &amp; SHADOW FOR THIS FLAT</div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)}
            style={{ flex: '1 1 140px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '9px 12px', color: 'var(--text)', fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" }} />
          <input type="text" placeholder="Longitude" value={lon} onChange={e => setLon(e.target.value)}
            style={{ flex: '1 1 140px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '9px 12px', color: 'var(--text)', fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" }} />
          <button onClick={useMyLocation} style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 3, padding: '9px 16px', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
            Use my location
          </button>
        </div>
        {gpsError && <div style={{ color: '#f87171', fontSize: 11.5, marginBottom: 10 }}>{gpsError}</div>}
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 14 }}>
          Use the <strong style={{ color: 'var(--sun)' }}>AI Report</strong> and <strong style={{ color: 'var(--sun)' }}>LIVESCORE</strong> buttons below for the full sun/shadow analysis and Home Comfort breakdown.
        </div>

        {lat && lon && (
          <>
            <div style={{ width: '100%', maxWidth: '100%', border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden', height: 680 }}>
              <SunScoutPanel
                lat={parseFloat(lat)} lon={parseFloat(lon)}
                address={addressLabel || areaRecord?.name || ''}
                onUnitSelected={handleUnitSelected}
                onLiveScoreResult={handleLiveScoreResult}
                onLocationSelect={handleLocationSelect}
              />
            </div>

            {capturedFromSS && (
              <div className="mono" style={{ fontSize: 11, color: '#4ADE80', marginTop: 14 }}>
                ✓ Using floor {floor}, {facing}-facing — picked above.
                {ssPreview && <> LiveScore came back {ssPreview.liveScore}/100 ({ssPreview.grade}).</>}
              </div>
            )}
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: capturedFromSS ? 4 : 14 }}>
              {!capturedFromSS && "Skip AI Report/LiveScore if you want — you'll be asked for floor/facing directly at the verdict step below instead."}
            </div>
          </>
        )}
      </div>

      {/* VERDICT */}
      {lat && lon && (
        <div style={{ marginBottom: 20 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text)', letterSpacing: '.12em', marginBottom: 12 }}>THE VERDICT</div>

          {!capturedFromSS && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', flexShrink: 0 }}>Floor</span>
                <input type="range" min="0" max="30" value={floor ?? 5} onChange={e => setFloor(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--sun)' }} />
                <div style={{ background: 'var(--sun)', color: '#fff', borderRadius: 3, padding: '4px 12px', fontSize: 13, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{floor ?? 5}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
                {FACING_OPTS.map(dir => (
                  <button key={dir} onClick={() => setFacing(dir)} style={{
                    background: facing === dir ? 'var(--sun)' : 'transparent', color: facing === dir ? '#fff' : 'var(--text)',
                    border: `1px solid ${facing === dir ? 'var(--sun)' : 'var(--line)'}`,
                    padding: '8px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginLeft: -1, marginTop: -1,
                  }}>{dir}</button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => computeCombined()} disabled={loadingCombined || floor == null || !facing}
            style={{
              background: (floor == null || !facing) ? 'var(--line)' : 'linear-gradient(90deg, var(--sun), var(--slate))',
              color: '#fff', border: 'none', borderRadius: 3, padding: '14px 24px', fontSize: 13, fontWeight: 700,
              cursor: (floor == null || !facing) ? 'default' : 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
              opacity: loadingCombined ? .6 : 1, marginBottom: 20,
            }}>
            {loadingCombined ? 'Computing…' : (areaRecord ? 'Get Combined Score' : 'Get Home Comfort Score')}
          </button>
          {combinedError && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>{combinedError}</div>}

          {combined && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 3, padding: '28px 26px', background: 'var(--bg-2)' }}>
              {combined.area && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 8 }}>
                    <span className="mono" style={{ color: 'var(--slate)' }}>AREA {areaWeight}%</span>
                    <span className="mono" style={{ color: 'var(--sun)' }}>UNIT {100 - areaWeight}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={areaWeight}
                    onChange={e => { const v = Number(e.target.value); setAreaWeight(v); computeCombined(v); }}
                    style={{ width: '100%', accentColor: 'var(--slate)' }} />
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>Starts 50/50 — drag anytime to change how much the neighbourhood matters vs. the specific flat.</div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 6 }}>
                    {combined.area ? 'BLINDSPOT COMBINED SCORE' : 'HOME COMFORT SCORE'}
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 56, lineHeight: 1, color: 'var(--text)' }}>
                    {combined.combinedScore}<span style={{ fontSize: 20, color: 'var(--text-dim)' }}>/100</span>
                  </div>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', background: 'linear-gradient(90deg, var(--sun), var(--slate))', padding: '8px 18px', borderRadius: 3 }}>
                  {combined.verdict.label}
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 24 }}>{combined.verdict.detail}</p>

              {combined.area ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 3, padding: '14px 16px' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>AREA — {combined.area.name} — {combined.area.weight}%</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--slate)' }}>{combined.area.score}</div>
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT (HOME COMFORT) — FL {combined.unit.floor}, {combined.unit.facing} — {combined.unit.weight}%</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--sun)' }}>{combined.unit.score}</div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px', marginBottom: 20 }}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT (HOME COMFORT) — FL {combined.unit.floor}, {combined.unit.facing}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--sun)' }}>{combined.unit.score}</div>
                </div>
              )}

              {combined.formula && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 3, padding: '12px 16px', marginBottom: 16 }}>
                  {combined.formula}
                </div>
              )}

              {combined.dataNotes?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  {combined.dataNotes.map((n, i) => <div key={i}>— {n}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
