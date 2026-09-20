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
// - Real link columns, not the old two static ones. The team itself
//   is one of them, moved here from the old standalone TeamSection --
//   that section left a large stacked-padding gap after How It Works
//   (its own 88px top padding on top of How It Works' 88px bottom
//   padding + the step rail's CTA margin) with barely any content to
//   justify a full section, so the two founder cards (same real
//   names/roles/LinkedIn links TeamSection used) live here instead.
//   id="team" carries over so the nav's existing #team links still
//   land in the right place. Originally shipped with a third "Explore"
//   column (How It Works / Tools / The Team) repeating the header
//   nav's own links verbatim -- dropped later since the header sits
//   right above this on every page and the repeat added nothing.
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

import { goToSearch } from '@/components/goToSearch';
import Link from 'next/link';

const TEAM = [
  { name: 'Arushri Gangji', linkedin: 'https://www.linkedin.com/in/arushri-gangji-056108381/' },
  { name: 'Gurshaan Singh Baweja', linkedin: 'https://www.linkedin.com/in/gurshaan-singh-baweja' },
];

export default function ClosingCTA() {
  return (
    <section className="section section-closing2 reveal">
      <div className="cc-grain" aria-hidden="true" />
      <div className="wrap closing2-inner">
        <span className="eyebrow">05 - One Pin Away</span>
        <h2>Because every property has a blindspot, and we&apos;re making it <span className="gold-word">visible</span>.</h2>
        <div className="closing2-ctas">
          <Link href="/#find" className="btn btn-lg btn-cta" onClick={goToSearch}>
            Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
          </Link>
        </div>
      </div>

      {/* Footer v3 -- v2 followed a reference whose whole idea was a
          190px BLINDSPOT wordmark as a "statement row", with the links
          centred in a 520px column above it. On a real 1440px screen
          that reads as a brand shouting its own name over a mostly
          empty field: the wordmark alone was taller than everything
          with information in it put together, and the two link columns
          used a third of the width. Dropped the statement row, moved
          to the ordinary shape a company footer has -- brand on the
          left, link columns on the right, one legal line underneath.
          The hover wipe went with it; a piece of typography nobody can
          act on is not worth 200px and a clip-path animation. */}
      <footer>
        <div className="wrap">
          <div className="footer-main">
            <div className="footer-ident">
              <div className="footer-brand">
                <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" style={{ height: 18 }} />
                <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" style={{ height: 10 }} />
              </div>
              <p className="footer-tagline">Property Intelligence</p>
              <p className="footer-fine">Government records + real solar geometry</p>
            </div>

            <div className="footer-links">
              <div className="footer-col">
                <span className="footer-col-title">Get Started</span>
                <a href="/#find" onClick={goToSearch}>Uncover Your BlindSpot</a>
                <a href="/signup">Create an account</a>
                <a href="/login">Sign in</a>
              </div>
              {/* The avatars and the stacked name/role pairs were the
                  other half of the height here. Two people, two links,
                  one line each -- the role is said once, above them. */}
              <div className="footer-col" id="team">
                <span className="footer-col-title">Co-founders</span>
                {TEAM.map((m) => (
                  <a key={m.name} href={m.linkedin} target="_blank" rel="noopener">
                    {m.name}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span className="footer-copyright">© 2026 BlindSpot</span>
            <span className="footer-copyright">Delhi NCR · Bangalore · Chandigarh · Hyderabad · Mumbai</span>
          </div>
        </div>
      </footer>
    </section>
  );
}
