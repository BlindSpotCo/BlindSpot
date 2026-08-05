'use client';
// components/CombinedScoreFlow.js
// The actual "should you buy this" flow -- city -> locality (AsliVastu,
// searchable by name) -> a NATIVE SunScout panel (real ported code, running
// inside BlindSpot's own React tree -- no iframe, no external site) -> a
// weighted combined verdict. Lives directly on the BlindSpot landing page,
// right after the hero section.

import { useState, useEffect, useMemo, useCallback } from 'react';
import SunScoutPanel from './sunscout/SunScoutPanel';

const FACTOR_LABELS = {
  crime: 'Crime', infrastructure: 'Infrastructure', air: 'Air Quality',
  power: 'Power', schools: 'Schools', water: 'Water', roads: 'Roads', sewerage: 'Sewerage',
};
const FACING_OPTS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

function GradeBadge({ grade, color }) {
  return (
    <span style={{
      display: 'inline-block', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
      fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase',
      border: `1px solid ${color}`, color, padding: '4px 10px', borderRadius: 3,
    }}>
      {grade}
    </span>
  );
}

function nearestLocalities(all, current, n = 3) {
  if (!current?.lat || !current?.lon) return [];
  return all
    .filter(r => r.pin_code !== current.pin_code && r.lat && r.lon)
    .map(r => {
      const dLat = r.lat - current.lat, dLon = r.lon - current.lon;
      return { ...r, _dist: Math.sqrt(dLat * dLat + dLon * dLon) };
    })
    .sort((a, b) => a._dist - b._dist)
    .slice(0, n);
}

function inr(n) {
  if (n == null) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function FactorBar({ label, score }) {
  const color = score >= 75 ? '#4ADE80' : score >= 50 ? 'var(--slate)' : '#f87171';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 4 }}>
        <span>{label}</span><span className="mono" style={{ color: 'var(--text)' }}>{score}</span>
      </div>
      <div style={{ background: 'var(--line-soft)', height: 4, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

export default function CombinedScoreFlow() {
  const [citiesData, setCitiesData] = useState(null);
  const [citiesError, setCitiesError] = useState('');
  const [city, setCity] = useState(null);
  const [search, setSearch] = useState('');
  const [pinCode, setPinCode] = useState(null);
  const [showAvFullReport, setShowAvFullReport] = useState(false);

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [floor, setFloor] = useState(null);
  const [facing, setFacing] = useState(null);
  const [capturedFromSS, setCapturedFromSS] = useState(false);
  const [ssPreview, setSsPreview] = useState(null);

  const [combined, setCombined] = useState(null);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const [combinedError, setCombinedError] = useState('');
  const [areaWeight, setAreaWeight] = useState(50); // starts 50/50, always user-editable

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => setCitiesData(data.cities))
      .catch(() => setCitiesError('Could not load AsliVastu locality data right now.'));
  }, []);

  // Direct callbacks from the native SunScoutPanel -- same React tree now,
  // no postMessage needed. Fires whenever someone submits floor/facing
  // inside the AI Report or LiveScore modal.
  const handleUnitSelected = useCallback((f, d) => {
    setFloor(f);
    setFacing(d);
    setCapturedFromSS(true);
    setCombined(null);
  }, []);
  const handleLiveScoreResult = useCallback((result) => {
    setSsPreview(result);
  }, []);
  const handleLocationSelect = useCallback((newLat, newLon) => {
    setLat(String(newLat));
    setLon(String(newLon));
  }, []);

  const selectedAreaRecord = city && pinCode && citiesData
    ? citiesData[city].find(r => r.pin_code === pinCode)
    : null;

  const filteredLocalities = useMemo(() => {
    if (!city || !citiesData) return [];
    const list = citiesData[city];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(r => r.name.toLowerCase().includes(s) || (r.area || '').toLowerCase().includes(s) || r.pin_code.includes(s));
  }, [city, citiesData, search]);

  useEffect(() => {
    if (selectedAreaRecord?.lat && selectedAreaRecord?.lon && !lat && !lon) {
      setLat(String(selectedAreaRecord.lat));
      setLon(String(selectedAreaRecord.lon));
    }
  }, [selectedAreaRecord]);

  const [gpsError, setGpsError] = useState('');
  const useMyLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsError('This browser does not support location access.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLon(pos.coords.longitude.toFixed(6)); },
      err => {
        // Silent failure gave no feedback at all before -- now at least
        // says why, since "permission denied" and "no signal" need
        // different fixes from the user.
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — check your browser/site settings and try again.'
            : 'Could not get your location right now — try entering lat/lon manually instead.'
        );
      }
    );
  };

  const resetForNewLocality = () => {
    setCombined(null); setLat(''); setLon(''); setFloor(null); setFacing(null);
    setCapturedFromSS(false); setSsPreview(null); setShowAvFullReport(false);
    setAreaWeight(50); // always starts fresh at 50/50 for a new pick
  };

  const computeCombined = useCallback(async (customAreaWeight, floorOverride, facingOverride) => {
    const useFloor = floorOverride ?? floor;
    const useFacing = facingOverride ?? facing;
    if (!pinCode || !lat || !lon || useFloor == null || !useFacing) return;
    const aw = customAreaWeight ?? areaWeight;
    setLoadingCombined(true);
    setCombinedError('');
    try {
      const params = new URLSearchParams({
        pin_code: pinCode, lat, lon, floor: String(useFloor), facing: useFacing, tzOffset: '330',
        weightArea: String(aw / 100), weightUnit: String((100 - aw) / 100),
      });
      const res = await fetch(`/api/property-score?${params}`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setCombined(data);
    } catch {
      setCombinedError("Could not compute the combined score right now — please try again in a minute.");
    } finally {
      setLoadingCombined(false);
    }
  }, [pinCode, lat, lon, floor, facing, areaWeight]);

  return (
    <section className="section" id="combined-score" style={{ paddingTop: 64 }}>
      <div className="wrap section-inner">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">Should You Buy This?</span>
            <h2>Area, then unit, then the verdict.</h2>
          </div>
          <p>Search a neighbourhood, then check a specific flat in it. AsliVastu&apos;s area score and SunScout&apos;s live Home Comfort Score, combined into one answer you control the weighting of.</p>
        </div>

        {/* STEP 1 -- CITY */}
        <div style={{ marginBottom: 36 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--slate)', letterSpacing: '.12em', marginBottom: 12 }}>STEP 1 — CITY</div>
          {citiesError && <div style={{ color: '#f87171', fontSize: 13 }}>{citiesError}</div>}
          {!citiesData && !citiesError && <div className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading…</div>}
          {citiesData && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.keys(citiesData).map(c => (
                <button key={c} onClick={() => { setCity(c); setPinCode(null); setSearch(''); resetForNewLocality(); }}
                  style={{
                    background: city === c ? 'var(--slate)' : 'transparent', color: city === c ? '#fff' : 'var(--text)',
                    border: `1px solid ${city === c ? 'var(--slate)' : 'var(--line)'}`, borderRadius: 3,
                    padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {c} <span className="mono" style={{ fontSize: 10.5, opacity: .7 }}>({citiesData[c].length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* STEP 2 -- LOCALITY, SEARCHABLE BY NAME */}
        {city && citiesData && (
          <div style={{ marginBottom: 36 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--slate)', letterSpacing: '.12em', marginBottom: 12 }}>STEP 2 — LOCALITY</div>
            <input
              type="text" placeholder="Search by area name — Koramangala, Whitefield, Vasant Kunj…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '12px 14px', color: 'var(--text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 3 }}>
              {filteredLocalities.slice(0, 30).map(r => (
                <button key={r.pin_code} onClick={() => { setPinCode(r.pin_code); setSearch(r.name); resetForNewLocality(); }}
                  style={{
                    textAlign: 'left', background: pinCode === r.pin_code ? 'rgba(175,47,64,0.14)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--line-soft)', padding: '11px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                  <div>
                    <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{r.area ? `${r.area} · ` : ''}{r.pin_code}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--slate)' }}>{r.nqi_composite}</span>
                    <GradeBadge grade={r.grade} color="var(--slate)" />
                  </div>
                </button>
              ))}
              {filteredLocalities.length === 0 && (
                <div style={{ padding: 16, fontSize: 12.5, color: 'var(--text-dim)' }}>No localities match &ldquo;{search}&rdquo;.</div>
              )}
            </div>
          </div>
        )}

        {/* AV SCORE -- FULL FACTOR BREAKDOWN + INLINE FULL REPORT (no redirect) */}
        {selectedAreaRecord && (
          <div style={{ marginBottom: 36, border: '1px solid var(--line)', borderLeft: '4px solid var(--slate)', borderRadius: 3, padding: '22px 24px' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 10 }}>ASLIVASTU — {selectedAreaRecord.name.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 44, color: 'var(--slate)' }}>{selectedAreaRecord.nqi_composite}</span>
              <GradeBadge grade={selectedAreaRecord.grade} color="var(--slate)" />
              <span style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Pincode {selectedAreaRecord.pin_code}, {city}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px 24px', marginBottom: 18 }}>
              {Object.entries(selectedAreaRecord.scores || {}).map(([key, score]) => (
                <FactorBar key={key} label={FACTOR_LABELS[key] || key} score={score} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 16 }}>
              Area-level — the same for every unit in this pincode.
            </div>

            <button onClick={() => setShowAvFullReport(v => !v)}
              style={{ background: showAvFullReport ? 'var(--slate)' : 'transparent', color: showAvFullReport ? '#fff' : 'var(--slate)', border: '1px solid var(--slate)', borderRadius: 3, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {showAvFullReport ? 'Hide Full AsliVastu Report' : 'View Full AsliVastu Report'}
            </button>

            {showAvFullReport && (() => {
              const nearby = nearestLocalities(citiesData[city], selectedAreaRecord, 3);
              const pc = selectedAreaRecord.price_context;
              return (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Comparison table -- nearest 3 localities by map distance */}
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>NEARBY COMPARISON</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '.05em' }}>
                            {['Area', 'NQI', 'Crime', 'Air', 'Water', 'Sewerage'].map((h, i) => (
                              <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '0 8px 8px 0', borderBottom: '1px solid var(--line)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ fontWeight: 700, color: 'var(--slate)' }}>
                            <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{selectedAreaRecord.name} (this one)</td>
                            <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{selectedAreaRecord.nqi_composite}</td>
                            {['crime', 'air', 'water', 'sewerage'].map(f => (
                              <td key={f} style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{selectedAreaRecord.scores?.[f] ?? '—'}</td>
                            ))}
                          </tr>
                          {nearby.map(r => (
                            <tr key={r.pin_code} style={{ color: 'var(--text-mute)' }}>
                              <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{r.name}</td>
                              <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{r.nqi_composite}</td>
                              {['crime', 'air', 'water', 'sewerage'].map(f => (
                                <td key={f} style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{r.scores?.[f] ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Price context */}
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>PRICE CONTEXT · GUIDANCE VALUE</div>
                    {pc?.rate_sqft ? (
                      <>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>
                          {inr(pc.rate_sqft[0])}–{inr(pc.rate_sqft[1])} <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>per sq ft · {pc.label} band</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.6 }}>
                          Indicative government guidance value, not a market quote — actual market prices typically run 20–70% above this. Does not affect the score.
                        </div>
                      </>
                    ) : <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>No price data for this pincode.</div>}
                  </div>

                  {/* Crime deep-dive */}
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>CRIME — DETAILED</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                      {[
                        ['Total crimes/yr', selectedAreaRecord.total_cognizable_crimes ?? '—'],
                        ['Safety score', `${selectedAreaRecord.scores?.crime ?? '—'}/100`],
                        ['Safer than', selectedAreaRecord.crime_percentile != null ? `${selectedAreaRecord.crime_percentile}% of areas` : '—'],
                        ['Crime tier', selectedAreaRecord.crime_tier ?? '—'],
                      ].map(([label, val]) => (
                        <div key={label} style={{ border: '1px solid var(--line-soft)', borderRadius: 3, padding: '10px 12px' }}>
                          <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>{label.toUpperCase()}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schools */}
                  {selectedAreaRecord.schools_list?.length > 0 && (
                    <div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>SCHOOLS · {selectedAreaRecord.schools_count} MAPPED</div>
                      <div style={{ border: '1px solid var(--line-soft)', borderRadius: 3 }}>
                        {selectedAreaRecord.schools_list.slice(0, 8).map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '9px 12px', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                            <span style={{ color: 'var(--text)' }}>{s.name}</span>
                            <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10.5, flexShrink: 0 }}>{s.board || 'CBSE'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Methodology */}
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>METHODOLOGY · WEIGHTS</div>
                    <div style={{ border: '1px solid var(--line-soft)', borderRadius: 3 }}>
                      {Object.entries(selectedAreaRecord.weights_applied || {}).map(([k, w], i) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 12px', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                          <span style={{ color: 'var(--text)' }}>{FACTOR_LABELS[k] || k}</span>
                          <span className="mono" style={{ color: 'var(--slate)' }}>{Math.round(w * 100)}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
                      Scored {selectedAreaRecord.scored_at ? new Date(selectedAreaRecord.scored_at).toLocaleDateString() : '—'}.
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP 3 -- NATIVE SUNSCOUT PANEL (real ported code, no iframe) */}
        {selectedAreaRecord && (
          <div style={{ marginBottom: 36 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>STEP 3 — SUN &amp; SHADOW FOR THIS FLAT</div>

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
                {/* Contained within the normal content width -- no viewport-breakout
                    trick, which risked horizontal overflow on narrow/mobile screens.
                    Responsive height via a real media query (scoped styled-jsx, not
                    a guess from inline styles): tall enough to actually use on
                    desktop, shorter on phones so it doesn't eat the whole screen. */}
                <div className="ss-map-wrap" style={{
                  width: '100%', maxWidth: '100%',
                  border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden',
                }}>
                  <SunScoutPanel
                    lat={parseFloat(lat)} lon={parseFloat(lon)}
                    address={selectedAreaRecord.name}
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
        )}

        {/* STEP 4 -- COMBINED SCORE, 50/50 START, ALWAYS EDITABLE */}
        {selectedAreaRecord && lat && lon && (
          <div style={{ marginBottom: 20 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text)', letterSpacing: '.12em', marginBottom: 12 }}>STEP 4 — THE VERDICT</div>

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
              {loadingCombined ? 'Computing…' : 'Get Combined Score'}
            </button>
            {combinedError && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>{combinedError}</div>}

            {combined && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 3, padding: '28px 26px', background: 'var(--bg-2)' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 6 }}>BLINDSPOT COMBINED SCORE</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 56, lineHeight: 1, color: 'var(--text)' }}>
                      {combined.combinedScore}<span style={{ fontSize: 20, color: 'var(--text-dim)' }}>/100</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', background: 'linear-gradient(90deg, var(--sun), var(--slate))', padding: '8px 18px', borderRadius: 3 }}>
                    {combined.verdict.label}
                  </div>
                </div>

                <p style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 24 }}>{combined.verdict.detail}</p>

                <div className="ss-verdict-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 3, padding: '14px 16px' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>AREA — {combined.area.name} — {combined.area.weight}%</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--slate)' }}>{combined.area.score}</div>
                  </div>
                  <div style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT (HOME COMFORT) — FL {combined.unit.floor}, {combined.unit.facing} — {combined.unit.weight}%</div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--sun)' }}>{combined.unit.score}</div>
                  </div>
                </div>

                <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 3, padding: '12px 16px', marginBottom: 16 }}>
                  {combined.formula}
                </div>

                {combined.dataNotes?.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                    {combined.dataNotes.map((n, i) => <div key={i}>— {n}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .ss-map-wrap { height: 680px; }
        .ss-verdict-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 640px) {
          .ss-map-wrap { height: 400px; }
          .ss-verdict-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
