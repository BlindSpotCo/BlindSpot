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

// `showHeading` is false when PropertyScoreFlow renders its own single
// shared heading above this and the entry-mode list side by side (see
// PropertyScoreFlow.js's Priorities screen) -- there, only the small
// "WHO'S HOUSE-HUNTING?" eyebrow repeats per-column (to match the other
// column's own eyebrow so both card lists start at the same height), the
// big headline/paragraph appear once for the whole screen instead of once
// per column.
export default function PersonaPicker({ personaId, onSelect, showHeading = true }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.14em', marginBottom: 10 }}>WHO&apos;S HOUSE-HUNTING?</div>
      {showHeading && (
        <>
          <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Pick your priorities.</h2>
          <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 20, lineHeight: 1.55 }}>
            This tunes the score to what matters most to you.
          </p>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: showHeading ? 0 : 20 }}>
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
                {/* Only on the active card, right where you just picked
                    it -- what this choice actually does, not just who it's
                    for. See lib/personas.js's effect field. */}
                {active && p.effect && (
                  <span className="mono" style={{ display: 'block', fontSize: 11, color: p.color, lineHeight: 1.5, marginTop: 6 }}>{p.effect}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
