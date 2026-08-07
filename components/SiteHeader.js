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
// so every link -- How It Works, Tools, Why BlindSpot, The Team -- and the
// "Uncover Your BlindSpot" CTA stay reachable on phones instead of silently
// disappearing (the old .nav-links row has always been display:none under
// 860px, which used to hide them with no way to reach them).
//
// The two AsliVastu/SunScout tool buttons that used to live here were
// deliberately removed site-wide in favor of one "Uncover Your BlindSpot"
// entry point into the real 3-step flow at /property-score.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SiteHeader({ homeHref = '/' }) {
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

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className={scrolled ? 'scrolled' : ''}>
      <nav className={`wrap${scrolled ? '' : ' nav-centered'}`}>
        <Link href={homeHref} className="brand">
          <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" />
          <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" />
        </Link>
        {scrolled && (
          <>
            <div className="nav-links">
              <Link href="/#how-it-works">How It Works</Link>
              <Link href="/#products">Tools</Link>
              <Link href="/#why">Why BlindSpot</Link>
              <Link href="/#team">The Team</Link>
            </div>
            <div className="nav-cta">
              <Link href="/property-score" className="btn-cta-sm">Uncover Your BlindSpot</Link>
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
                  <Link href="/login" className="btn btn-auth">Sign in</Link>
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

      {scrolled && (
        <div className={`nav-mobile-panel${mobileOpen ? ' is-open' : ''}`}>
          <div className="wrap" style={{ display: 'flex', flexDirection: 'column' }}>
            <Link href="/#how-it-works" onClick={closeMobile}>How It Works</Link>
            <Link href="/#products" onClick={closeMobile}>Tools</Link>
            <Link href="/#why" onClick={closeMobile}>Why BlindSpot</Link>
            <Link href="/#team" onClick={closeMobile}>The Team</Link>
            <Link href="/property-score" onClick={closeMobile}>Uncover Your BlindSpot</Link>
          </div>
        </div>
      )}
    </header>
  );
}
