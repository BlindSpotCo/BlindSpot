'use client';
// components/ClosingCTA.js
// Footer v2 -- the v1 redesign (grain, glow, two link columns, a faint
// 4%-opacity wordmark sitting behind everything as pure texture) still
// read as flat per feedback. Followed the specific CollectUI reference
// this time (merus1894.com's footer): the difference isn't more
// content, it's that their wordmark is a real BOLD statement in its
// own row -- not decoration bleeding through behind other content --
// plus a genuine hover *animation* on it: hovering the wordmark wipes
// it away left-to-right and reveals a second line underneath in the
// same spot (their case: "MERUS" -> "SINCE 1894"). Rebuilt around
// that, not the cursor-spotlight glow tried first:
// - Small brand lockup as its own top strip (was mixed in as a 3rd
//   column before).
// - Three real link columns instead of two -- added Connect, the
//   two founders' actual LinkedIn links (same URLs as TeamSection.js),
//   not an invented Careers/Investors column.
// - The wordmark is its own full-width statement row. Two stacked
//   layers occupy the same box: BLINDSPOT on top, and the same real
//   tagline already used above (.footer-tagline's "Property
//   Intelligence" -- not invented copy) underneath. Hovering the row
//   clip-path-wipes the top layer away while the tagline wipes in,
//   pure CSS, no JS needed.

import PinDropTransition from '@/components/PinDropTransition';

export default function ClosingCTA() {
  return (
    <section className="section section-closing2 reveal">
      <div className="cc-grain" aria-hidden="true" />
      <div className="wrap closing2-inner">
        <span className="eyebrow">06 - One Pin Away</span>
        <h2>Because every property has a blindspot, and we&apos;re making it <span className="gold-word">visible</span>.</h2>
        <p>See the sunlight. Know the neighbourhood. Two free tools. One pin. Everything the listing wasn&apos;t going to mention.</p>
        <div className="closing2-ctas">
          <PinDropTransition href="/#find" className="btn btn-lg btn-cta">
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
              <a href="/#find">Uncover Your BlindSpot</a>
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

        <div className="cc-foot-wordmark-wrap" aria-hidden="true">
          <span className="cc-foot-wordmark cc-foot-wordmark-main">BLINDSPOT</span>
          <span className="cc-foot-wordmark cc-foot-wordmark-alt">PROPERTY INTELLIGENCE</span>
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
