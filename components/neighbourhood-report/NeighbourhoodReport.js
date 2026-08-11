'use client';
// components/neighbourhood-report/NeighbourhoodReport.js
//
// The full-page AsliVastu neighbourhood report, opened in a new tab from
// AVAreaCard's "View Full AsliVastu Report" link. This is a faithful port
// of AsliVastu's own report page (aslivastu/web/pages/report/[pin].js) —
// same corner-marked "blueprint frame" boxes, same hover "?" info tooltips,
// same persona/weight re-ranking, same dimension-readout / inspection-notes
// / price-band / comparison / detailed-readings content. Only the colours
// changed: BlindSpot's paper background, ink text, and var(--slate) accent
// instead of AV's own dark theme + wine accent.
//
// Left out on purpose, because they're tied to AV's own account/backend
// rather than being report *content*: PDF export, the feedback form, the
// broker-branding strip, "Save to BlindSpot" (redundant — this already is
// BlindSpot), the dark/light toggle (BlindSpot only has one theme), the
// live Leaflet map, and the non-functional "Commute reality check" teaser.
// Everything else — every score, every stat, every explanatory sentence —
// is here.

import { useState, useMemo } from 'react';
import AVDetailedReadout, { BPF, source, scoreColor, AQI_PLAIN, formatDateLong, inr } from '@/components/property-score/AVDetailedReadout';
import { FACTOR_LABELS } from '@/lib/property-score/ui';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap');
.nr { font-family: 'Barlow', sans-serif; }
.nr .cond { font-family: 'Barlow Condensed', sans-serif; }
.nr .kick { font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; color: var(--slate); margin: 0; }
.nr a { color: var(--slate); text-decoration: none; }
.nr a:hover { opacity: .75; }
.nr button { font-family: 'Barlow', sans-serif; cursor: pointer; }
.bpf-av { position: relative; }
.bpf-av > .m { position: absolute; color: var(--slate); font-size: 12px; line-height: 1; opacity: .5; }
@media (max-width: 900px) {
  .nr-hero3 { grid-template-columns: 1fr !important; }
  .nr-2col { grid-template-columns: 1fr !important; }
}
@media (max-width: 640px) {
  .nr-wrap { padding: 0 18px 48px !important; }
  .nr-hero-score { font-size: 60px !important; }
  .nr-hero-name { font-size: 38px !important; }
  .nr-dim-row { grid-template-columns: 1fr !important; gap: 6px !important; }
  .nr-dim-row .nr-dim-score { text-align: left !important; }
  .nr-table-scroll table th:nth-child(5), .nr-table-scroll table td:nth-child(5),
  .nr-table-scroll table th:nth-child(6), .nr-table-scroll table td:nth-child(6) { display: none; }
}
`;

// ── ported verbatim from AV's report page (persona weighting, dimension
// explain text, good/bad highlights) — logic and copy unchanged, only the
// colours around it changed. ────────────────────────────────────────────
const WEIGHT_PRESETS = {
  Default: { crime: 25, infrastructure: 20, air: 15, power: 10, schools: 10, water: 8, roads: 7, sewerage: 5 },
  Family: { crime: 20, infrastructure: 12, air: 12, power: 8, schools: 30, water: 8, roads: 5, sewerage: 5 },
  Investor: { crime: 12, infrastructure: 28, air: 8, power: 18, schools: 10, water: 6, roads: 12, sewerage: 6 },
  Safety: { crime: 40, infrastructure: 15, air: 12, power: 8, schools: 5, water: 8, roads: 5, sewerage: 7 },
};
function gradeFor(s) { return s == null ? '—' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : s >= 50 ? 'C+' : s >= 40 ? 'C' : 'D'; }
function verdictFor(nqi) {
  if (nqi >= 80) return { label: 'Strong Buy', why: 'Scores well across the board — few weak spots to worry about.' };
  if (nqi >= 60) return { label: 'Consider', why: 'Decent overall, with some weak dimensions worth inspecting on site before deciding.' };
  if (nqi >= 45) return { label: 'Below Average', why: 'Below the tracked-area average — compare nearby areas before committing.' };
  return { label: 'Avoid', why: 'Multiple dimensions score poorly — strongly recommend comparing alternatives.' };
}
function explain(k, r) {
  const city = r.city || 'Delhi NCR';
  switch (k) {
    case 'crime': return r.crime_percentile != null
      ? `${r.total_cognizable_crimes} crimes reported — safer than ${r.crime_percentile}% of tracked ${city} areas (${(r.crime_tier || '').toLowerCase()} tier).`
      : 'Cognizable crimes reported for the police catchment.';
    case 'infrastructure': return `${r.metro_stations_nearby || 0} operational metro station(s) · ${(r.highway_proximity || '—').toLowerCase()} highway access · ${(r.zone_type || 'mixed').toLowerCase()} zone.`;
    case 'air': return r.aqi_category ? `AQI ~${Math.round(r.aqi_avg)}, ${r.aqi_category} — ${AQI_PLAIN[r.aqi_category] || 'CPCB band.'}` : 'Live CPCB air-quality reading.';
    case 'power': return `${r.reliability || '—'} reliability · ~${r.avg_outage_hours ?? '—'} outage hrs/month via ${r.discom || 'the local DISCOM'}.`;
    case 'schools': return r.schools_count ? `${r.schools_count} CBSE school(s) mapped to this pin.` : 'No CBSE-affiliated school in this exact pin.';
    case 'water': return `${r.supply_hours ?? '—'} hrs daily supply · ${(r.tds_level || '—')} TDS · ${(r.water_coverage ?? r.coverage_pct) ?? '—'}% piped coverage.`;
    case 'roads': return `${r.road_condition || '—'} condition · ~${r.pothole_density ?? '—'} potholes/km · last resurfaced ${r.last_resurfaced || '—'}.`;
    case 'sewerage': { const wl = r.waterlogging_risk; const lvl = wl == null ? '—' : wl >= 4 ? 'low' : wl >= 3 ? 'moderate' : 'high';
      return `${lvl} monsoon waterlogging risk${r.flooding_incidents_annual ? ` — ~${r.flooding_incidents_annual} flooding incidents a year` : ''}.`; }
    default: return '';
  }
}
function highlights(r) {
  const good = [], bad = [], s = r.scores || {};
  if (s.crime >= 80) good.push('Very low crime — one of the safer areas.');
  else if (s.crime != null && s.crime < 40) bad.push('High crime rate — well above average.');
  if (s.infrastructure >= 70) good.push('Excellent connectivity — metro and highway access.');
  else if (s.infrastructure != null && s.infrastructure < 40) bad.push('Poor connectivity — limited metro/highway access.');
  if (s.air >= 80) good.push('Clean air — AQI consistently Good or Satisfactory.');
  else if (s.air != null && s.air < 50) bad.push('Poor air quality — AQI frequently in Poor range.');
  if (s.power >= 70) good.push('Reliable power supply — low outage frequency.');
  else if (s.power != null && s.power < 40) bad.push('Frequent power cuts — high outage hours.');
  if (s.schools >= 70) good.push('Strong CBSE school density near this pin.');
  if (r.waterlogging_risk != null && r.waterlogging_risk <= 2) bad.push(`High monsoon waterlogging risk${r.flooding_incidents_annual ? ` — ~${r.flooding_incidents_annual} flooding incidents a year` : ''}.`);
  if (s.water != null && s.water < 45) bad.push('Only limited daily water supply — budget for filtration/tankers.');
  return { good: good.slice(0, 3), bad: bad.slice(0, 3) };
}

export default function NeighbourhoodReport({ record, nearby }) {
  const [persona, setPersona] = useState('Default');
  const [customWeights, setCustomWeights] = useState({ ...WEIGHT_PRESETS.Default });

  const { nqi, grade, rows } = useMemo(() => {
    const w = persona === 'Custom' ? customWeights : WEIGHT_PRESETS[persona];
    const scores = record.scores || {};
    const keys = Object.keys(scores);
    const totalW = keys.reduce((sum, k) => sum + (w[k] || 0), 0) || 1;
    const composite = Math.round(keys.reduce((sum, k) => sum + scores[k] * (w[k] || 0), 0) / totalW);
    const rws = keys
      .map(k => ({ k, score: scores[k], weight: Math.round((w[k] || 0) / totalW * 100) }))
      .sort((a, b) => b.weight - a.weight || b.score - a.score);
    return { nqi: composite, grade: gradeFor(composite), rows: rws };
  }, [record, persona, customWeights]);

  const verdict = verdictFor(nqi);
  const { good, bad } = highlights(record);
  const pc = record.price_context;

  return (
    <div className="nr" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{CSS}</style>

      <div className="nr-wrap" style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 32px 64px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid color-mix(in srgb, var(--slate) 55%, transparent)' }}>
          <p className="kick" style={{ fontSize: 12 }}>Neighbourhood Intelligence · Spec Sheet</p>
          <a href="javascript:window.close()" style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid color-mix(in srgb, var(--slate) 45%, transparent)', borderRadius: 3, padding: '9px 16px', color: 'var(--text-mute)', flexShrink: 0, textDecoration: 'none' }}>← Close</a>
        </div>

        {/* ── Hero: 3 cards (Identity / Score / Verdict) ── */}
        <div className="nr-hero3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
          <BPF style={{ padding: 24 }}>
            <p className="kick">Sheet 01 · {record.area || record.city} · PIN {record.pin_code}</p>
            <h1 className="nr-hero-name cond" style={{ fontSize: 54, fontWeight: 700, lineHeight: .95, margin: '10px 0 8px', textTransform: 'uppercase' }}>{record.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
              {record.dimensions_scored || Object.keys(record.scores || {}).length}/{record.dimensions_total || Object.keys(record.scores || {}).length} dimensions · scored {formatDateLong(record.scored_at) || '—'}
            </p>
          </BPF>

          <BPF style={{ padding: 24 }}>
            <p className="kick">Composite index · {persona} weighting</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '8px 0 6px' }}>
              <span className="nr-hero-score cond" style={{ fontSize: 84, fontWeight: 700, lineHeight: .85, color: 'var(--text)' }}>{nqi}</span>
              <span className="cond" style={{ fontSize: 30, fontWeight: 700, color: 'var(--slate)', marginBottom: 12 }}>{grade}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>NQI · weighted mean of {rows.length} dimensions — switch profile to re-weight.</p>
          </BPF>

          <div style={{ background: scoreColor(nqi), color: '#fff', padding: 24, position: 'relative' }}>
            <p className="kick" style={{ color: 'rgba(255,255,255,.8)' }}>Verdict</p>
            <h2 className="cond" style={{ fontSize: 34, fontWeight: 700, margin: '8px 0 10px', textTransform: 'uppercase' }}>{verdict.label}</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'rgba(255,255,255,.92)' }}>{verdict.why}</p>
          </div>
        </div>

        {/* ── Persona toggle + legend ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', border: '1px solid color-mix(in srgb, var(--slate) 45%, transparent)' }}>
            {[...Object.keys(WEIGHT_PRESETS), 'Custom'].map((p, i) => (
              <button key={p} onClick={() => setPersona(p)} style={{
                fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', padding: '7px 14px', border: 'none', cursor: 'pointer',
                borderLeft: i ? '1px solid color-mix(in srgb, var(--slate) 45%, transparent)' : 'none',
                background: persona === p ? 'var(--slate)' : 'transparent', color: persona === p ? '#fff' : 'var(--text-mute)',
              }}>{p}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>AIR = LIVE FEED</strong> (daily) · all other channels estimated, gov. reports verified 2023–24 · rows re-rank with the selected profile
          </span>
        </div>

        {persona === 'Custom' && (
          <BPF style={{ marginBottom: 20, padding: '16px 20px' }}>
            <p className="kick">Custom weighting · drag to set your priorities</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {['crime', 'infrastructure', 'air', 'power', 'schools', 'water', 'roads', 'sewerage'].map(k => (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>{FACTOR_LABELS[k]}</span>
                    <span style={{ color: 'var(--slate)', fontWeight: 600 }}>{customWeights[k]}</span>
                  </div>
                  <input type="range" min="0" max="50" value={customWeights[k]}
                    onChange={e => setCustomWeights({ ...customWeights, [k]: +e.target.value })}
                    style={{ width: '100%', accentColor: 'var(--slate)' }} />
                </div>
              ))}
            </div>
          </BPF>
        )}

        {/* ── Dimension readout ── */}
        <BPF style={{ marginBottom: 24, padding: '0 24px 8px' }}>
          <p className="kick" style={{ padding: '16px 0 4px' }}>Dimension readout · weight = exact contribution to the {nqi}</p>
          {rows.map(row => {
            const weak = row.score < 50;
            const col = scoreColor(row.score);
            return (
              <div key={row.k} className="nr-dim-row" style={{ display: 'grid', gridTemplateColumns: '200px 52px 1fr 76px', gap: 14, alignItems: 'start', padding: '11px 0', borderTop: '1px dashed color-mix(in srgb, var(--slate) 35%, transparent)' }}>
                <div>
                  <div className="cond" style={{ fontSize: 18, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.1 }}>{FACTOR_LABELS[row.k]}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{source(row.k, record.city)}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', paddingTop: 4 }}>{row.weight}%</div>
                <div style={{ paddingTop: 2 }}>
                  <div style={{ height: 8, border: '1px solid color-mix(in srgb, var(--slate) 35%, transparent)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${row.score}%`,
                      background: weak ? undefined : col,
                      backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-mute)', margin: '6px 0 0', lineHeight: 1.45 }}>{explain(row.k, record)}</p>
                </div>
                <div className="nr-dim-score cond" style={{ fontSize: 26, fontWeight: 700, textAlign: 'right', color: col }}>{row.score}</div>
              </div>
            );
          })}
        </BPF>

        {/* ── Inspection notes + Price context ── */}
        <div className="nr-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <BPF style={{ padding: 20 }}>
            <p className="kick">Inspection Notes</p>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {good.map((g, i) => <div key={'g' + i} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.45 }}><span style={{ color: '#3D6B2E', fontWeight: 700 }}>✓</span><span style={{ color: 'var(--text-mute)' }}>{g}</span></div>)}
              {bad.map((b, i) => <div key={'b' + i} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.45 }}><span style={{ color: 'var(--slate)', fontWeight: 700 }}>✕</span><span style={{ color: 'var(--text-mute)' }}>{b}</span></div>)}
              {good.length + bad.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No standout flags either way.</span>}
            </div>
          </BPF>

          <BPF style={{ padding: '20px 22px' }}>
            <p className="kick">Price Context · Guidance Value</p>
            {pc?.rate_sqft ? (() => {
              const [lo, hi] = pc.rate_sqft;
              const bands = ['Premium', 'Upper', 'Mid', 'Modest', 'Value'];
              const ops = [1, .55, .3, .15, .07];
              const mLo = Math.round(lo * 1.2 / 100) * 100, mHi = Math.round(hi * 1.6 / 100) * 100;
              const blr = record.city === 'Bangalore';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 2px', flexWrap: 'wrap' }}>
                    <span className="cond" style={{ fontSize: 30, fontWeight: 700 }}>{inr(lo)}–{inr(hi)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>per sq ft · {pc.label?.toLowerCase()} band for {blr ? 'Bengaluru' : 'the NCR'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, margin: '14px 0 6px' }}>
                    {bands.map((b, i) => (
                      <div key={b} style={{ flex: 1 }}>
                        <div style={{ height: 7, background: 'var(--slate)', opacity: (i + 1) === pc.tier ? 1 : ops[i] }} />
                        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.04em', color: (i + 1) === pc.tier ? 'var(--slate)' : 'var(--text-dim)', marginTop: 5, fontWeight: (i + 1) === pc.tier ? 600 : 400 }}>{b}{(i + 1) === pc.tier ? ' ▲' : ''}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-mute)', margin: '12px 0 0', lineHeight: 1.5 }}>
                    Market prices run <strong style={{ color: 'var(--text)' }}>20–70% above</strong> the {blr ? 'guidance value' : 'circle rate'} — expect roughly <strong style={{ color: 'var(--text)' }}>{inr(mLo)}–{inr(mHi)}/sq ft</strong> in practice. Indicative government valuation, not a market quote; does not affect the score.
                  </p>
                </>
              );
            })() : <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>No price data for this pin.</p>}
          </BPF>
        </div>

        {/* ── Nearby comparison ── */}
        {nearby?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p className="kick" style={{ marginBottom: 14 }}>Comparison</p>
            <BPF style={{ padding: '18px 20px' }} className="nr-table-scroll">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ fontSize: 10.5, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '.05em' }}>
                      {['Area', 'NQI', 'Crime', 'Air', 'Water', 'Sewerage'].map((h, i) => (
                        <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '0 8px 10px 0', borderBottom: '1px solid color-mix(in srgb, var(--slate) 45%, transparent)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ fontWeight: 700, color: 'var(--slate)' }}>
                      <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.name} (this one)</td>
                      <td style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.nqi_composite}</td>
                      {['crime', 'air', 'water', 'sewerage'].map(f => (
                        <td key={f} style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.scores?.[f] ?? '—'}</td>
                      ))}
                    </tr>
                    {nearby.map(r => (
                      <tr key={r.pin_code}>
                        <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.name}</td>
                        <td style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.nqi_composite}</td>
                        {['crime', 'air', 'water', 'sewerage'].map(f => (
                          <td key={f} style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.scores?.[f] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nearby[0] && <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 0' }}>{record.name} {record.nqi_composite >= nearby[0].nqi_composite ? 'leads' : 'trails'} its nearest neighbour {nearby[0].name} on the composite index.</p>}
            </BPF>
          </div>
        )}

        {/* ── Full detailed breakdown (category cards + schools + methodology) ── */}
        <AVDetailedReadout record={record} />

        {/* ── Footer / scope note ── */}
        <div style={{ marginTop: 16, paddingTop: 20, borderTop: '1px solid color-mix(in srgb, var(--slate) 35%, transparent)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-mute)', lineHeight: 1.6, margin: '0 0 10px', maxWidth: 720 }}>
            <strong style={{ color: 'var(--text)' }}>Scope</strong> — this measures neighbourhood livability from government sources. Not a substitute for legal, title, or physical verification of a specific property.
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 720 }}>
            Data aggregations for informational and research purposes only, not real-estate, legal or financial advice. Most figures are estimated from government reports last verified 2023–24. Do not rely solely on these scores for a purchase decision.
          </p>
        </div>

      </div>
    </div>
  );
}
