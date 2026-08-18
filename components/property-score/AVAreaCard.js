'use client';
// components/property-score/AVAreaCard.js
// The AsliVastu card on the property-score page. Mirrors the full report
// page's (/neighbourhood-report/[pin], NeighbourhoodReport.js) box
// structure and styling exactly: the same 3-card hero row (Identity /
// Composite Index / Verdict, each its own BPF blueprint-frame box), and
// the same dimension-readout row layout (label + source citation +
// weight% + bar + explain sentence + score) -- all built from the same
// record fields the full report uses (weights_applied, crime_percentile,
// discom, aqi_avg, etc. -- all already present on the record this card
// receives, via /api/av-localities' merge of nqi_scores.json +
// master_by_pin.json).
//
// Deliberately does NOT duplicate the full report's persona-weighting
// tabs or its inspection-notes/price-context/comparison/methodology
// sections below the readout -- those stay exclusive to the full report,
// reached via the link at the bottom. This card is the same look, not a
// second full copy.

import { GradeBadge, FACTOR_LABELS } from '@/lib/property-score/ui';
import { scoreColor, verdictFor, explain, source, formatDateLong, BPF, readableTextColor } from './AVDetailedReadout';

export default function AVAreaCard({ record, city }) {
  const verdict = verdictFor(record.nqi_composite);
  const scores = record.scores || {};
  const weights = record.weights_applied || {};
  const totalW = Object.keys(scores).reduce((sum, k) => sum + (weights[k] || 0), 0) || 1;
  // Same shape/sort as NeighbourhoodReport's `rows` (weight = exact % share
  // of the composite, sorted heaviest-weighted first) -- just built from
  // the record's own default weights_applied instead of a persona preset,
  // since this card has no persona toggle.
  const rows = Object.keys(scores)
    .map(k => ({ k, score: scores[k], weight: Math.round((weights[k] || 0) / totalW * 100) }))
    .sort((a, b) => b.weight - a.weight || b.score - a.score);
  const verdictCol = scoreColor(record.nqi_composite);
  const verdictText = readableTextColor(verdictCol);

  return (
    <div className="av-card" style={{ marginBottom: 36 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap');
        .av-card .cond { font-family: 'Barlow Condensed', sans-serif; }
        @media (max-width: 900px) { .av-card .av-hero3 { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .av-card .av-dim-row { grid-template-columns: 1fr !important; gap: 6px !important; } }
      `}</style>

      {/* ── Hero: 3 cards (Identity / Composite Index / Verdict) -- same
          grid + same three boxes as the full report's nr-hero3 ── */}
      <div className="av-hero3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        <BPF dark style={{ padding: 24 }}>
          <div className="mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'rgba(255,253,248,0.65)' }}>
            Sheet · {record.area || city || record.city} · PIN {record.pin_code}
          </div>
          <h3 className="cond" style={{ fontSize: 32, fontWeight: 700, lineHeight: .95, margin: '10px 0 8px', textTransform: 'uppercase', color: 'var(--paper)' }}>{record.name}</h3>
          <div style={{ fontSize: 13.5, color: 'rgba(255,253,248,0.55)' }}>
            {Object.keys(scores).length}/{record.dimensions_total || Object.keys(scores).length} dimensions · scored {formatDateLong(record.scored_at) || '—'}
          </div>
        </BPF>

        <BPF dark style={{ padding: 24 }}>
          <div className="mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'rgba(255,253,248,0.65)' }}>Composite index</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '8px 0 6px' }}>
            <span className="av-score-number cond" style={{ fontSize: 60, fontWeight: 700, lineHeight: .85, color: 'var(--paper)' }}>{record.nqi_composite}</span>
            <GradeBadge grade={record.grade} color="var(--paper)" />
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(255,253,248,0.55)', lineHeight: 1.5 }}>NQI · weighted mean of {rows.length} dimensions.</div>
          <div style={{ fontSize: 12, color: 'rgba(255,253,248,0.45)', margin: '10px 0 0', lineHeight: 1.5, paddingTop: 10, borderTop: '1px dashed rgba(255,253,248,0.2)' }}>First-pass area assessment · reflects this PIN, not a specific building or street.</div>
        </BPF>

        {/* Verdict fill stays scoreColor(nqi) -- the autumn score-colour
            ramp, never AsliVastu's own wine/red brand colour. Text colour
            is computed from that same fill via readableTextColor()
            (perceptual luminance) rather than hardcoded white -- the
            bright mid-tier fills (olive/yellow-green/orange) need dark
            ink, only the two darkest tiers (deep olive, red) need white. */}
        <div style={{ background: verdictCol, color: verdictText, padding: 24, borderRadius: 'var(--radius)' }}>
          <div className="mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: 'inherit', opacity: .75 }}>Area Verdict</div>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700, textTransform: 'uppercase', margin: '8px 0 8px', color: 'inherit' }}>{verdict.label}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'inherit', opacity: .92 }}>{verdict.why}</div>
        </div>
      </div>

      {/* ── Dimension readout -- same row layout as the full report's:
          label+source / weight% / bar+explain sentence / score ── */}
      <BPF dark style={{ padding: '0 24px 8px', marginBottom: 22 }}>
        <div className="mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, color: 'rgba(255,253,248,0.65)', padding: '16px 0 4px' }}>
          Dimension readout · weight = exact contribution to the {record.nqi_composite}
        </div>
        {rows.map(row => {
          const weak = row.score < 50;
          const col = scoreColor(row.score);
          return (
            <div key={row.k} className="av-dim-row" style={{ display: 'grid', gridTemplateColumns: '180px 46px 1fr 60px', gap: 14, alignItems: 'start', padding: '11px 0', borderTop: '1px dashed rgba(255,253,248,0.16)' }}>
              <div>
                <div className="cond" style={{ fontSize: 17, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.1, color: 'var(--paper)' }}>{FACTOR_LABELS[row.k] || row.k}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,253,248,0.5)', marginTop: 2 }}>{source(row.k, record.city)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,253,248,0.75)', paddingTop: 4 }}>{row.weight}%</div>
              <div style={{ paddingTop: 2 }}>
                {/* Track border is white-tinted now (was var(--line), tuned
                    for a light box) -- the bar fill itself still uses
                    scoreColor() unchanged, that's the primary color signal
                    and reads fine on dark. */}
                <div style={{ height: 8, border: '1px solid rgba(255,253,248,0.2)', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
                  <div style={{
                    position: 'absolute', inset: 0, width: `${row.score}%`,
                    background: weak ? undefined : col,
                    backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
                  }} />
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,253,248,0.55)', margin: '6px 0 0', lineHeight: 1.45 }}>{explain(row.k, record)}</div>
              </div>
              {/* Score number is fixed light text, not scoreColor(row.score)
                  -- two of the four tiers (red #8F0000, deep olive #5C6B00)
                  are themselves dark and would nearly disappear as text on
                  this near-black box. The bar above still carries the color
                  signal; this number just needs to be legible. */}
              <div className="cond" style={{ fontSize: 24, fontWeight: 700, textAlign: 'right', color: 'var(--paper)' }}>{row.score}</div>
            </div>
          );
        })}
      </BPF>

      <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginBottom: 22 }}>
        Area-level — the same for every unit in this pincode.
      </div>

      <a
        href={`/neighbourhood-report/${record.pin_code}${record.sectorNum != null ? `?sector=${record.sectorNum}` : ''}`}
        target="_blank"
        rel="noreferrer"
        className="ps-btn ps-cta-btn"
        style={{ display: 'inline-block', background: 'var(--slate)', color: '#fff', border: '1px solid var(--slate)', borderRadius: 'var(--radius)', padding: '12px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
      >
        See Detailed Neighbourhood Report ↗
      </a>
    </div>
  );
}
