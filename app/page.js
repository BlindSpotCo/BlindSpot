'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import SiteHeader from '@/components/SiteHeader';
import HowItWorks from '@/components/HowItWorks';
import HeroIllustration from '@/components/HeroIllustration';

export default function Home() {
  // Auth state, scroll-reveal and the mobile menu all now live in
  // SiteHeader (shared across every page) — this file only needs the
  // hero's own coordinate-readout ref.
  const coordRef = useRef(null);

  // Rotating coordinate readout in the hero — ported directly from the
  // original inline script.
  useEffect(() => {
    const spots = [
      { c: '12.9716° N, 77.5946° E', l: 'checking Bengaluru' },
      { c: '28.5245° N, 77.1855° E', l: 'scoring Vasant Kunj, Delhi' },
      { c: '19.0760° N, 72.8777° E', l: 'mapping shadow hours, Mumbai' },
      { c: '28.4595° N, 77.0266° E', l: 'pulling AQI + power data, Gurugram' },
    ];
    let i = 0;
    const el = coordRef.current;
    if (!el) return;
    el.style.transition = 'opacity .26s ease';
    const timer = setInterval(() => {
      i = (i + 1) % spots.length;
      el.style.opacity = 0;
      setTimeout(() => {
        el.textContent = spots[i].c + ' — ' + spots[i].l;
        el.style.opacity = 1;
      }, 260);
    }, 3400);
    return () => clearInterval(timer);
  }, []);

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

      <section className="hero">
        <div className="hero-bg" aria-hidden="true"></div>

        <div className="wrap hero-grid">
          <div className="hero-content">
            <span className="hero-eyebrow">Property Intelligence</span>
            <h1>Know the place, before you commit.</h1>
            <p className="hero-tagline"><span className="seg sun">One pin</span><span className="sep"></span><span className="seg slate">Two answers</span></p>
            <p className="hero-sub">Drop a pin. See exactly what the neighbourhood around it is really like, and exactly how sunlight moves through the unit. Real government records. Real solar geometry. No broker spin.</p>
            <div className="hero-ctas">
              <Link href="/property-score" className="btn btn-lg btn-cta">Uncover Your BlindSpot →</Link>
            </div>
            <div className="coord-readout"><span className="blink"></span><span ref={coordRef} className="mono">12.9716° N, 77.5946° E — checking Bengaluru</span></div>
          </div>

          <div className="hero-visual">
            <HeroIllustration />
            <span className="hero-visual-tag">Live preview</span>
            <div className="hero-score-card">
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
                    <span className="hsc-item-sub">Koramangala — 78/100</span>
                  </div>
                </div>
                <div className="hsc-item sun">
                  <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
                  <div>
                    <span className="hsc-item-label">Bright, well-ventilated unit</span>
                    <span className="hsc-item-sub">Floor 7, SE — 82/100</span>
                  </div>
                </div>
              </div>
              <div className="hsc-foot">Real solar geometry + government locality data, combined into one number you can trust.</div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section className="section" id="products">
        <div className="wrap section-inner">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">01 — The Platform</span>
              <h2>One location. Two lenses.</h2>
            </div>
            <p>Every property decision comes down to two questions. BlindSpot answers both from the same pin.</p>
          </div>
          <div className="products">
            <div className="pcard slate reveal">
              <div className="pcard-tag"><span className="dot"></span>Neighbourhood Intelligence</div>
              <h3>AsliVastu</h3>
              <p>Government data, not broker spin. Every area scored 0–100 across safety, air quality, power reliability, water, schools and infrastructure — pulled from public records, not a commission-driven source.</p>
              <div className="pcard-stats">
                <div><div className="pstat-num">150+</div><div className="pstat-lbl">Areas covered</div></div>
                <div><div className="pstat-num">8</div><div className="pstat-lbl">Dimensions</div></div>
                <div><div className="pstat-num">Govt.</div><div className="pstat-lbl">Data source</div></div>
              </div>
            </div>

            <div className="pcard sun reveal">
              <div className="pcard-tag"><span className="dot"></span>Solar &amp; Shadow Analysis</div>
              <h3>SunScout</h3>
              <p>Drop a pin on any property and watch the sun&apos;s real path arc across it — hour by hour, season by season, rendered against actual 3D building shadows. See exactly when direct light reaches a specific floor.</p>
              <div className="pcard-stats">
                <div><div className="pstat-num">365</div><div className="pstat-lbl">Days modeled</div></div>
                <div><div className="pstat-num">3D</div><div className="pstat-lbl">Building shadows</div></div>
                <div><div className="pstat-num">NOAA</div><div className="pstat-lbl">Solar data</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="why">
        <div className="wrap section-inner">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">03 — Why BlindSpot</span>
              <h2>Built for the decision, not the browse.</h2>
            </div>
          </div>
          <div className="why-list">
            <div className="why-row reveal">
              <svg className="why-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
              <div className="why-title">Sunlight is data, not vibes</div>
              <div className="why-desc">Listing photos are taken on sunny days, at the best angle, in summer. SunScout shows what light actually looks like at 9am in December — before you sign anything.</div>
            </div>
            <div className="why-row reveal">
              <svg className="why-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
              <div className="why-title">Brokers don&apos;t tell you everything</div>
              <div className="why-desc">Crime rates, AQI readings, power-cut frequency — AsliVastu pulls these straight from government records, not from someone with a commission riding on your decision.</div>
            </div>
            <div className="why-row reveal">
              <svg className="why-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
              <div className="why-title">One pin. Two answers.</div>
              <div className="why-desc">Drop a pin, get a solar-viability read and a neighbourhood-quality score. The two questions every property decision actually comes down to.</div>
            </div>
            <div className="why-row reveal">
              <svg className="why-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0"/></svg>
              <div className="why-title">Zero cost. No catch.</div>
              <div className="why-desc">Both tools are free with no sign-up. No paywalled scores, no lead-gen forms — just the data, instantly, in your browser.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="team">
        <div className="wrap section-inner">
          <div className="section-head reveal">
            <div>
              <span className="eyebrow">04 — The Team</span>
              <h2>Two people who got tired of guessing.</h2>
            </div>
            <p>The two founders behind BlindSpot&apos;s product line — each leading one half of the platform.</p>
          </div>
          <div className="team-grid">
            <div className="team-card reveal">
              <div className="team-avatar">AG</div>
              <div>
                <div className="team-name">Arushri Gangji</div>
                <div className="team-role sun">Co-founder · Builds SunScout</div>
                <div className="team-desc">Leads SunScout, the solar and shadow-analysis engine behind BlindSpot — modelling real sun paths and floor-level shadow hours for a unit, so buyers know exactly how much light a space gets before they sign anything.</div>
                <a href="https://www.linkedin.com/in/arushri-gangji-056108381/" target="_blank" rel="noopener" className="team-link">Connect on LinkedIn <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
              </div>
            </div>

            <div className="team-card reveal">
              <div className="team-avatar">GB</div>
              <div>
                <div className="team-name">Gurshaan Singh Baweja</div>
                <div className="team-role slate">Co-founder · Builds AsliVastu</div>
                <div className="team-desc">Leads AsliVastu, the neighbourhood-intelligence engine behind BlindSpot — pulling government data on safety, air quality, power and water into one score, so buyers stop relying on a broker&apos;s word for it.</div>
                <a href="https://www.linkedin.com/in/gurshaan-singh-baweja" target="_blank" rel="noopener" className="team-link">Connect on LinkedIn <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap closing-inner reveal">
          <h2>See the sunlight. Know the neighbourhood.</h2>
          <p>Two free tools. One pin. Everything the listing wasn&apos;t going to mention.</p>
          <div className="closing-ctas">
            <Link href="/property-score" className="btn btn-lg btn-cta">Uncover Your BlindSpot →</Link>
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
                <a href="#why">Why BlindSpot</a>
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
