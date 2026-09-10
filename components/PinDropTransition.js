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
//
// The .pdt overlay is rendered via a portal into document.body rather than
// in place. `.pdt` is `position:fixed; inset:0` so it should always cover
// the full viewport -- but `position:fixed` is fixed to the nearest
// ancestor that establishes a containing block, and any ancestor with a
// `transform` (e.g. the old .floating-cta pill's translate(), used to
// slide it in/out before that button was removed) creates exactly that.
// Rendered in place inside a transformed
// wrapper, the whole "lock onto the pin" animation shrank down to and
// played inside that wrapper's own small box instead of filling the
// screen. A portal to document.body sidesteps the whole containing-block
// problem: `.pdt` is never a descendant of whatever transformed element
// triggered it, wherever this component gets used.
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

// The last element (the pin, then the readout) finishes at ~1400ms -- see
// the timing note above .pdt in globals.css. Navigation deliberately fires
// AFTER that, with a short hold, so the sequence resolves before the new
// page takes over. The previous 900ms push cut the ring, pin and readout
// off mid-motion whenever the destination loaded quickly, which is what
// made it feel abrupt. If you retune the CSS delays, keep NAV_AT_MS
// greater than the last animation's end time.
const TOTAL_MS = 1560;
const NAV_AT_MS = 1560;  // ~1400ms of animation + ~160ms hold on the resolved frame
const REDUCED_MS = 320;  // reduced-motion: brief fade, then go

export default function PinDropTransition({ href = '/#find', className, children, autoStart = false }) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);

  // The readout printed Bangalore's coordinates over every address in the
  // country. The real ones are already in the href this link carries.
  const coords = (() => {
    try {
      const u = new URL(href, typeof window === 'undefined' ? 'https://x' : window.location.href);
      const la = parseFloat(u.searchParams.get('lat'));
      const lo = parseFloat(u.searchParams.get('lon'));
      if (!Number.isFinite(la) || !Number.isFinite(lo)) return '';
      return `${Math.abs(la).toFixed(4)}\u00B0 ${la >= 0 ? 'N' : 'S'} \u00B7 ${Math.abs(lo).toFixed(4)}\u00B0 ${lo >= 0 ? 'E' : 'W'}`;
    } catch { return ''; }
  })();

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Core sequence, split out from the click handler below so it can also
  // fire on its own -- see `autoStart`, used by the hero's address-pick
  // flow to play this same "acquiring site" transition automatically
  // once an address is chosen, instead of making someone click a second
  // "see the report" button after already clicking the address.
  const begin = useCallback(() => {
    if (playing) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setPlaying(true);
    router.prefetch?.(href);

    const navAt = reduced ? REDUCED_MS : NAV_AT_MS;
    timers.current.push(setTimeout(() => {
      router.push(href);
      // `playing` was never reset after this. Harmless for the current
      // sole use (the hero's own CTA, which always pushes to a
      // different page -- /report -- so this component unmounts along
      // with the rest of the tree). But this same component used to
      // also power every generic "Uncover Your BlindSpot" button
      // (nav, footer, steps CTA) linking to /#find on this same page,
      // where router.push doesn't remount anything -- `playing` stayed
      // true forever and the full-screen overlay below never went
      // away. Those were switched to plain scroll links instead (see
      // ClosingCTA.js's comment), but resetting here too so this
      // component is safe by default if it's ever reused for another
      // same-page destination. A short buffer past the nav itself, so
      // it clears just after the new content is in rather than
      // mid-navigation.
      timers.current.push(setTimeout(() => setPlaying(false), 400));
    }, navAt));
  }, [playing, router, href]);

  const start = useCallback((e) => {
    // Let modifier-clicks / middle-clicks behave like a normal link so we
    // don't break "open in new tab".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    begin();
  }, [begin]);

  // autoStart flips false -> true once the caller decides it's time to
  // go (e.g. the hero's own short "here's what we found" beat) -- no
  // click required. The visible link still works too, for anyone who
  // taps it first.
  useEffect(() => {
    if (autoStart) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <>
      <a href={href} onClick={start} className={className}>{children}</a>

      {playing && typeof document !== 'undefined' && createPortal(
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
            <span className="pdt-readout-sub">{coords || 'Locating'}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export { TOTAL_MS as PIN_DROP_TOTAL_MS };
