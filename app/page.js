'use client';

import { useEffect } from 'react';
import SiteHeader from '@/components/SiteHeader';
import HowItWorks from '@/components/HowItWorks';
import PersonaSamples from '@/components/PersonaSamples';
import HeroLiveMap from '@/components/HeroLiveMap';
import PinDropTransition from '@/components/PinDropTransition';
import { coverageLabel } from '@/lib/aslivastu/cityMeta';

export default function Home() {
  // Auth state, scroll-reveal and the mobile menu all now live in
  // SiteHeader (shared across every page) — this file only needs the
  // hero's own coordinate-readout ref.

  // Reveal-on-scroll for .reveal elements — same behavior as the original.
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;
    if (!('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const seenByParent = {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const parentKey = el.parentElement ? el.parentElement.className : '';
          const delayIndex = seenByParent[parentKey] || 0;
          seenByParent[parentKey] = delayIndex + 1;
          setTimeout(() => el.classList.add('in-view'), delayIndex * 90);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <SiteHeader />

      {/* ===== HERO -- the map itself is the hero =====
          Live Leaflet map (CartoDB Dark Matter tiles), search bar
          floating on top, real /api/sunscout/geocode-suggest results.
          Selecting a result flies in, drops a pin, and reveals a few
          preview insight chips -- everything lives in
          components/HeroLiveMap.js / HeroLiveMapCanvas.js so this file
          only has to mount it. */}
      <section className="hero hero-statement">
        <HeroLiveMap />
      </section>

      {/* ===== HERO, BEAT 2 -- the verdict, big, on its own field =====
          Two-column on desktop, top-aligned (not vertically centred as
          a pair) -- copy on the left, scene+card on the right, offset
          up-and-left of the card rather than stacked dead-centre on it.
          Section height is bounded (clamp) rather than a raw
          min-height:100vh, so the field reads as a real "verdict"
          moment on ordinary screens without leaving a huge empty gap
          above/below the content on unusually tall ones -- that gap,
          and the two columns visually centring at different heights,
          was the actual bug in the previous pass. Collapses to a single
          centred column below 900px. Solid --brand field plus a faint
          blueprint grid -- same idiom as HeroMap and PinDropTransition's
          own .pdt-grid. Two rings in --ss now centred on the card
          itself, tracking its offset position. Reveals via the same
          .reveal/IntersectionObserver mechanism every other section on
          this page already uses -- no new JS. */}
      <section className="hero-verdict reveal" id="products">
        <div className="wrap hero-verdict-inner">
          <div className="hero-verdict-copy">
            <span className="hero-verdict-eyebrow">The verdict</span>
            <h2 className="hero-verdict-heading"><span className="seg sun">One pin.</span> <span className="seg slate">Two honest answers.</span></h2>
            <p className="hero-sub">Drop a pin. See exactly what the neighbourhood around it is really like, and exactly how sunlight moves through the unit. Real government records. Real solar geometry. No broker spin.</p>
            <span className="coverage-pill" style={{ marginTop: 26, marginBottom: 4 }}>
              <span className="dot" />Active in {coverageLabel()}, more cities coming
            </span>
            <div className="hero-ctas" style={{ marginTop: 28 }}>
              <PinDropTransition href="/property-score" className="btn btn-lg btn-cta">
                Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
              </PinDropTransition>
            </div>
          </div>

          <div className="hero-verdict-visual">
            <div className="hero-card-wrap">
              <span className="hvl-ring hvl-ring-outer" aria-hidden="true" />
              <span className="hvl-ring hvl-ring-inner" aria-hidden="true" />
              <span className="hero-visual-tag">Live preview</span>
              <div className="hero-score-card lg">
                <div className="hsc-head">
                  <span className="hsc-label">BlindSpot Score</span>
                  <span className="hsc-badge">Recommended</span>
                </div>
                <div className="hsc-number">80<span>/100</span></div>
                {/* Leads with the plain-English takeaway before any raw
                    numbers — directly per the mentor's report feedback in
                    the shared sheet ("the fundamental question is not 'how
                    much sunlight' but 'should I buy this property'"). The
                    two reason rows below follow the same logic: a human
                    sentence first, the underlying score folded in small and
                    second, not the other way round. */}
                <p className="hsc-verdict">Good light, safe neighbourhood, fair value for the area.</p>
                <div className="hsc-row">
                  <div className="hsc-item slate">
                    <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
                    <div>
                      <span className="hsc-item-label">Safe, well-connected area</span>
                      <span className="hsc-item-sub">Koramangala - 78/100</span>
                    </div>
                  </div>
                  <div className="hsc-item sun">
                    <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
                    <div>
                      <span className="hsc-item-label">Bright, well-ventilated unit</span>
                      <span className="hsc-item-sub">Floor 7, SE - 82/100</span>
                    </div>
                  </div>
                </div>
                <div className="hsc-foot">Real solar geometry + government locality data, combined into one number you can trust.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <PersonaSamples />

      <section className="section team-section" id="team">
        <div className="wrap section-inner">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">03 - The Team</span>
              <h2>Two people who got tired of guessing.</h2>
            </div>
            <p>The two founders behind BlindSpot&apos;s product line, each leading one half of the platform.</p>
          </div>
          <div className="team-grid">
            <div className="team-card reveal">
              <div className="team-avatar">AG</div>
              <div>
                <div className="team-name">Arushri Gangji</div>
                <div className="team-role sun">Co-founder · Home Comfort Score</div>
                <div className="team-desc">Leads Home Comfort Score, the solar and shadow-analysis engine behind BlindSpot, modelling real sun paths and floor-level shadow hours for a unit, so buyers know exactly how much light a space gets before they sign anything.</div>
                <a href="https://www.linkedin.com/in/arushri-gangji-056108381/" target="_blank" rel="noopener" className="team-link">Connect on LinkedIn <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
              </div>
            </div>

            <div className="team-card reveal">
              <div className="team-avatar">GB</div>
              <div>
                <div className="team-name">Gurshaan Singh Baweja</div>
                <div className="team-role slate">Co-founder · Neighbourhood Score</div>
                <div className="team-desc">Leads Neighbourhood Score, the neighbourhood-intelligence engine behind BlindSpot, pulling government data on safety, air quality, power and water into one score, so buyers stop relying on a broker&apos;s word for it.</div>
                <a href="https://www.linkedin.com/in/gurshaan-singh-baweja" target="_blank" rel="noopener" className="team-link">Connect on LinkedIn <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap closing-inner bento reveal">
          <h2>Because every property has a blindspot, and we&apos;re making it visible.</h2>
          <p>See the sunlight. Know the neighbourhood. Two free tools. One pin. Everything the listing wasn&apos;t going to mention.</p>
          <div className="closing-ctas">
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
    </>
  );
}
