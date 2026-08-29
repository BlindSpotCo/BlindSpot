'use client';
// components/property-score/PersonaPicker.js
// Persona picker -- a plain always-visible list of the 4 personas.
//
// Used to be a hover-to-preview circular dial on desktop (with a
// separate flat-list fallback already shown on mobile, since a dial
// has no hover state on touch). Removed the dial outright: once this
// screen sits side-by-side with the location picker instead of owning
// a full screen on its own (see PropertyScoreFlow.js), the ~500px of
// SVG it needed had nowhere left to go, and the list already carried
// the same information (name + blurb) just as clearly in far less
// space. Selecting still does the same thing underneath -- re-weights
// the AsliVastu composite, sets the default area/unit split, and
// frames the AI report (see lib/personas.js for what actually changes).

import { PERSONAS, PERSONA_ORDER } from '@/lib/personas';

export default function PersonaPicker({ personaId, onSelect }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.14em', marginBottom: 10 }}>WHO&apos;S HOUSE-HUNTING?</div>
      <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Pick your priorities.</h2>
      <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 20, lineHeight: 1.55 }}>
        Same address, different blind spots — this sets how the combined score and the sun/shadow weighting are tuned for you. You can still drag any slider by hand later.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PERSONA_ORDER.map(id => {
          const p = PERSONAS[id];
          const active = id === personaId;
          return (
            <button key={id} onClick={() => onSelect(id)} className="ps-btn"
              style={{
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 'var(--radius)', cursor: 'pointer',
                background: active ? `color-mix(in srgb, ${p.color} 14%, var(--bg-2))` : 'var(--bg-2)',
                border: `1px solid ${active ? p.color : 'var(--line)'}`,
              }}>
              <span style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: p.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
              }}>{p.short[0]}</span>
              <span>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: active ? p.color : 'var(--ink)' }}>{p.label}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.4, marginTop: 2 }}>{p.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
