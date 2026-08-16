'use client';
// components/property-score/AVAreaCard.js
// The AsliVastu card on the property-score page — scores ONLY, shown big,
// full-width. No detail cards inline here; the full per-category breakdown
// (AVDetailedReadout) lives exclusively on /neighbourhood-report/[pin],
// opened via the link at the bottom. Shared by LocalityPicker (city/
// locality mode) and AddressPicker (direct-address mode).

import { GradeBadge } from '@/lib/property-score/ui';
import { scoreColor, verdictFor, BPF } from './AVDetailedReadout';

const FACTOR_LABELS = {
  crime: 'Crime', infrastructure: 'Infrastructure', air: 'Air Quality',
  power: 'Power', schools: 'Schools', water: 'Water', roads: 'Roads', sewerage: 'Sewerage',
};

// Same 4-tier colour scale + weak-score hatch pattern as AV's own dimension
// readout (green ≥80, lime 60–79, amber 40–59, red <40 — hatched instead of
// solid fill below 50) — matches the full report page's Dimension Readout
// exactly, just recoloured to BlindSpot's palette via scoreColor().
function BigBar({ label, score }) {
  const weak = score < 50;
  const color = scoreColor(score);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 16, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
        <span>{label}</span>
        <span className="cond" style={{ fontWeight: 700, fontSize: 20, color }}>{score}</span>
      </div>
      <div style={{ background: 'var(--line-soft)', height: 10, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: weak ? undefined : color,
          backgroundImage: weak ? `repeating-linear-gradient(45deg, ${color} 0 4px, transparent 4px 8px)` : undefined,
        }} />
      </div>
    </div>
  );
}

export default function AVAreaCard({ record, city }) {
  const verdict = verdictFor(record.nqi_composite);
  return (
    // Same BPF "blueprint frame" box (corner + marks, same border treatment)
    // as every card on the full report page -- this used to be a plain
    // bordered div with no relation to the report's visual language at all,
    // which is why the inline card and the full report read as two
    // different products. background:var(--bg-2) keeps the "one step
    // darker than the page" treatment this card already had.
    <BPF className="av-card" style={{ marginBottom: 36, padding: '28px 30px', background: 'var(--bg-2)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap');
        .av-card .cond { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>
      <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600, color: 'var(--slate)', marginBottom: 14 }}>
        Sheet · AsliVastu — {record.name.toUpperCase()}
      </div>

      {/* Composite-index block + coloured Verdict block side by side --
          same pairing as the full report's hero cards (Composite Index +
          Verdict), just compacted to fit an inline card instead of two
          full-width cards. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch', marginBottom: 28 }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span className="av-score-number cond" style={{ fontWeight: 700, fontSize: 60, lineHeight: 1, color: 'var(--slate)' }}>{record.nqi_composite}</span>
            <GradeBadge grade={record.grade} color="var(--slate)" />
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-mute)' }}>Pincode {record.pin_code}{city ? `, ${city}` : ''}</span>
        </div>
        <div style={{ flex: '1 1 220px', background: scoreColor(record.nqi_composite), color: '#fff', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
          <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.8)', marginBottom: 6 }}>Verdict</div>
          <div className="cond" style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{verdict.label}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,.92)' }}>{verdict.why}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 22 }}>
        {Object.entries(record.scores || {}).map(([key, score]) => (
          <BigBar key={key} label={FACTOR_LABELS[key] || key} score={score} />
        ))}
      </div>

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
    </BPF>
  );
}
