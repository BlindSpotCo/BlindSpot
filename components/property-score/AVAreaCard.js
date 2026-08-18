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
    // maxWidth pinned to 1056px -- the full report's actual usable content
    // width (its .nr-wrap is maxWidth:1120 with 32px side padding, so
    // 1120-64=1056). Without this, this card was rendering at whatever
    // width its parent (.wrap, maxWidth:1180, 32px padding = 1116px) gave
    // it -- about 60px wider per row. Same JSX, same font-sizes, but at
    // that extra width, captions like "NQI · weighted mean of..." that
    // wrap to 2 lines on the full report fit on 1 line here instead, so
    // the grid's align-items:stretch left more empty space at the bottom
    // of each box -- boxes read as visually "stretched"/loose instead of
    // "squared up" even though not a single style value actually
    // differed. Constraining the width makes every line-wrap, and so
    // every box's actual proportions, match pixel-for-pixel.
    <div className="av-card" style={{ marginBottom: 36, maxWidth: 1056 }}>
      {/* No local font import -- this used to pull in Barlow Condensed for
          every `.cond` element, a font the rest of the site never loads
          (layout.js loads Bricolage Grotesque, Inter, IBM Plex Mono).
          That's what made this card visibly off-brand. Every heading/
          number below now uses one of those three instead, inline: plain
          Inter bold for the locality name (matching .hero h1 / .section
          h2 -- checked, the real site has no separate display font),
          Bricolage Grotesque for every numeric readout, Inter for row
          labels. */}
      <style>{`
        @media (max-width: 900px) { .av-card .av-hero3 { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .av-card .av-dim-row { grid-template-columns: 1fr !important; gap: 6px !important; } }
      `}</style>

      {/* ── Hero: 3 cards (Identity / Composite Index / Verdict) -- now a
          direct match to the full report's nr-hero3, not just the same
          structure. Sizes/colours were drifting (60px composite number
          here vs 84px there, a bordered GradeBadge here vs plain text
          there, "Area Verdict" vs "Verdict", different dashed-line and
          track-border tints) -- every value below is now copied straight
          from NeighbourhoodReport.js's hero, not independently tuned. */}
      <div className="av-hero3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
        <BPF dark style={{ padding: 24 }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'rgba(255,253,248,0.65)' }}>
            Sheet · {record.area || city || record.city} · PIN {record.pin_code}
          </div>
          <h3 style={{ fontWeight: 700, fontSize: 40, lineHeight: 1.05, margin: '10px 0 8px', textTransform: 'uppercase', color: 'var(--paper)', wordBreak: 'normal', overflowWrap: 'normal' }}>{record.name}</h3>
          <div style={{ fontSize: 13, color: 'rgba(255,253,248,0.55)' }}>
            {record.dimensions_scored || Object.keys(scores).length}/{record.dimensions_total || Object.keys(scores).length} dimensions · scored {formatDateLong(record.scored_at) || '—'}
          </div>
        </BPF>

        <BPF dark style={{ padding: 24 }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'rgba(255,253,248,0.65)' }}>Composite index</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, margin: '8px 0 6px' }}>
            <span className="av-score-number" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 84, fontWeight: 700, lineHeight: .85, color: 'var(--paper)' }}>{record.nqi_composite}</span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--paper)', marginBottom: 12 }}>{record.grade}</span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,253,248,0.55)', lineHeight: 1.5 }}>NQI · weighted mean of {rows.length} dimensions.</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,253,248,0.45)', margin: '10px 0 0', lineHeight: 1.5, paddingTop: 10, borderTop: '1px dashed rgba(255,253,248,0.2)' }}>First-pass area assessment · reflects this PIN, not a specific building or street.</div>
        </BPF>

        {/* Verdict fill stays scoreColor(nqi) -- the autumn score-colour
            ramp, never AsliVastu's own wine/red brand colour. Text colour
            is computed from that same fill via readableTextColor()
            (perceptual luminance) rather than hardcoded white -- the
            bright mid-tier fills (olive/yellow-green/orange) need dark
            ink, only the two darkest tiers (deep olive, red) need white.
            No border-radius, matching the full report's square-cornered
            version (and its own BPF siblings, which have no rounding
            either -- this used to have var(--radius), a subtle mismatch
            with its own row). */}
        <div style={{ background: verdictCol, color: verdictText, padding: 24, position: 'relative' }}>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', color: 'inherit', opacity: .75 }}>Verdict</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 34, fontWeight: 700, textTransform: 'uppercase', margin: '8px 0 10px', color: 'inherit' }}>{verdict.label}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'inherit', opacity: .92 }}>{verdict.why}</div>
        </div>
      </div>

      {/* ── Dimension readout -- same row layout as the full report's:
          label+source / weight% / bar+explain sentence / score, same
          column widths (200/52/1fr/76), same font sizes, same
          slate-tinted dashed dividers and track borders (was plain
          var(--line)/var(--line-soft) here, a flatter grey that read as
          less colourful than the full report's version). */}
      <BPF style={{ padding: '0 24px 8px', marginBottom: 22, background: 'var(--bg-2)' }}>
        <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'var(--slate)', padding: '16px 0 4px' }}>
          Dimension readout · weight = exact contribution to the {record.nqi_composite}
        </div>
        {rows.map(row => {
          const weak = row.score < 50;
          const col = scoreColor(row.score);
          return (
            <div key={row.k} className="av-dim-row" style={{ display: 'grid', gridTemplateColumns: '200px 52px 1fr 76px', gap: 14, alignItems: 'start', padding: '11px 0', borderTop: '1px dashed color-mix(in srgb, var(--slate) 35%, transparent)' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1, color: 'var(--ink)' }}>{FACTOR_LABELS[row.k] || row.k}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{source(row.k, record.city)}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate)', paddingTop: 4 }}>{row.weight}%</div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ height: 8, border: '1px solid color-mix(in srgb, var(--slate) 35%, transparent)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0, width: `${row.score}%`,
                    background: weak ? undefined : col,
                    backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-mute)', margin: '6px 0 0', lineHeight: 1.45 }}>{explain(row.k, record)}</div>
              </div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 700, textAlign: 'right', color: col }}>{row.score}</div>
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
