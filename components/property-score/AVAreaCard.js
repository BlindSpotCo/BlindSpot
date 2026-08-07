'use client';
// components/property-score/AVAreaCard.js
// The full AsliVastu detail card: composite score, factor bars, and an
// expandable full report (nearby comparison, price context, crime
// deep-dive, schools, methodology). Shared by LocalityPicker (city/locality
// mode) and AddressPicker (direct-address mode) so both modes show the
// exact same detailed score before moving on to the SunScout panel.

import { useState } from 'react';
import { GradeBadge, FactorBar, nearestLocalities, inr, FACTOR_LABELS } from '@/lib/property-score/ui';

export default function AVAreaCard({ record, city, citiesData }) {
  const [showAvFullReport, setShowAvFullReport] = useState(false);

  return (
    <div style={{ marginBottom: 36, border: '1px solid var(--line)', borderLeft: '4px solid var(--slate)', borderRadius: 3, padding: '22px 24px' }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 10 }}>ASLIVASTU — {record.name.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 44, color: 'var(--slate)' }}>{record.nqi_composite}</span>
        <GradeBadge grade={record.grade} color="var(--slate)" />
        <span style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Pincode {record.pin_code}{city ? `, ${city}` : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px 24px', marginBottom: 18 }}>
        {Object.entries(record.scores || {}).map(([key, score]) => (
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
        const nearby = citiesData && city ? nearestLocalities(citiesData[city], record, 3) : [];
        const pc = record.price_context;
        return (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {nearby.length > 0 && (
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
                        <td style={{ padding: '8px 8px 8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.name} (this one)</td>
                        <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.nqi_composite}</td>
                        {['crime', 'air', 'water', 'sewerage'].map(f => (
                          <td key={f} style={{ textAlign: 'right', padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.scores?.[f] ?? '—'}</td>
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
            )}

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

            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>CRIME — DETAILED</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {[
                  ['Total crimes/yr', record.total_cognizable_crimes ?? '—'],
                  ['Safety score', `${record.scores?.crime ?? '—'}/100`],
                  ['Safer than', record.crime_percentile != null ? `${record.crime_percentile}% of areas` : '—'],
                  ['Crime tier', record.crime_tier ?? '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ border: '1px solid var(--line-soft)', borderRadius: 3, padding: '10px 12px' }}>
                    <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)', marginBottom: 4 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {record.schools_list?.length > 0 && (
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>SCHOOLS · {record.schools_count} MAPPED</div>
                <div style={{ border: '1px solid var(--line-soft)', borderRadius: 3 }}>
                  {record.schools_list.slice(0, 8).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, padding: '9px 12px', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                      <span style={{ color: 'var(--text)' }}>{s.name}</span>
                      <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10.5, flexShrink: 0 }}>{s.board || 'CBSE'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>METHODOLOGY · WEIGHTS</div>
              <div style={{ border: '1px solid var(--line-soft)', borderRadius: 3 }}>
                {Object.entries(record.weights_applied || {}).map(([k, w], i) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 12px', borderTop: i ? '1px dashed var(--line-soft)' : 'none' }}>
                    <span style={{ color: 'var(--text)' }}>{FACTOR_LABELS[k] || k}</span>
                    <span className="mono" style={{ color: 'var(--slate)' }}>{Math.round(w * 100)}%</span>
                  </div>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
                Scored {record.scored_at ? new Date(record.scored_at).toLocaleDateString() : '—'}.
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
