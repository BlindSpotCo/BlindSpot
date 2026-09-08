'use client';
// components/ClosingCTA.js
// Final CTA + footer -- same real closing line as before, footer
// redesigned after looking at CollectUI's footer inspiration category:
// the recurring pattern there is a large faint background wordmark
// behind grouped link columns (a small caps label + a short real list
// under each) instead of one bare row. Only two columns here, both
// entirely real routes/anchors already in SiteHeader.js -- no invented
// Legal/Privacy pages, this app doesn't have any.

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
          <PinDropTransition href="/property-score" className="btn btn-lg btn-cta">
            Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
          </PinDropTransition>
        </div>
      </div>

      <footer>
        <div className="cc-foot-wordmark" aria-hidden="true">BLINDSPOT</div>
        <div className="wrap">
          <div className="footer-row2">
            <div className="footer-col footer-col-brand">
              <div className="footer-brand">
                <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" style={{ height: 19 }} />
                <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" style={{ height: 10 }} />
              </div>
              <p className="footer-tagline">Property Intelligence</p>
            </div>
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
          </div>
          <div className="footer-bottom">
            <div className="footer-fine">DATA FROM GOVERNMENT SOURCES + REAL SOLAR GEOMETRY</div>
            <div className="footer-copyright">© 2026 BlindSpot</div>
          </div>
        </div>
      </footer>
    </section>
  );
}
