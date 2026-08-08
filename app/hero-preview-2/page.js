'use client';
// app/hero-preview-2/page.js
// SAMPLE / SCRATCH ROUTE -- not linked from anywhere, safe to delete.
// Live preview of hero concept 2: a faint city map bleeding across the
// whole hero, with the pin dropping onto it on load and ripple rings
// spreading out from where it lands. The score card fades in after the
// pin, so it reads as a consequence of the drop rather than decoration
// sitting next to it. Visit /hero-preview-2 with the dev server running.
// Self-contained: all styles live in the <style> block below.

import { useEffect, useState } from 'react';

const COORDS = [
  '12.9716° N, 77.5946° E — checking Bengaluru',
  '28.5245° N, 77.1855° E — scoring Vasant Kunj, Delhi',
  '19.0760° N, 72.8777° E — mapping shadow hours, Mumbai',
];

export default function HeroPreview2() {
  const [coordIdx, setCoordIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCoordIdx((i) => (i + 1) % COORDS.length), 3400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hp2-page">
      <style>{CSS}</style>

      {/* Full-bleed city map behind everything */}
      <div className="hp2-map" aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <g className="hp2-roads">
            <path d="M0,150 H1600 M0,330 H1600 M0,520 H1600 M0,700 H1600" />
            <path d="M180,0 V900 M430,0 V900 M700,0 V900 M960,0 V900 M1230,0 V900 M1450,0 V900" />
          </g>
          <g className="hp2-roads hp2-roads-minor">
            <path d="M0,240 H1600 M0,420 H1600 M0,610 H1600 M0,800 H1600" />
            <path d="M300,0 V900 M560,0 V900 M830,0 V900 M1100,0 V900 M1340,0 V900" />
          </g>
          <g className="hp2-blocks">
            <rect x="205" y="175" width="200" height="130" rx="3" />
            <rect x="455" y="175" width="220" height="130" rx="3" />
            <rect x="725" y="175" width="210" height="130" rx="3" />
            <rect x="985" y="175" width="220" height="130" rx="3" />
            <rect x="1255" y="175" width="170" height="130" rx="3" />
            <rect x="205" y="355" width="200" height="140" rx="3" />
            <rect x="455" y="355" width="220" height="140" rx="3" />
            <rect x="985" y="355" width="220" height="140" rx="3" />
            <rect x="1255" y="355" width="170" height="140" rx="3" />
            <rect x="205" y="545" width="200" height="130" rx="3" />
            <rect x="455" y="545" width="220" height="130" rx="3" />
            <rect x="725" y="545" width="210" height="130" rx="3" />
            <rect x="985" y="545" width="220" height="130" rx="3" />
            <rect x="1255" y="545" width="170" height="130" rx="3" />
          </g>
          <path className="hp2-water" d="M0,880 C240,830 420,905 700,860 C980,815 1180,880 1600,840 L1600,900 L0,900 Z" />
        </svg>
      </div>

      <div className="hp2-wrap">
        <div className="hp2-grid">
          <div className="hp2-copy">
            <span className="hp2-eyebrow">Property Intelligence</span>
            <h1 className="hp2-h1">Know the place,<br />before you commit.</h1>
            <p className="hp2-tagline">
              <span className="hp2-seg sun">One pin</span>
              <span className="hp2-sep" />
              <span className="hp2-seg slate">Two answers</span>
            </p>
            <p className="hp2-sub">
              Drop a pin. See exactly what the neighbourhood around it is
              really like, and exactly how sunlight moves through the unit.
              Real government records. Real solar geometry. No broker spin.
            </p>
            <a className="hp2-cta" href="/property-score">Uncover Your BlindSpot →</a>
            <div className="hp2-coord">
              <span className="hp2-blink" />
              <span key={coordIdx} className="hp2-coord-text">{COORDS[coordIdx]}</span>
            </div>
          </div>

          <div className="hp2-stage">
            {/* Ripples + pin, dropped onto the map */}
            <div className="hp2-drop" aria-hidden="true">
              <span className="hp2-ring hp2-ring-1" />
              <span className="hp2-ring hp2-ring-2" />
              <span className="hp2-ring hp2-ring-3" />
              <svg className="hp2-pin" viewBox="0 0 48 62">
                <path d="M24 0C10.7 0 0 10.6 0 23.7 0 41.5 24 62 24 62s24-20.5 24-38.3C48 10.6 37.3 0 24 0z" fill="#6B2430" />
                <circle cx="24" cy="23" r="8.6" fill="#FAF6EE" />
              </svg>
              <span className="hp2-shadow" />
            </div>

            <div className="hp2-card">
              <span className="hp2-card-tag">Live preview</span>
              <div className="hp2-card-head">
                <span className="hp2-card-label">BlindSpot Score</span>
                <span className="hp2-card-badge">Recommended</span>
              </div>
              <div className="hp2-num">80<span>/100</span></div>
              <p className="hp2-verdict">Good light, safe neighbourhood, fair value for the area.</p>
              <div className="hp2-item slate">
                <div>
                  <span className="hp2-item-label">Safe, well-connected area</span>
                  <span className="hp2-item-sub">Koramangala — 78/100</span>
                </div>
              </div>
              <div className="hp2-item sun">
                <div>
                  <span className="hp2-item-label">Bright, well-ventilated unit</span>
                  <span className="hp2-item-sub">Floor 7, SE — 82/100</span>
                </div>
              </div>
              <div className="hp2-foot">
                Real solar geometry + government locality data, combined into
                one number you can trust.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.hp2-page{ position:relative; background:#FAF6EE; min-height:100vh; padding:96px 0 120px; overflow:hidden;
  font-family:'Inter',system-ui,sans-serif; color:#1C1812 }

.hp2-map{ position:absolute; inset:0; z-index:0; pointer-events:none;
  -webkit-mask-image:radial-gradient(ellipse 82% 74% at 62% 44%, #000 24%, transparent 78%);
  mask-image:radial-gradient(ellipse 82% 74% at 62% 44%, #000 24%, transparent 78%);
  animation:hp2MapIn 1.5s ease both }
.hp2-map svg{ width:100%; height:100% }
@keyframes hp2MapIn{ from{ opacity:0; transform:scale(1.04) } to{ opacity:1; transform:scale(1) } }
.hp2-roads{ stroke:rgba(28,24,18,.17); stroke-width:2.5; fill:none }
.hp2-roads-minor{ stroke:rgba(28,24,18,.09); stroke-width:1.5 }
.hp2-blocks rect{ fill:rgba(28,24,18,.05); stroke:rgba(28,24,18,.09); stroke-width:1 }
.hp2-water{ fill:rgba(107,36,48,.06) }

.hp2-wrap{ position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:0 32px }
.hp2-grid{ display:grid; grid-template-columns:1.05fr .9fr; gap:56px; align-items:center }
@media (max-width:900px){ .hp2-grid{ grid-template-columns:1fr; gap:44px } }

.hp2-copy{ animation:hp2Up .7s ease both }
@keyframes hp2Up{ from{ opacity:0; transform:translateY(14px) } to{ opacity:1; transform:none } }
.hp2-eyebrow{ display:inline-flex; align-items:center; gap:10px; font-family:'IBM Plex Mono',monospace;
  font-weight:600; font-size:13.5px; letter-spacing:.14em; text-transform:uppercase; color:#6B2430; margin-bottom:22px }
.hp2-eyebrow::before{ content:''; width:22px; height:1px; background:#6B2430 }
.hp2-h1{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:62px; line-height:1.04;
  letter-spacing:-.01em; margin:0 }
@media (max-width:1300px){ .hp2-h1{ font-size:50px } }
@media (max-width:480px){ .hp2-h1{ font-size:34px } }
.hp2-tagline{ font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:14px; letter-spacing:.08em;
  text-transform:uppercase; margin:18px 0 0; display:flex; align-items:center; gap:10px }
.hp2-seg.sun{ color:#C9812E } .hp2-seg.slate{ color:#6B2430 }
.hp2-sep{ width:3px; height:3px; border-radius:50%; background:rgba(28,24,18,.2) }
.hp2-sub{ font-size:17px; line-height:1.6; color:#5A5140; max-width:460px; margin:16px 0 0 }
.hp2-cta{ display:inline-flex; align-items:center; margin-top:30px; padding:12px 22px; border-radius:6px;
  background:linear-gradient(90deg,#C9812E,#6B2430); color:#fff; text-decoration:none; font-weight:600; font-size:14px;
  box-shadow:0 10px 24px -12px rgba(201,129,46,.45); transition:transform .18s ease }
.hp2-cta:hover{ transform:translateY(-1px) }
.hp2-coord{ margin-top:20px; font-family:'IBM Plex Mono',monospace; font-size:13px; color:#5A5140;
  display:inline-flex; align-items:center; gap:9px; min-height:16px }
.hp2-blink{ width:5px; height:5px; background:#6B2430; animation:hp2Blink 1.4s steps(1) infinite }
@keyframes hp2Blink{ 0%,49%{opacity:1} 50%,100%{opacity:0} }
.hp2-coord-text{ animation:hp2Fade .4s ease both }
@keyframes hp2Fade{ from{opacity:0} to{opacity:1} }

.hp2-stage{ position:relative }

.hp2-drop{ position:absolute; top:-108px; left:16%; width:0; height:0; z-index:3 }
.hp2-pin{ position:absolute; left:-24px; top:-62px; width:48px; height:62px;
  filter:drop-shadow(0 10px 14px rgba(28,24,18,.3));
  opacity:0; animation:hp2PinDrop .7s cubic-bezier(.3,1.4,.5,1) .35s both }
@keyframes hp2PinDrop{
  0%{ opacity:0; transform:translateY(-90px) scale(.7) }
  55%{ opacity:1 }
  100%{ opacity:1; transform:translateY(0) scale(1) } }
.hp2-shadow{ position:absolute; left:-17px; top:-4px; width:34px; height:9px; border-radius:50%;
  background:rgba(28,24,18,.22); opacity:0; animation:hp2ShadowIn .4s ease .95s both }
@keyframes hp2ShadowIn{ from{opacity:0; transform:scaleX(.4)} to{opacity:1; transform:none} }
.hp2-ring{ position:absolute; left:0; top:0; width:26px; height:26px; margin:-13px 0 0 -13px;
  border-radius:50%; border:1.5px solid #6B2430; opacity:0 }
.hp2-ring-1{ animation:hp2Ring 2.8s ease-out 1s infinite }
.hp2-ring-2{ animation:hp2Ring 2.8s ease-out 1.9s infinite }
.hp2-ring-3{ animation:hp2Ring 2.8s ease-out 2.8s infinite }
@keyframes hp2Ring{
  0%{ opacity:.55; transform:scale(.5) }
  100%{ opacity:0; transform:scale(7.5) } }

.hp2-card{ position:relative; background:#FFFDF8; border:1px solid rgba(28,24,18,.14); border-radius:12px;
  padding:30px 28px; box-shadow:0 30px 70px -34px rgba(28,24,18,.42);
  opacity:0; animation:hp2CardIn .6s ease .85s both }
@keyframes hp2CardIn{ from{ opacity:0; transform:translateY(16px) } to{ opacity:1; transform:none } }
.hp2-card-tag{ position:absolute; top:-14px; left:22px; background:#1C1812; color:#FFFDF8;
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  padding:7px 12px; border-radius:20px }
.hp2-card-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px }
.hp2-card-label{ font-family:'IBM Plex Mono',monospace; font-size:12.5px; letter-spacing:.1em;
  text-transform:uppercase; color:#726A54 }
.hp2-card-badge{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:13px; color:#fff;
  background:linear-gradient(90deg,#C9812E,#6B2430); padding:6px 14px; border-radius:20px }
.hp2-num{ font-family:'Bricolage Grotesque',sans-serif; font-weight:700; font-size:56px; line-height:1;
  margin-bottom:10px }
.hp2-num span{ font-size:18px; color:#726A54; font-family:'Inter',sans-serif; font-weight:500 }
.hp2-verdict{ font-size:15px; color:#5A5140; line-height:1.5; margin:0 0 20px }
.hp2-item{ border:1px solid rgba(28,24,18,.14); border-radius:8px; padding:11px 14px; margin-bottom:10px }
.hp2-item.slate{ border-left:3px solid #6B2430 } .hp2-item.sun{ border-left:3px solid #C9812E }
.hp2-item-label{ display:block; font-weight:600; font-size:14.5px }
.hp2-item-sub{ display:block; font-family:'IBM Plex Mono',monospace; font-size:11.5px; letter-spacing:.05em;
  color:#726A54; margin-top:3px }
.hp2-foot{ font-size:12.5px; color:#5A5140; line-height:1.6; border-top:1px solid rgba(28,24,18,.08);
  padding-top:14px; margin-top:8px }

@media (prefers-reduced-motion: reduce){
  .hp2-map,.hp2-copy,.hp2-pin,.hp2-shadow,.hp2-card,.hp2-coord-text{ animation:none !important; opacity:1 !important; transform:none !important }
  .hp2-ring{ display:none }
}
`;
