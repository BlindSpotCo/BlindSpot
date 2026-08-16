'use client';
// components/property-score/PropertyScoreProgress.js
// One persistent "you are here" strip for the whole property-score flow.
// Before this, each sub-step (PersonaPicker's dial, LocalityPicker,
// AddressPicker) ran its own disconnected "STEP 1/2" numbering that reset
// to 1 every time -- so a user who'd already picked a persona and a
// location would see "STEP 1" again inside AddressPicker with no sense
// of how far into the overall journey that actually was. This is the
// single authoritative 3-stage indicator instead: Your Angle -> Location
// -> Verdict, sticky under the site header so it stays visible the whole
// way through, including while scrolling through the variable-height
// content below the intro screens.

const STAGES = [
  { key: 'angle', label: 'Your Angle' },
  { key: 'location', label: 'Location' },
  { key: 'verdict', label: 'Verdict' },
];

export default function PropertyScoreProgress({ current }) {
  const idx = Math.max(0, STAGES.findIndex(s => s.key === current));

  return (
    <div style={{
      position: 'sticky', top: 66, zIndex: 5, background: 'var(--bg)',
      borderBottom: '1px solid var(--line)', padding: '10px 0',
    }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                  background: done || active ? 'var(--brand)' : 'transparent',
                  color: done || active ? '#fff' : 'var(--text-dim)',
                  border: done || active ? 'none' : '1px solid var(--line)',
                }}>{done ? '✓' : i + 1}</span>
                <span className="mono" style={{
                  fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: active ? 'var(--ink)' : (done ? 'var(--text-mute)' : 'var(--text-dim)'),
                  fontWeight: active ? 700 : 500,
                }}>{s.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ width: 40, height: 1, background: done ? 'var(--brand)' : 'var(--line)', margin: '0 14px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
