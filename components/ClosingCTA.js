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
// - Three real link columns instead of two. The third is now the
//   team itself, moved here from the old standalone TeamSection --
//   that section left a large stacked-padding gap after How It Works
//   (its own 88px top padding on top of How It Works' 88px bottom
//   padding + the step rail's CTA margin) with barely any content to
//   justify a full section, so the two founder cards (same real
//   names/roles/LinkedIn links TeamSection used) live here instead.
//   id="team" carries over so the nav's existing #team links still
//   land in the right place.
// - The wordmark is its own full-width statement row. Two stacked
//   layers occupy the same box: BLINDSPOT on top, and the same real
//   tagline already used above (.footer-tagline's "Property
//   Intelligence" -- not invented copy) underneath. Hovering the row
//   clip-path-wipes the top layer away while the tagline wipes in,
//   pure CSS, no JS needed.
// - The main CTA button below is a plain scroll-to-hero Link now, not
//   PinDropTransition. That animation plays an "ACQUIRING SITE" pin-lock
//   sequence themed around a real picked address, then navigates -- fine
//   for the hero's own CTA (HeroLiveMapCanvas.js), which only renders
//   once a real pin is chosen and pushes to /report with real
//   coordinates. Used here it was misleading (nothing had been "found"
//   yet) and, since /#find is on this same page, router.push() doesn't
//   remount PinDropTransition -- its `playing` state never got reset,
//   so the full-screen overlay stayed up forever. Every generic
//   "Uncover Your BlindSpot" entry point (this one, the nav, the
//   footer link) now just scrolls straight to the hero's address box.

import Link from 'next/link';

const TEAM = [
  {
    initials: 'AG',
    name: 'Arushri Gangji',
    accent: 'ss',
    linkedin: 'https://www.linkedin.com/in/arushri-gangji-056108381/',
  },
  {
    initials: 'GB',
    name: 'Gurshaan Singh Baweja',
    accent: 'av',
    linkedin: 'https://www.linkedin.com/in/gurshaan-singh-baweja',
  },
];

export default function ClosingCTA() {
  return (
    <section className="section section-closing2 reveal">
      <div className="cc-grain" aria-hidden="true" />
      <div className="wrap closing2-inner">
        <span className="eyebrow">05 - One Pin Away</span>
        <h2>Because every property has a blindspot, and we&apos;re making it <span className="gold-word">visible</span>.</h2>
        <div className="closing2-ctas">
          <Link href="/#find" className="btn btn-lg btn-cta">
            Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
          </Link>
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
            <div className="footer-col" id="team">
              <span className="footer-col-title">The Team</span>
              {TEAM.map((m) => (
                <a
                  key={m.name}
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener"
                  className={`footer-founder accent-${m.accent}`}
                >
                  <span className="footer-founder-avatar">{m.initials}</span>
                  <span className="footer-founder-info">
                    <span className="footer-founder-name">{m.name}</span>
                    <span className="footer-founder-role">Co-founder</span>
                  </span>
                </a>
              ))}
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
