'use client';
// components/neighbourhood-report/NeighbourhoodReport.js
//
// The full-page AsliVastu neighbourhood report, opened in a new tab from
// AVAreaCard's "View Full AsliVastu Report" link. This is a faithful port
// of AsliVastu's own report page (aslivastu/web/pages/report/[pin].js) - 
// same corner-marked "blueprint frame" boxes, same hover "?" info tooltips,
// same persona/weight re-ranking, same dimension-readout / inspection-notes
// / price-band / comparison / detailed-readings content. Only the colours
// changed: BlindSpot's paper background, ink text, and var(--slate) accent
// instead of AV's own dark theme + wine accent.
//
// Left out on purpose, because they're tied to AV's own account/backend
// rather than being report *content*: PDF export, the feedback form, the
// broker-branding strip, "Save to BlindSpot" (redundant - this already is
// BlindSpot), the dark/light toggle (BlindSpot only has one theme), the
// live Leaflet map, and the non-functional "Commute reality check" teaser.
// Everything else - every score, every stat, every explanatory sentence - 
// is here.

import { useState, useMemo } from 'react';
import AVDetailedReadout, { BPF, source, scoreColor, verdictFor, explain, AQI_PLAIN, formatDateLong, inr, Info } from '@/components/property-score/AVDetailedReadout';
import { ShieldCheck, GraduationCap, Wind, Droplets, Zap, Route, Building2, Waves } from 'lucide-react';
import { FACTOR_LABELS } from '@/lib/property-score/ui';
import { cityMeta } from '@/lib/aslivastu/cityMeta';
import useLiveAqi from '@/lib/aslivastu/useLiveAqi';
import { gradeFor } from '@/lib/aslivastu/aqi';
import SaveReportButton from '@/components/reports/SaveReportButton';

// Same icon-per-row + word()/toneOf() pattern as the main report's
// .bsr-rows (components/report/ReportScreen.js) -- identical FACTOR_LABELS
// keys, identical score thresholds, so a dimension graded "Good" here
// reads exactly like "Good" on the report page.
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

/* Used to import Barlow/Barlow Condensed and set them as this page's
   body/heading fonts -- a pair the rest of the site never loads
   (layout.js loads Anton, Inter, IBM Plex Mono). That's
   why this report page read as visibly off-brand from the rest of
   BlindSpot. Body font is now Inter (the site's actual body font,
   already loaded globally, no import needed); .kick now matches the
   site's own .mono eyebrow treatment (IBM Plex Mono); every former
   `.cond` heading/number is fixed individually inline further down --
   plain Inter bold for the locality name (matching .hero h1 / .section
   h2, the real site has no separate display font), Anton
   for numeric readouts, same mapping the property-score card and the
   homepage mockup use. */
const CSS = `
.nr { font-family: 'Geist', sans-serif; }
.nr .kick { font-family: 'Geist Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; color: var(--slate); margin: 0; }
.nr a { color: var(--slate); text-decoration: none; }
.nr a:hover { opacity: .75; }
.nr button { font-family: 'Geist', sans-serif; cursor: pointer; }
.bpf-av { position: relative; }
.bpf-av > .m { position: absolute; color: var(--slate); font-size: 12px; line-height: 1; opacity: .5; }
/* The hero row, its 3 boxes and the dimension-readout rows used to have
   their own .nr-hero3/.nr-hero-name/.nr-hero-score/.nr-dim-row rules
   here, duplicating what AVAreaCard.js had under different class names.
   Both now render the shared .avsheet-* classes in globals.css instead
   (mobile breakpoints included), so there's nothing left to duplicate. */
@media (max-width: 900px) {
  .nr-2col { grid-template-columns: 1fr !important; }
}
@media (max-width: 640px) {
  .nr-wrap { padding: 28px 18px 48px !important; }
  .nr-table-scroll table th:nth-child(5), .nr-table-scroll table td:nth-child(5),
  .nr-table-scroll table th:nth-child(6), .nr-table-scroll table td:nth-child(6) { display: none; }
}

/* Dimension readout rows -- same icon + pill-tag pattern as the main
   report's .bsr-rows (components/report/report.css): same word()/toneOf()
   thresholds, same tag colours (the site's global --success/--warning/
   --danger, identical hex to the report's --bsr-good/avg/poor tokens),
   not a separate palette or the old striped/hatched score bar. Score and
   weight stay visible here (this readout is denser than the report's
   summary rows) -- just restyled to sit quietly beside the tag. */
.nr-rows{ list-style:none;margin:0;padding:0;border-top:1px solid var(--line); }
.nr-row{
  display:flex;align-items:flex-start;gap:14px;padding:16px 0;
  border-bottom:1px solid var(--line);
}
.nr-row:last-child{ border-bottom:0; }
.nr-row-icon{ flex:none;margin-top:2px;color:var(--slate); }
.nr-row-what{ flex:1;min-width:0; }
.nr-row-label{ display:block;font-size:15px;font-weight:700;color:var(--ink); }
.nr-row-note{ display:block;font-size:11.5px;color:var(--text-dim);margin-top:3px; }
.nr-row-explain{ display:block;font-size:12.5px;color:var(--text-mute);line-height:1.5;margin-top:5px; }
.nr-row-right{ flex:none;display:flex;align-items:center;gap:12px;padding-top:1px; }
.nr-row-score{ font-family:'Geist',sans-serif;font-size:20px;font-weight:400;color:var(--text-mute);min-width:24px;text-align:right; }
.nr-tag{
  flex:none;font-size:12.5px;font-weight:600;
  padding:3px 11px;line-height:1.5;border-radius:20px;white-space:nowrap;
}
.nr-tag.is-good{ background:color-mix(in srgb, var(--success) 16%, var(--paper)); color:var(--success); }
.nr-tag.is-avg{ background:color-mix(in srgb, var(--warning) 18%, var(--paper)); color:var(--warning); }
.nr-tag.is-poor{ background:color-mix(in srgb, var(--danger) 14%, var(--paper)); color:var(--danger); }
@media (max-width: 640px) {
  .nr-row{ flex-wrap:wrap; gap:10px 14px; }
  .nr-row-what{ flex-basis:100%; order:1; }
  .nr-row-icon{ order:0; }
  .nr-row-right{ order:2; margin-left:32px; }
}
`;

// ── ported verbatim from AV's report page (persona weighting, dimension
// explain text, good/bad highlights) - logic and copy unchanged, only the
// colours around it changed. ────────────────────────────────────────────
const WEIGHT_PRESETS = {
  Default: { crime: 25, infrastructure: 20, air: 15, power: 10, schools: 10, water: 8, roads: 7, sewerage: 5 },
  Family: { crime: 20, infrastructure: 12, air: 12, power: 8, schools: 30, water: 8, roads: 5, sewerage: 5 },
  Investor: { crime: 12, infrastructure: 28, air: 8, power: 18, schools: 10, water: 6, roads: 12, sewerage: 6 },
  Safety: { crime: 40, infrastructure: 15, air: 12, power: 8, schools: 5, water: 8, roads: 5, sewerage: 7 },
};
// gradeFor used to be defined here too, byte-identical to the copy in the
// scoring pipeline. Now imported from lib/aslivastu/aqi.js so the live
// merge and the persona re-weighting below can't grade the same composite
// differently.
function highlights(r) {
  const good = [], bad = [], s = r.scores || {};
  if (s.crime >= 80) good.push('Very low crime, one of the safer areas.');
  else if (s.crime != null && s.crime < 40) bad.push('High crime rate, well above average.');
  if (s.infrastructure >= 70) good.push('Excellent connectivity, metro and highway access.');
  else if (s.infrastructure != null && s.infrastructure < 40) bad.push('Poor connectivity, limited metro/highway access.');
  if (s.air >= 80) good.push('Clean air, AQI consistently Good or Satisfactory.');
  else if (s.air != null && s.air < 50) bad.push('Poor air quality, AQI frequently in Poor range.');
  if (s.power >= 70) good.push('Reliable power supply, low outage frequency.');
  else if (s.power != null && s.power < 40) bad.push('Frequent power cuts, high outage hours.');
  if (s.schools >= 70) good.push('Strong CBSE school density near this pin.');
  if (r.waterlogging_risk != null && r.waterlogging_risk <= 2) bad.push(`High monsoon waterlogging risk${r.flooding_incidents_annual ? `, ~${r.flooding_incidents_annual} flooding incidents a year` : ''}.`);
  if (s.water != null && s.water < 45) bad.push('Only limited daily water supply, budget for filtration/tankers.');
  return { good: good.slice(0, 3), bad: bad.slice(0, 3) };
}

export default function NeighbourhoodReport({ record: rawRecord, nearby }) {
  // Same live-AQI merge the property-score card uses (shared hook), so
  // both surfaces show the same reading and the same recomputed composite
  // for a given pin. Falls back to the stored snapshot when no live
  // reading is available.
  const record = useLiveAqi(rawRecord);
  const [closeHint, setCloseHint] = useState(false);

  const { nqi, grade, rows, coverage, missing } = useMemo(() => {
    const w = WEIGHT_PRESETS.Default;
    const scores = record.scores || {};
    const keys = Object.keys(scores).filter(k => scores[k] != null);
    const totalW = keys.reduce((sum, k) => sum + (w[k] || 0), 0) || 1;
    const composite = Math.round(keys.reduce((sum, k) => sum + scores[k] * (w[k] || 0), 0) / totalW);
    const rws = keys
      .map(k => ({ k, score: scores[k], weight: Math.round((w[k] || 0) / totalW * 100) }))
      .sort((a, b) => b.weight - a.weight || b.score - a.score);
    // The composite renormalises over whatever factors a pincode has, so a
    // record holding two of the eight still produces a confident number in
    // the same type as a complete one. 42 of the 309 localities are scored
    // on an incomplete set, and one -- Dharuhera, 123106 -- has no crime
    // data at all, the heaviest weight in the model, and reads 76 / B+ on a
    // public, indexed page. A score standing on a quarter of the model has
    // to say so.
    return {
      nqi: composite,
      grade: gradeFor(composite),
      rows: rws,
      coverage: Math.round(totalW),
      missing: Object.keys(w).filter(k => scores[k] == null),
    };
  }, [record]);

  const verdict = verdictFor(nqi);
  const { good, bad } = highlights(record);
  const pc = record.price_context;

  // window.close() only works on a tab the browser considers "opened by
  // script" (i.e. window.opener is set) - that's why AVAreaCard's link now
  // drops rel="noopener". If the tab was still opened some other way (a
  // browser's own "open in new tab" context-menu action, a bookmark, etc.),
  // there's no opener either way and the browser silently refuses to close
  // it - so fall back to telling the person to close the tab themselves
  // instead of a dead button.
  function handleClose() {
    window.close();
    setTimeout(() => setCloseHint(true), 300);
  }

  return (
    <div className="nr" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{CSS}</style>

      <div className="nr-wrap" style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 32px 64px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid color-mix(in srgb, var(--slate) 55%, transparent)' }}>
          <p className="kick" style={{ fontSize: 12 }}>Neighbourhood Intelligence · Spec Sheet</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {closeHint && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Couldn&apos;t close automatically, you can close this tab yourself.</span>}
            <SaveReportButton
              source="neighbourhood"
              data={record}
              defaultTitle={`${record.name} · PIN ${record.pin_code}`}
            />
            <button onClick={handleClose} style={{ fontSize: 12.5, fontWeight: 600, border: '1px solid color-mix(in srgb, var(--slate) 45%, transparent)', borderRadius: 3, padding: '9px 16px', color: 'var(--text-mute)', background: 'transparent' }}>← Close</button>
          </div>
        </div>

        {/* ── Hero: 3 boxes (Identity / Score / Verdict) ──
            Every size/spacing/colour here comes from the shared
            `.avsheet-*` block in globals.css, which AVAreaCard.js (the
            same sheet, inside the property-score flow) renders against
            too. Nothing sizing-related is set inline anymore -- that
            duplication is exactly why the two surfaces kept drifting
            apart. See the comment on that CSS block for the full
            reasoning. */}
        <div className="avsheet-hero">
          <BPF className="avsheet-box">
            <p className="avsheet-label" style={{ color: 'var(--slate)' }}>Sheet 01 · {record.area || record.city} · PIN {record.pin_code}</p>
            <h1 className="avsheet-name">{record.name}</h1>
            <p className="avsheet-meta">
              {record.dimensions_scored || Object.keys(record.scores || {}).length}/{record.dimensions_total || Object.keys(record.scores || {}).length} dimensions · scored {formatDateLong(record.scored_at) || '-'}
            </p>
          </BPF>

          <BPF className="avsheet-box">
            <p className="avsheet-label" style={{ color: 'var(--slate)' }}>Composite index</p>
            <div className="avsheet-scorerow">
              <span className="avsheet-score">{nqi}</span>
              <span className="avsheet-grade">{grade}</span>
            </div>
            <p className="avsheet-cap">
              NQI · weighted mean of {rows.length} of 8 dimensions
              {coverage < 100 ? ` · ${coverage}% of the model` : ''}.
            </p>
            {coverage < 100 && (
              <p className="avsheet-note" style={{ color: 'var(--warning)' }}>
                We have no records for {missing.map(k => (FACTOR_LABELS[k] || k).toLowerCase()).join(', ')} in
                this pincode, so this score is worked out from the {`${coverage}%`} of the model we do have{coverage < 60 ? ' - treat it as indicative rather than settled' : ''}.
              </p>
            )}
            {/* Present on AsliVastu's own live report card, missing here --
                a real, load-bearing caveat (this is a PIN-level assessment,
                not building-specific), not just decoration. */}
            <p className="avsheet-note">First-pass area assessment · reflects this PIN, not a specific building or street.</p>
          </BPF>

          {/* No card here any more -- flush on the page background like
              the rest of the hero row, same autumn scoreColor(nqi) ramp
              used everywhere else on the report as the word's own text
              colour, never AsliVastu's own wine/red brand colour. Per-record,
              so this stays inline. */}
          <div className="avsheet-verdict">
            <p className="avsheet-label" style={{ color: 'var(--slate)', opacity: .75 }}>Verdict</p>
            <h2 className="avsheet-verdict-word" style={{ color: scoreColor(nqi) }}>{verdict.label}</h2>
            <p className="avsheet-verdict-why" style={{ color: 'var(--text-mute)' }}>{verdict.why}</p>
          </div>
        </div>

        {/* ── Guidance Value (Price Context) -- moved to the top: this is
            the number people trust most since it's backed by the
            government record, not a scraped market estimate. Was
            previously buried below the dimension readout. */}
        <BPF style={{ padding: '20px 22px', marginBottom: 20 }}>
          {/* Heading used to hardcode "Guidance Value" -- Karnataka's
              term -- on every city including Delhi, whose own records
              say circle rate. Now follows the record's city. */}
          <p className="kick">{cityMeta(record.city).rateTermTitle}<Info text={cityMeta(record.city).rateTermNote} /> <span style={{ color: 'var(--text-dim)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· official government valuation</span></p>
          {pc?.rate_sqft ? (() => {
            const [lo, hi] = pc.rate_sqft;
            const bands = ['Premium', 'Upper', 'Mid', 'Modest', 'Value'];
            const ops = [1, .55, .3, .15, .07];
            const cm = cityMeta(record.city);
            const [mktLo, mktHi] = cm.marketMultiplier;
            const mLo = Math.round(lo * mktLo / 100) * 100, mHi = Math.round(hi * mktHi / 100) * 100;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 2px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 30, fontWeight: 400 }}>{inr(lo)}–{inr(hi)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>per sq ft · {pc.label?.toLowerCase()} band for {cm.shortName}</span>
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
                  Market prices run <strong style={{ color: 'var(--text)' }}>{cm.marketGapLabel}</strong> the {cm.rateTerm}, expect roughly <strong style={{ color: 'var(--text)' }}>{inr(mLo)}–{inr(mHi)}/sq ft</strong> in practice. Indicative government valuation, not a market quote; does not affect the score.
                </p>
              </>
            );
          })() : <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 10 }}>No price data for this pin.</p>}
        </BPF>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text)' }}>AIR = LIVE FEED</strong> (daily) · all other channels estimated, gov. reports verified 2023–24
          </span>
        </div>

        {/* ── Dimension readout ── */}
        {/* Deliberately NOT dark -- mixed theme, same as AVAreaCard.js:
            dark hero cards (Identity/Composite/Verdict) on top, light
            data table below, not an all-dark page. Score number goes
            back to scoreColor(row.score) as its own text colour -- fine
            on light paper even for the darkest tiers. */}
        <BPF className="avsheet-readout">
          <p className="avsheet-label avsheet-readout-label">Dimension readout · weight = exact contribution to the {nqi}</p>
          <ul className="nr-rows">
            {rows.map(row => {
              const RowIcon = FACTOR_ICONS[row.k];
              return (
                <li key={row.k} className="nr-row">
                  {RowIcon ? <RowIcon className="nr-row-icon" size={18} strokeWidth={2} aria-hidden="true" /> : null}
                  <span className="nr-row-what">
                    <span className="nr-row-label">{FACTOR_LABELS[row.k]}</span>
                    <span className="nr-row-note">{source(row.k, record.city)} · {row.weight}% weight</span>
                    <span className="nr-row-explain">{explain(row.k, record)}</span>
                  </span>
                  <span className="nr-row-right">
                    <span className="nr-row-score">{row.score}</span>
                    <span className={`nr-tag is-${toneOf(row.score)}`}>{word(row.score)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </BPF>

        {/* ── Inspection notes ── */}
        <BPF style={{ padding: 20, marginBottom: 24 }}>
          <p className="kick">Inspection Notes</p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {good.map((g, i) => <div key={'g' + i} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.45 }}><span style={{ color: '#3D6B2E', fontWeight: 700 }}>✓</span><span style={{ color: 'var(--text-mute)' }}>{g}</span></div>)}
            {bad.map((b, i) => <div key={'b' + i} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.45 }}><span style={{ color: 'var(--slate)', fontWeight: 700 }}>✕</span><span style={{ color: 'var(--text-mute)' }}>{b}</span></div>)}
            {good.length + bad.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>No standout flags either way.</span>}
          </div>
        </BPF>

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
                        <td key={f} style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)' }}>{record.scores?.[f] ?? '-'}</td>
                      ))}
                    </tr>
                    {nearby.map(r => (
                      <tr key={r.pin_code}>
                        <td style={{ padding: '9px 8px 9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.name}</td>
                        <td style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.nqi_composite}</td>
                        {['crime', 'air', 'water', 'sewerage'].map(f => (
                          <td key={f} style={{ textAlign: 'right', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)', color: 'var(--text-mute)' }}>{r.scores?.[f] ?? '-'}</td>
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
            <strong style={{ color: 'var(--text)' }}>Scope</strong>, this measures neighbourhood livability from government sources. Not a substitute for legal, title, or physical verification of a specific property.
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 720 }}>
            Data aggregations for informational and research purposes only, not real-estate, legal or financial advice. Most figures are estimated from government reports last verified 2023–24. Do not rely solely on these scores for a purchase decision.
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 720, marginTop: 10 }}>
            <strong style={{ color: 'var(--text)' }}>How this is built</strong>, scores combine the cited public-record data above with a zone-level model - pincodes in the same zone often share a baseline with only a small adjustment between them, so two nearby addresses can land close together or identical on most dimensions. Named school detail, where listed above, is the one part sourced locality by locality rather than by zone.
          </p>
        </div>

      </div>
    </div>
  );
}
