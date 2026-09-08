'use client';
// components/SiteHeader.js
// The nav bar, extracted from the homepage so every page (not just "/") gets
// the logo, links, CTA, and auth state instead of a bare "back to home" link
// floating in empty space.
//
// Starts as just the centered logo -- no links, no CTA, no background bar --
// so the very first thing someone sees is the brand, full stop. The nav
// links/CTA/sign-in are only rendered (not just hidden) once `scrolled`
// flips true, so there's nothing sitting invisibly in the layout at rest.
//
// Below 860px the revealed nav collapses into a hamburger + dropdown panel
// so every link -- How It Works, Tools, The Team -- and the
// "Uncover Your BlindSpot" CTA stay reachable on phones instead of silently
// disappearing (the old .nav-links row has always been display:none under
// 860px, which used to hide them with no way to reach them).
//
// The two AsliVastu/SunScout tool buttons that used to live here were
// deliberately removed site-wide in favor of one "Uncover Your BlindSpot"
// entry point into the report: the address search on the home page.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { openSignInPopup } from '@/lib/auth/popupSignIn';
import PinDropTransition from '@/components/PinDropTransition';

export default function SiteHeader({ homeHref = '/' }) {
  // The CTA is an entry point into the report -- pointing at the page
  // you're already on is dead weight in the nav, and (with the progress
  // stepper right below it) actively confusing, since it reads as another
  // step rather than the thing you already did to get here. Derived from
  // the route so it self-manages rather than needing a prop at each usage.
  const pathname = usePathname();
  // /floor-plan-analysis counts as "in the flow" too: it's the third of
  // the three doors on the Property Score start screen, reached by an
  // ordinary in-tab navigation from it. Treating it as a marketing page
  // meant a floating "Uncover Your BlindSpot" pill sat over that tool's
  // own form while you were filling it in, inviting you to abandon the
  // thing you were in the middle of -- and the nav didn't appear until
  // you scrolled, so the page opened with no way out at all.
  // /report is the same thing again: it IS the flow now -- the address
  // search on the homepage lands straight on it. Treated as a marketing
  // page it hid its own nav until you scrolled and floated an "Uncover
  // Your BlindSpot" pill over a report you had already uncovered.
  const onFlow = pathname?.startsWith('/report')
    || pathname?.startsWith('/floor-plan-analysis');

  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Checked once on mount too (not just on scroll), in case the page loads
  // already scrolled down (e.g. from an anchor link or browser scroll
  // restore) -- otherwise the header would stay bare until the next scroll
  // event even though the page isn't at the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The homepage opens on the live-map hero -- a near-black field, not the
  // usual cream page background. The header's normal resting state (fully
  // transparent, dark-ink logo) is tuned for sitting over that cream
  // background: transparent over the dark hero just let the header's own
  // 66px row show the cream <body> behind it, which is what read as a
  // stray empty bar above the map. `heroCleared` tracks whether we've
  // scrolled past the hero's own height (not just the old 24px threshold)
  // -- while it's false we're guaranteed to still be over the dark field,
  // so the header can paint itself the same dark tone (see
  // header.header-on-dark in globals.css) and swap the logo to its light
  // variant, instead of leaving the row transparent. Every other page
  // starts "cleared" immediately -- nothing there needs this treatment.
  const isHome = pathname === '/';
  const [heroCleared, setHeroCleared] = useState(!isHome);
  useEffect(() => {
    if (!isHome) { setHeroCleared(true); return undefined; }
    setHeroCleared(false);
    const compute = () => {
      const heroEl = document.querySelector('.hero-statement');
      const h = heroEl ? heroEl.getBoundingClientRect().height : window.innerHeight;
      setHeroCleared(window.scrollY > h - 80);
    };
    compute();
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [isHome]);

  // Floating "Uncover Your BlindSpot" pill -- used to live only in
  // app/page.js, originally gated behind a scroll threshold so it only
  // appeared once beat 2's own full-size CTA had had its moment -- per
  // direct request it's now on from the very first screen too (the
  // homepage hero has no CTA of its own, by design, see beat 1's own
  // comment in app/page.js), so there's no longer a scroll-position case
  // where the next action isn't one tap away. Moved here so every page
  // keeps it, not just the homepage. Suppressed on the property-score
  // flow itself, same as the nav CTA above -- pointing at the page
  // you're already on is dead weight.
  const floatingCtaVisible = !onFlow && heroCleared;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setCheckedAuth(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the mobile panel on route-ish navigation (link clicks) automatically
  // via onClick handlers below, and also if the viewport grows past mobile.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 860) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  // Signing in used to be a plain <Link href="/login">, which navigated
  // the whole tab away -- fine on most pages, but PropertyScoreFlow keeps
  // its step (locality/address picked, unit floor/facing, generated
  // verdict...) in plain React state with nothing in the URL. Landing back
  // on /property-score after sign-in was a fresh page load, so that state
  // was gone and the person was back at step 1 -- "once I sign in on the
  // 2nd page it takes me back to first."
  //
  // Signing in via a popup (same /login page, same email+Google flow --
  // see lib/auth/popupSignIn.js) means this tab never navigates, so
  // whatever page/step someone was on is untouched. Falls back to a normal
  // full-page redirect (with ?next= back to this exact page) if the popup
  // gets blocked.
  const [signingIn, setSigningIn] = useState(false);
  const handleSignInClick = async (e) => {
    e.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    try {
      const supabase = createClient();
      const { access_token, refresh_token } = await openSignInPopup();
      await supabase.auth.setSession({ access_token, refresh_token });
    } catch {
      window.location.href = `/login?next=${encodeURIComponent(pathname || '/')}`;
    } finally {
      setSigningIn(false);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  // Reveal the full nav (links, My Reports/sign-out, hamburger) any time
  // we're inside the property-score flow, not just once you've scrolled
  // 24px. The scroll-reveal makes sense on the marketing homepage (start
  // on just the logo, earn the nav as you engage) but several flow steps
  // -- the Verdict card in particular -- are short enough that a visitor
  // never crosses that threshold, so the nav (and with it, the only way
  // back to Tools/How It Works/home besides the browser's own back
  // button) just never appears for the whole time they're in the flow.
  const revealNav = onFlow || (isHome ? heroCleared : scrolled);

  return (
    <>
      {/* The whole homepage is now one continuous dark surface (hero
          through the closing CTA -- see .section-dark in globals.css),
          so the header stays in its dark/glass treatment for the entire
          home page rather than switching to the light `.scrolled` bar
          once you scroll past the hero -- that light bar only makes
          sense over light page content, which the homepage no longer
          has below the fold. Every other page is unaffected. */}
      <header className={isHome ? 'header-on-dark' : (revealNav ? 'scrolled' : '')}>
      <nav className={`wrap${revealNav ? '' : ' nav-centered'}`}>
        <Link href={homeHref} className="brand">
          <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" />
          <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" />
        </Link>
        {revealNav && (
          <>
            <div className="nav-links">
              <Link href="/#how-it-works">How It Works</Link>
              <Link href="/#products">Tools</Link>
              <Link href="/#team">The Team</Link>
            </div>
            <div className="nav-cta">
              {!onFlow && (
                <Link href="/#find" className="btn-cta-sm">
                  <span className="btn-cta-full">Uncover Your BlindSpot</span>
                  <span className="btn-cta-short">Start</span>
                </Link>
              )}
              {/* .nav-user / .btn-auth are hidden below 640px (see globals.css) --
                  "My Reports" + "Sign out" together were the widest thing in
                  this row and had nowhere to shrink to, which is what pushed
                  the CTA pill left into the logo. Same auth state is repeated
                  in the mobile panel below so it's still reachable on phones. */}
              {checkedAuth && (
                user ? (
                  <div className="nav-user">
                    <Link href="/my-reports">My Reports</Link>
                    <button
                      onClick={handleSignOut}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <a href="/login" onClick={handleSignInClick} className="btn btn-auth">{signingIn ? 'Signing in…' : 'Sign in'}</a>
                )
              )}
              <button
                className={`nav-burger${mobileOpen ? ' is-open' : ''}`}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                <span></span>
              </button>
            </div>
          </>
        )}
      </nav>

      {revealNav && (
        <div className={`nav-mobile-panel${mobileOpen ? ' is-open' : ''}`}>
          <div className="wrap" style={{ display: 'flex', flexDirection: 'column' }}>
            <Link href="/#how-it-works" onClick={closeMobile}>How It Works</Link>
            <Link href="/#products" onClick={closeMobile}>Tools</Link>
            <Link href="/#team" onClick={closeMobile}>The Team</Link>
            {!onFlow && <Link href="/#find" onClick={closeMobile}>Uncover Your BlindSpot</Link>}
            {checkedAuth && (
              user ? (
                <>
                  <Link href="/my-reports" onClick={closeMobile}>My Reports</Link>
                  <button
                    onClick={() => { handleSignOut(); closeMobile(); }}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: '12px 4px', textAlign: 'left' }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <a href="/login" onClick={(e) => { handleSignInClick(e); closeMobile(); }}>{signingIn ? 'Signing in…' : 'Sign in'}</a>
              )
            )}
          </div>
        </div>
      )}
      </header>

      {/* Fixed-position, so its place in the tree doesn't matter for where
          it renders -- kept as a sibling of <header>, not a descendant,
          so header.scrolled's backdrop-filter (which -- like `filter` --
          establishes a containing block for fixed descendants) can never
          re-pin this to the header bar instead of the viewport bottom. */}
      <div className={`floating-cta${floatingCtaVisible ? ' is-visible' : ''}`} aria-hidden={!floatingCtaVisible}>
        <PinDropTransition href="/#find" className="btn-cta-sm floating-cta-btn">
          Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
        </PinDropTransition>
      </div>
    </>
  );
}
