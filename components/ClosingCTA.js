'use client';
// components/ClosingCTA.js
// Footer v2 -- the v1 redesign (grain, glow, two link columns, a faint
// 4%-opacity wordmark sitting behind everything as pure texture) still
// read as flat per feedback. Followed the specific CollectUI reference
// this time (merus1894.com's footer): the difference isn't more
// content, it's that their wordmark is a real BOLD statement in its
// own row -- not decoration bleeding through behind other content --
// plus a genuinely interactive hover moment on it. Rebuilt around
// that:
// - Small brand lockup as its own top strip (was mixed in as a 3rd
//   column before).
// - Three real link columns instead of two -- added Connect, the
//   two founders' actual LinkedIn links (same URLs as TeamSection.js),
//   not an invented Careers/Investors column.
// - The wordmark is now its own full-width statement row, not a
//   background layer -- bold, and dim by default with a soft gold
//   spotlight that follows the cursor (radial mask, position driven by
//   --mx/--my custom properties set on mousemove below) revealing it
//   in full colour where the pointer passes. Ties directly back to the
//   section's own line right above it ("...we're making it visible")
//   instead of being a generic effect borrowed wholesale.

import { useRef } from 'react';
import PinDropTransition from '@/components/PinDropTransition';

export default function ClosingCTA() {
  // Tracked against the wordmark row itself (not the whole footer) so
  // the mask's radial-gradient percentages -- which are relative to
  // THAT element's own box -- actually line up with the cursor.
  const wordmarkRef = useRef(null);

  const handleMove = (e) => {
    const el = wordmarkRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  return (
    <section className="section section-closing2 reveal">
      <div className="cc-grain" aria-hidden="true" />
      <div className="wrap closing2-inner">
        <span className="eyebrow">06 - One Pin Away</span>
        <h2>Because every property has a blindspot, and we&apos;re making it <span className="gold-word">visible</span>.</h2>
        <p>See the sunlight. Know the neighbourhood. Two free tools. One pin. Everything the listing wasn&apos;t going to mention.</p>
        <div className="closing2-ctas">
          <PinDropTransition href="/property-score" className="btn btn-lg btn-cta">
            Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
          </PinDropTransition>
        </div>
      </div>

      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div className="footer-brand">
              <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" style={{ height: 19 }} />
              <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" style={{ height: 10 }} />
            </div>
            <p className="footer-tagline">Property Intelligence</p>
          </div>

          <div className="footer-row2">
            <div className="footer-col">
              <span className="footer-col-title">Explore</span>
              <a href="/#how-it-works">How It Works</a>
              <a href="/#products">Tools</a>
              <a href="/#team">The Team</a>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Get Started</span>
              <a href="/property-score">Uncover Your BlindSpot</a>
              <a href="/signup">Create an account</a>
              <a href="/login">Sign in</a>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Connect</span>
              <a href="https://www.linkedin.com/in/gurshaan-singh-baweja" target="_blank" rel="noopener">Gurshaan · LinkedIn</a>
              <a href="https://www.linkedin.com/in/arushri-gangji-056108381/" target="_blank" rel="noopener">Arushri · LinkedIn</a>
            </div>
          </div>
        </div>

        <div className="cc-foot-wordmark-wrap" ref={wordmarkRef} onMouseMove={handleMove} aria-hidden="true">
          <span className="cc-foot-wordmark cc-foot-wordmark-base">BLINDSPOT</span>
          <span className="cc-foot-wordmark cc-foot-wordmark-glow">BLINDSPOT</span>
        </div>

        <div className="wrap">
          <div className="footer-bottom">
            <div className="footer-fine">DATA FROM GOVERNMENT SOURCES + REAL SOLAR GEOMETRY</div>
            <div className="footer-copyright">© 2026 BlindSpot</div>
          </div>
        </div>
      </footer>
    </section>
  );
}
