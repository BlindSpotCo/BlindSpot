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
import { scoreColor, verdictFor, explain, source, formatDateLong, BPF } from './AVDetailedReadout';

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
        <BPF style={{ padding: 24, background: 'var(--bg-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'var(--slate)' }}>
            Sheet · {record.area || city || record.city} · PIN {record.pin_code}
          </div>
          <h3 className="cond" style={{ fontSize: 32, fontWeight: 700, lineHeight: .95, margin: '10px 0 8px', textTransform: 'uppercase', color: 'var(--ink)' }}>{record.name}</h3>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {Object.keys(scores).length}/{record.dimensions_total || Object.keys(scores).length} dimensions · scored {formatDateLong(record.scored_at) || '—'}
          </div>
        </BPF>

        <BPF style={{ padding: 24, background: 'var(--bg-2)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'var(--slate)' }}>Composite index</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '8px 0 6px' }}>
            <span className="av-score-number cond" style={{ fontSize: 60, fontWeight: 700, lineHeight: .85, color: 'var(--ink)' }}>{record.nqi_composite}</span>
            <GradeBadge grade={record.grade} color="var(--slate)" />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>NQI · weighted mean of {rows.length} dimensions.</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '10px 0 0', lineHeight: 1.5, paddingTop: 10, borderTop: '1px dashed var(--line-soft)' }}>First-pass area assessment · reflects this PIN, not a specific building or street.</div>
        </BPF>

        {/* Verdict fill stays scoreColor(nqi) -- the autumn score-colour
            ramp, never AsliVastu's own wine/red brand colour. */}
        <div style={{ background: scoreColor(record.nqi_composite), color: '#fff', padding: 24, borderRadius: 'var(--radius)' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.8)' }}>Area Verdict</div>
          <div className="cond" style={{ fontSize: 26, fontWeight: 700, textTransform: 'uppercase', margin: '8px 0 8px' }}>{verdict.label}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,.92)' }}>{verdict.why}</div>
        </div>
      </div>

      {/* ── Dimension readout -- same row layout as the full report's:
          label+source / weight% / bar+explain sentence / score ── */}
      <BPF style={{ padding: '0 24px 8px', marginBottom: 22, background: 'var(--bg-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600, color: 'var(--slate)', padding: '16px 0 4px' }}>
          Dimension readout · weight = exact contribution to the {record.nqi_composite}
        </div>
        {rows.map(row => {
          const weak = row.score < 50;
          const col = scoreColor(row.score);
          return (
            <div key={row.k} className="av-dim-row" style={{ display: 'grid', gridTemplateColumns: '180px 46px 1fr 60px', gap: 14, alignItems: 'start', padding: '11px 0', borderTop: '1px dashed var(--line-soft)' }}>
              <div>
                <div className="cond" style={{ fontSize: 17, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.1, color: 'var(--ink)' }}>{FACTOR_LABELS[row.k] || row.k}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2 }}>{source(row.k, record.city)}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', paddingTop: 4 }}>{row.weight}%</div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ height: 8, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
                  <div style={{
                    position: 'absolute', inset: 0, width: `${row.score}%`,
                    background: weak ? undefined : col,
                    backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-mute)', margin: '6px 0 0', lineHeight: 1.45 }}>{explain(row.k, record)}</div>
              </div>
              <div className="cond" style={{ fontSize: 24, fontWeight: 700, textAlign: 'right', color: col }}>{row.score}</div>
            </div>
          );
        })}
      </BPF>

      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 22 }}>
        Area-level — the same for every unit in this pincode.
      </div>

      <a
        href={`/neighbourhood-report/${record.pin_code}`}
        target="_blank"
        rel="noreferrer"
        className="ps-btn ps-cta-btn"
        style={{ display: 'inline-block', background: 'var(--slate)', color: '#fff', border: '1px solid var(--slate)', borderRadius: 'var(--radius)', padding: '12px 22px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}
      >
        See Full AsliVastu Report ↗
      </a>
    </div>
  );
}
