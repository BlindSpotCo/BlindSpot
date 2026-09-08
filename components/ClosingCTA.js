'use client';
// components/ClosingCTA.js
// Final CTA + footer -- same real closing line and footer content as the
// old inline section in app/page.js (kept, it's a real and accurate line,
// not reworded for effect), redesigned shell.

import PinDropTransition from '@/components/PinDropTransition';

export default function ClosingCTA() {
  return (
    <section className="section section-closing2 reveal">
      <div className="wrap closing2-inner">
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
          <div className="footer-row">
            <div className="footer-brand">
              <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" style={{ height: 19 }} />
              <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" style={{ height: 10 }} />
            </div>
            <div className="footer-links">
              <a href="#team">The Team</a>
            </div>
          </div>
          <div className="footer-fine">DATA FROM GOVERNMENT SOURCES + REAL SOLAR GEOMETRY</div>
        </div>
      </footer>
    </section>
  );
}
