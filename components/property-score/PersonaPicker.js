'use client';
// components/property-score/PersonaPicker.js
// "Pick your angle" — the circular persona dial. 4 personas at exact 90°
// trig positions, each ALWAYS rendered filled in its own colour from the
// fixed 4-colour set in lib/personas.js (dark olive, rust, wine,
// olive-gold) — not dimmed until picked, so the colour-coding reads at a
// glance. Hover or tap a node to preview it; clicking selects it —
// re-weights the AsliVastu composite, sets the default area/unit split,
// and frames the AI report (see lib/personas.js for what actually
// changes underneath).
//
// `big` scales everything up for when this owns a full screen (the
// 3-screen scroll sequence in PropertyScoreFlow.js) instead of sharing a
// half-width column with other content.

import { useState } from 'react';
import { PERSONAS, PERSONA_ORDER } from '@/lib/personas';

export default function PersonaPicker({ personaId, onSelect, big = false }) {
  const [hoverId, setHoverId] = useState(null);
  const selected = PERSONAS[personaId];
  const previewId = hoverId || personaId;
  const preview = PERSONAS[previewId];

  const SIZE = big ? 520 : 300;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const NODE_R = big ? 62 : 34;
  const ORBIT_R = big ? 178 : 104;
  const HUB_R = big ? 72 : 46;

  const ANGLE_STEP = 360 / PERSONA_ORDER.length;
  const positions = PERSONA_ORDER.map((id, i) => {
    const deg = -90 + i * ANGLE_STEP;
    const rad = (deg * Math.PI) / 180;
    return { id, x: CX + ORBIT_R * Math.cos(rad), y: CY + ORBIT_R * Math.sin(rad) };
  });

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const deg = i * 15;
    const rad = (deg * Math.PI) / 180;
    const outerR = ORBIT_R + NODE_R + (big ? 24 : 18);
    const innerR = outerR - (i % 6 === 0 ? (big ? 13 : 10) : (big ? 6 : 5));
    return {
      x1: CX + innerR * Math.cos(rad), y1: CY + innerR * Math.sin(rad),
      x2: CX + outerR * Math.cos(rad), y2: CY + outerR * Math.sin(rad),
    };
  });

  const pad = big ? 60 : 50;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div className="mono" style={{ fontSize: big ? 12 : 11, color: 'var(--sun)', letterSpacing: '.14em', marginBottom: big ? 14 : 10 }}>WHO&apos;S HOUSE-HUNTING?</div>
      <h1 style={{ fontSize: big ? 'clamp(34px, 5vw, 48px)' : 'clamp(28px, 4vw, 40px)', marginBottom: big ? 12 : 8 }}>Pick your angle.</h1>
      <p style={{ fontSize: big ? 15 : 13, color: 'var(--text-mute)', maxWidth: big ? 480 : 400, marginBottom: big ? 30 : 20, lineHeight: 1.55 }}>
        Same address, different blind spots — this sets how the combined score and the sun/shadow weighting are tuned for you. You can still drag any slider by hand later.
      </p>

      {/* Desktop only (hidden below 640px via CSS in globals.css) -- a
          hover-to-preview, click-to-select dial is a bad first interaction
          on a phone (no hover state at all, and a circular dial is a less
          discoverable pattern than a plain list for a first-time visitor).
          Kept as-is on desktop since it's the stronger, more memorable
          version of this step there. */}
      <div className="pw-wheel-wrap">
        <svg width={SIZE + pad} height={SIZE + pad} viewBox={`${-pad / 2} ${-pad / 2} ${SIZE + pad} ${SIZE + pad}`} style={{ overflow: 'visible', maxWidth: '100%', height: 'auto' }}>
          <circle cx={CX} cy={CY} r={ORBIT_R + NODE_R + 4} fill="none" stroke="var(--line)" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={ORBIT_R} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="3 5" />
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--line)" strokeWidth="1" />
          ))}

          {/* spokes — dashed by default, solid + coloured for the selected persona */}
          {positions.map((pos) => {
            const p = PERSONAS[pos.id];
            const active = pos.id === personaId;
            return (
              <line key={pos.id}
                x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                stroke={active ? p.color : 'var(--line)'}
                strokeWidth={active ? 2.5 : 1}
                strokeDasharray={active ? undefined : '3 5'}
              />
            );
          })}

          {/* hub */}
          <circle cx={CX} cy={CY} r={HUB_R} fill="var(--bg-2)" stroke="var(--line)" strokeWidth="1.5" />
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" className="mono"
            style={{ fontSize: big ? 13 : 10.5, fill: 'var(--text-mute)', letterSpacing: '.07em' }}>
            {selected ? (
              <>
                <tspan x={CX} dy="-3">{selected.short.toUpperCase()}</tspan>
                <tspan x={CX} dy={big ? '15' : '14'} style={{ fontSize: big ? 9.5 : 8.5, fill: 'var(--text-dim)' }}>SELECTED</tspan>
              </>
            ) : (
              <>
                <tspan x={CX} dy="-3">CHOOSE</tspan>
                <tspan x={CX} dy={big ? '15' : '14'}>YOUR ANGLE</tspan>
              </>
            )}
          </text>

          {/* persona nodes — always filled in their own colour */}
          {positions.map((pos) => {
            const p = PERSONAS[pos.id];
            const active = pos.id === personaId;
            return (
              <g key={pos.id}
                onClick={() => onSelect(pos.id)}
                onMouseEnter={() => setHoverId(pos.id)}
                onMouseLeave={() => setHoverId(null)}
                className="ps-persona-node"
                style={{ cursor: 'pointer' }}
              >
                <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={p.color}
                  stroke={active ? 'var(--text)' : 'none'}
                  strokeWidth={active ? 3 : 0}
                />
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: big ? 20 : 14, fontWeight: 700, fill: '#fff', pointerEvents: 'none' }}>
                  {p.short[0]}
                </text>
                <text x={pos.x} y={pos.y + NODE_R + (big ? 22 : 17)} textAnchor="middle"
                  className="mono" style={{ fontSize: big ? 12 : 9.5, letterSpacing: '.07em', fill: 'var(--text-mute)', pointerEvents: 'none' }}>
                  {p.short.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>

        <div style={{ marginTop: big ? 20 : 14, minHeight: 40, textAlign: 'center', maxWidth: big ? 460 : 400 }}>
          {preview ? (
            <>
              <div style={{ fontSize: big ? 15 : 13.5, fontWeight: 700, color: preview.color, marginBottom: 3 }}>{preview.label}</div>
              <div style={{ fontSize: big ? 13 : 12, color: 'var(--text-mute)', lineHeight: 1.5 }}>{preview.blurb}</div>
            </>
          ) : (
            <p style={{ fontSize: big ? 13.5 : 12.5, color: 'var(--text-dim)' }}>Hover or tap a point on the dial.</p>
          )}
        </div>
      </div>

      {/* Mobile only (shown below 640px via CSS) -- plain tap-to-select
          buttons, same 4 personas, same colours and copy. No hover-preview
          step since touch has no hover; tapping selects directly. */}
      <div className="pw-mobile-list" style={{ display: 'none', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 440 }}>
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
