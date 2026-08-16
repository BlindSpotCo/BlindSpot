'use client';
// components/PinDropTransition.js
// The transition that plays when someone clicks "Uncover Your BlindSpot".
//
// Built from the brand's own vocabulary rather than a generic page fade:
// the product's whole idea is dropping a pin on a map and having a survey
// instrument lock onto it, so that's literally what this is -- a blueprint
// grid wipes up, crosshairs slide in from the four edges and converge, a
// ring scales down and locks onto the centre, and a mono readout ticks
// through coordinates. Then it navigates.
//
// Deliberately no gradients, no glow, no glassmorphism -- per the brand
// doc's stated rule (see the .btn-cta comment in globals.css). It's one
// solid --brand field with white line work and one --ss accent, which is
// the same "one flat field, one accent detail" idiom as the CTA itself.
//
// Respects prefers-reduced-motion: those users get a plain short fade and
// the same navigation, with no sweeping motion at all.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const TOTAL_MS = 1150;   // full animation
const NAV_AT_MS = 900;   // push the route just before the ring finishes locking
const REDUCED_MS = 260;  // reduced-motion: brief fade, then go

export default function PinDropTransition({ href = '/property-score', className, children }) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = useCallback((e) => {
    // Let modifier-clicks / middle-clicks behave like a normal link so we
    // don't break "open in new tab".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (playing) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setPlaying(true);
    router.prefetch?.(href);

    const navAt = reduced ? REDUCED_MS : NAV_AT_MS;
    timers.current.push(setTimeout(() => router.push(href), navAt));
  }, [playing, router, href]);

  return (
    <>
      <a href={href} onClick={start} className={className}>{children}</a>

      {playing && (
        <div className="pdt" role="presentation" aria-hidden="true">
          {/* Solid brand field, wiped up from the bottom via clip-path --
              a hard edge sweeping past, not a fade. */}
          <div className="pdt-field" />

          <svg className="pdt-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
            {/* Blueprint survey grid -- same road-grid idiom as HeroMap,
                redrawn in white on the brand field. */}
            <g className="pdt-grid">
              {[125, 250, 375, 500, 625, 750, 875].map(v => (
                <line key={`h${v}`} x1="0" y1={v} x2="1000" y2={v} />
              ))}
              {[125, 250, 375, 500, 625, 750, 875].map(v => (
                <line key={`v${v}`} x1={v} y1="0" x2={v} y2="1000" />
              ))}
            </g>

            {/* Crosshairs converging on centre from all four edges. */}
            <g className="pdt-cross">
              <line className="pdt-cross-t" x1="500" y1="0" x2="500" y2="430" />
              <line className="pdt-cross-b" x1="500" y1="1000" x2="500" y2="570" />
              <line className="pdt-cross-l" x1="0" y1="500" x2="430" y2="500" />
              <line className="pdt-cross-r" x1="1000" y1="500" x2="570" y2="500" />
            </g>

            {/* Ring scales down and locks onto the pin. */}
            <circle className="pdt-ring pdt-ring-outer" cx="500" cy="500" r="150" />
            <circle className="pdt-ring pdt-ring-inner" cx="500" cy="500" r="92" />

            {/* Corner ticks -- the same "+" survey marks as the BPF
                blueprint frames used throughout the report surfaces. */}
            <g className="pdt-ticks">
              <path d="M350,350 h22 M361,339 v22" />
              <path d="M650,350 h-22 M639,339 v22" />
              <path d="M350,650 h22 M361,661 v-22" />
              <path d="M650,650 h-22 M639,661 v-22" />
            </g>

            {/* The pin itself, in --ss (SunScout orange) -- the single
                accent detail against the flat brand field. */}
            <circle className="pdt-pin" cx="500" cy="500" r="9" />
          </svg>

          <div className="pdt-readout mono">
            <span className="pdt-readout-line">ACQUIRING SITE</span>
            <span className="pdt-readout-sub">12.9716° N · 77.5946° E</span>
          </div>
        </div>
      )}
    </>
  );
}

export { TOTAL_MS as PIN_DROP_TOTAL_MS };
