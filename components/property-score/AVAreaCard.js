'use client';
// components/property-score/AVAreaCard.js
// The area spec sheet as it appears inside the property-score flow.
// Pixel-identical to the standalone full report page's version of the
// same sheet (/neighbourhood-report/[pin], NeighbourhoodReport.js).
//
// That identity is now enforced structurally rather than by hand: every
// size, spacing and colour lives in the shared `.avsheet-*` block in
// globals.css, which BOTH files render against. Nothing here sets sizing
// or colour inline except the two things that are genuinely per-record
// (the verdict fill + its derived text colour, and each bar's width/
// fill). Previously both files carried their own full copy of ~25 inline
// values, so keeping them matched meant hand-syncing every one, and a
// stray globals.css rule that happened to match only one of them
// (`.av-dim-row{margin-bottom:6px}`, written for the homepage mockup)
// could silently push them apart again with nothing in either file to
// show for it.
//
// Still deliberately does NOT include the full report's persona-weighting
// tabs, or its inspection-notes/price-context/comparison/methodology
// sections -- those stay exclusive to the full report, reached via the
// link at the bottom. Same sheet, not a second full copy of the page.

import { FACTOR_LABELS } from '@/lib/property-score/ui';
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
    <div className="av-card avsheet" style={{ marginBottom: 36 }}>
      {/* ── Hero: 3 boxes (Identity / Composite Index / Verdict) ── */}
      <div className="avsheet-hero">
        <BPF dark className="avsheet-box">
          <p className="avsheet-label" style={{ color: 'rgba(255,253,248,0.65)' }}>
            Sheet · {record.area || city || record.city} · PIN {record.pin_code}
          </p>
          <h3 className="avsheet-name">{record.name}</h3>
          <p className="avsheet-meta">
            {record.dimensions_scored || Object.keys(scores).length}/{record.dimensions_total || Object.keys(scores).length} dimensions · scored {formatDateLong(record.scored_at) || '—'}
          </p>
        </BPF>

        <BPF dark className="avsheet-box">
          <p className="avsheet-label" style={{ color: 'rgba(255,253,248,0.65)' }}>Composite index</p>
          <div className="avsheet-scorerow">
            <span className="avsheet-score">{record.nqi_composite}</span>
            <span className="avsheet-grade">{record.grade}</span>
          </div>
          <p className="avsheet-cap">NQI · weighted mean of {rows.length} dimensions.</p>
          <p className="avsheet-note">First-pass area assessment · reflects this PIN, not a specific building or street.</p>
        </BPF>

        {/* Fill is scoreColor(nqi) -- the autumn score-colour ramp, never
            AsliVastu's own wine/red brand colour -- and the text colour on
            top of it is derived from that same fill via readableTextColor()
            (perceptual luminance) rather than hardcoded white: the bright
            mid-tier fills need dark ink, only the darkest tiers need white.
            Both are genuinely per-record, so they stay inline. */}
        <div className="avsheet-verdict" style={{ background: verdictCol, color: verdictText }}>
          <p className="avsheet-label" style={{ color: 'inherit', opacity: .75 }}>Verdict</p>
          <div className="avsheet-verdict-word">{verdict.label}</div>
          <p className="avsheet-verdict-why" style={{ opacity: .92 }}>{verdict.why}</p>
        </div>
      </div>

      {/* ── Dimension readout ── */}
      <BPF className="avsheet-readout">
        <p className="avsheet-label avsheet-readout-label">
          Dimension readout · weight = exact contribution to the {record.nqi_composite}
        </p>
        {rows.map(row => {
          const weak = row.score < 50;
          const col = scoreColor(row.score);
          return (
            <div key={row.k} className="avsheet-row">
              <div>
                <div className="avsheet-row-label">{FACTOR_LABELS[row.k] || row.k}</div>
                <div className="avsheet-row-src">{source(row.k, record.city)}</div>
              </div>
              <div className="avsheet-row-weight">{row.weight}%</div>
              <div style={{ paddingTop: 2 }}>
                <div className="avsheet-track">
                  <div style={{
                    position: 'absolute', inset: 0, width: `${row.score}%`,
                    background: weak ? undefined : col,
                    backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
                  }} />
                </div>
                <p className="avsheet-explain">{explain(row.k, record)}</p>
              </div>
              <div className="avsheet-row-score" style={{ color: col }}>{row.score}</div>
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
