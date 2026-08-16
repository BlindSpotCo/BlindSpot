'use client';
// components/property-score/AVAreaCard.js
// The AsliVastu card on the property-score page — scores ONLY, shown big,
// full-width. No detail cards inline here; the full per-category breakdown
// (AVDetailedReadout) lives exclusively on /neighbourhood-report/[pin],
// opened via the link at the bottom. Shared by LocalityPicker (city/
// locality mode) and AddressPicker (direct-address mode).

import { GradeBadge } from '@/lib/property-score/ui';
import { scoreColor } from './AVDetailedReadout';

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
  return (
    <div className="av-card" style={{ marginBottom: 36, border: '1px solid var(--line)', borderLeft: '4px solid var(--slate)', borderRadius: 'var(--radius)', padding: '28px 30px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&display=swap');
        .av-card .cond { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 10 }}>ASLIVASTU — {record.name.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 28 }}>
        <span className="av-score-number cond" style={{ fontWeight: 700, fontSize: 60, color: 'var(--slate)' }}>{record.nqi_composite}</span>
        <GradeBadge grade={record.grade} color="var(--slate)" />
        <span style={{ fontSize: 14, color: 'var(--text-mute)' }}>Pincode {record.pin_code}{city ? `, ${city}` : ''}</span>
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
    </div>
  );
}
