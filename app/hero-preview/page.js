'use client';
// app/hero-preview/page.js
// SAMPLE / SCRATCH ROUTE -- not linked from anywhere, safe to delete.
// Live preview of hero concept 3: a drag-slider hero where one side is the
// glossy listing (broker language, sunny photo) and the other side is what
// BlindSpot actually measures. Visit /hero-preview with the dev server
// running. Self-contained: all styles are in the <style> block below so
// nothing here can leak into or depend on the real site's globals.css.

import { useCallback, useEffect, useRef, useState } from 'react';

const DATA_ROWS = [
  { label: 'Direct sun, December', value: '1.9 hrs/day', tone: 'bad', bar: 24 },
  { label: 'Shadowed by Tower B', value: 'until 11:40am', tone: 'bad', bar: 32 },
  { label: 'Air quality (CPCB)', value: '168 · Poor', tone: 'warn', bar: 46 },
  { label: 'Power cuts', value: '11 / month', tone: 'warn', bar: 52 },
  { label: 'Crime index', value: '81 · Low', tone: 'good', bar: 81 },
];

export default function HeroPreview() {
  const [pct, setPct] = useState(52);
  const wrapRef = useRef(null);
  const draggingRef = useRef(false);

  const setFromClientX = useCallback((clientX) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = ((clientX - r.left) / r.width) * 100;
    setPct(Math.min(96, Math.max(4, next)));
  }, []);

  useEffect(() => {
    const move = (e) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      setFromClientX(e.touches ? e.touches[0].clientX : e.clientX);
    };
    const up = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [setFromClientX]);

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') setPct((p) => Math.max(4, p - 4));
    if (e.key === 'ArrowRight') setPct((p) => Math.min(96, p + 4));
  };

  return (
    <div className="hp-page">
      <style>{CSS}</style>

      <div className="hp-wrap">
        <div className="hp-grid">
          <div>
            <span className="hp-eyebrow">Property Intelligence</span>
            <h1 className="hp-h1">The listing says bright.<br />We checked.</h1>
            <p className="hp-tagline">
              <span className="hp-seg sun">One pin</span>
              <span className="hp-sep" />
              <span className="hp-seg slate">Two answers</span>
            </p>
            <p className="hp-sub">
              Drag the handle. Left is what the broker showed you. Right is
              what the sun, the shadows and the government records actually
              say about the same flat.
            </p>
            <a className="hp-cta" href="/property-score">Uncover Your BlindSpot →</a>
            <div className="hp-coord">
              <span className="hp-blink" />
              <span>19.0760° N, 72.8777° E — Floor 7, SE facing</span>
            </div>
          </div>

          <div>
            <div
              className="hp-compare"
              ref={wrapRef}
              onPointerDown={(e) => { draggingRef.current = true; setFromClientX(e.clientX); }}
            >
              {/* REALITY -- full-bleed underneath */}
              <div className="hp-side hp-real">
                <div className="hp-chip hp-chip-real">What BlindSpot measured</div>
                <div className="hp-real-inner">
                  <div className="hp-score">
                    <span className="hp-score-num">61</span>
                    <span className="hp-score-den">/100</span>
                    <span className="hp-verdict">Consider with caution</span>
                  </div>
                  {DATA_ROWS.map((r) => (
                    <div className="hp-row" key={r.label}>
                      <div className="hp-row-head">
                        <span>{r.label}</span>
                        <span className={`hp-val ${r.tone}`}>{r.value}</span>
                      </div>
                      <div className="hp-track">
                        <div className={`hp-fill ${r.tone}`} style={{ width: `${r.bar}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="hp-src">Sources · NOAA solar geometry · CPCB · BSES · Delhi Police</div>
                </div>
              </div>

              {/* LISTING -- clipped from the right by the handle */}
              <div className="hp-side hp-listing" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
                <div className="hp-photo">
                  <div className="hp-sunflare" />
                  <div className="hp-window">
                    <span /><span /><span /><span />
                  </div>
                  <div className="hp-floor" />
                </div>
                <div className="hp-chip hp-chip-listing">The listing</div>
                <div className="hp-listing-copy">
                  <div className="hp-listing-title">Bright, airy 3 BHK</div>
                  <div className="hp-listing-blurb">
                    “Excellent natural light all day · Peaceful green
                    neighbourhood · Premium tower”
                  </div>
                </div>
              </div>

              <div className="hp-handle" style={{ left: `${pct}%` }}>
                <button
                  className="hp-knob"
                  aria-label="Drag to compare the listing with the measured data"
                  onKeyDown={onKey}
                  onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = true; }}
                >
                  <span>‹</span><span>›</span>
                </button>
              </div>
            </div>
            <div className="hp-hint">Drag ←→</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.hp-page{ background:#FAF6EE; min-height:100vh; padding:64px 0 90px;
  font-family:'Inter',system-ui,sans-serif; color:#1C1812; }
.hp-wrap{ max-width:1180px; margin:0 auto; padding:0 32px }
.hp-grid{ display:grid; grid-template-columns:1fr 1.05fr; gap:56px; align-items:center }
@media (max-width:900px){ .hp-grid{ grid-template-columns:1fr; gap:40px } }

.hp-eyebrow{ display:inline-flex; align-items:center; gap:10px; font-family:'IBM Plex Mono',monospace;
  font-weight:600; font-size:13.5px; letter-spacing:.14em; text-transform:uppercase; color:#6B2430; margin-bottom:22px }
.hp-eyebrow::before{ content:''; width:22px; height:1px; background:#6B2430 }
.hp-h1{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:58px; line-height:1.04;
  letter-spacing:-0.01em; margin:0 }
@media (max-width:1300px){ .hp-h1{ font-size:48px } }
@media (max-width:480px){ .hp-h1{ font-size:34px } }
.hp-tagline{ font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:14px; letter-spacing:.08em;
  text-transform:uppercase; margin:18px 0 0; display:flex; align-items:center; gap:10px }
.hp-seg.sun{ color:#C9812E } .hp-seg.slate{ color:#6B2430 }
.hp-sep{ width:3px; height:3px; border-radius:50%; background:rgba(28,24,18,.2) }
.hp-sub{ font-size:17px; line-height:1.6; color:#5A5140; max-width:460px; margin:16px 0 0 }
.hp-cta{ display:inline-flex; align-items:center; margin-top:30px; padding:12px 22px; border-radius:6px;
  background:linear-gradient(90deg,#C9812E,#6B2430); color:#fff; text-decoration:none; font-weight:600; font-size:14px;
  box-shadow:0 10px 24px -12px rgba(201,129,46,.45) }
.hp-coord{ margin-top:20px; font-family:'IBM Plex Mono',monospace; font-size:13px; color:#5A5140;
  display:inline-flex; align-items:center; gap:9px }
.hp-blink{ width:5px; height:5px; background:#6B2430; animation:hpBlink 1.4s steps(1) infinite }
@keyframes hpBlink{ 0%,49%{opacity:1} 50%,100%{opacity:0} }

.hp-compare{ position:relative; width:100%; height:462px; border-radius:12px; overflow:hidden;
  border:1px solid rgba(28,24,18,.14); box-shadow:0 24px 60px -30px rgba(28,24,18,.3);
  cursor:ew-resize; user-select:none; touch-action:none; background:#0B0B0C }
.hp-side{ position:absolute; inset:0 }

.hp-real{ background:#0B0B0C; color:#EDEDEC }
.hp-real-inner{ position:absolute; inset:0; padding:58px 26px 20px; display:flex; flex-direction:column }
.hp-score{ display:flex; align-items:baseline; gap:8px; margin-bottom:18px }
.hp-score-num{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:52px; line-height:1; color:#fff }
.hp-score-den{ font-size:15px; color:rgba(237,237,236,.55) }
.hp-verdict{ margin-left:auto; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.1em;
  text-transform:uppercase; color:#fff; background:#B23A46; padding:6px 11px; border-radius:4px }
.hp-row{ margin-bottom:13px }
.hp-row-head{ display:flex; justify-content:space-between; align-items:baseline; font-size:13px;
  color:#d8d8d5; margin-bottom:6px }
.hp-val{ font-family:'IBM Plex Mono',monospace; font-size:12px }
.hp-val.good{ color:#5fd18b } .hp-val.warn{ color:#e0a72e } .hp-val.bad{ color:#e5706a }
.hp-track{ height:5px; border-radius:3px; background:rgba(255,255,255,.1); overflow:hidden }
.hp-fill{ height:100%; border-radius:3px }
.hp-fill.good{ background:#3ecf6e } .hp-fill.warn{ background:#e0a72e } .hp-fill.bad{ background:#e0524a }
.hp-src{ margin-top:auto; font-family:'IBM Plex Mono',monospace; font-size:9.5px; letter-spacing:.05em;
  color:rgba(237,237,236,.45) }

.hp-listing{ overflow:hidden }
.hp-photo{ position:absolute; inset:0; background:linear-gradient(170deg,#F6D9A8 0%,#EBBE86 46%,#C98F5A 100%) }
.hp-sunflare{ position:absolute; top:-70px; left:-40px; width:280px; height:280px; border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.92) 0%,rgba(255,255,255,0) 68%) }
.hp-window{ position:absolute; top:64px; right:34px; width:190px; height:214px; border-radius:4px;
  background:linear-gradient(200deg,#fdf3dd,#f3d7a4); border:9px solid #8a6a45;
  display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:9px; padding:9px }
.hp-window span{ background:linear-gradient(200deg,#ffffff,#ffe9bd); border-radius:2px }
.hp-floor{ position:absolute; left:0; right:0; bottom:0; height:118px;
  background:linear-gradient(180deg,#b07f4e,#8d6238) }
.hp-listing-copy{ position:absolute; left:0; right:0; bottom:0; padding:22px 24px 20px;
  background:linear-gradient(180deg,rgba(28,24,18,0),rgba(28,24,18,.82) 46%) ; color:#fff }
.hp-listing-title{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:21px; margin-bottom:6px }
.hp-listing-blurb{ font-size:13px; line-height:1.55; color:rgba(255,255,255,.86); max-width:330px }

.hp-chip{ position:absolute; top:18px; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; padding:7px 12px; border-radius:20px; z-index:3 }
.hp-chip-listing{ left:18px; background:rgba(28,24,18,.72); color:#fff }
.hp-chip-real{ right:18px; background:#fff; color:#1C1812 }

.hp-handle{ position:absolute; top:0; bottom:0; width:2px; background:rgba(255,255,255,.92); z-index:4;
  transform:translateX(-1px); box-shadow:0 0 0 1px rgba(28,24,18,.18) }
.hp-knob{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:46px; height:46px;
  border-radius:50%; border:none; background:#fff; box-shadow:0 6px 18px -6px rgba(28,24,18,.5);
  cursor:ew-resize; display:flex; align-items:center; justify-content:center; gap:3px;
  font-size:17px; color:#1C1812; line-height:1 }
.hp-knob:focus-visible{ outline:2px solid #C9812E; outline-offset:3px }
.hp-hint{ margin-top:12px; text-align:center; font-family:'IBM Plex Mono',monospace; font-size:11px;
  letter-spacing:.12em; text-transform:uppercase; color:#8A8272 }
`;
