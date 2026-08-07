'use client';
// components/SiteHeader.js
// The nav bar, extracted from the homepage so every page (not just "/") gets
// the logo, links, tool buttons, and auth state instead of a bare
// "back to home" link floating in empty space.
//
// Also includes a mobile hamburger + dropdown panel: below 860px the
// existing .nav-links row has always been display:none (a pre-existing gap,
// not new), which silently hid every nav link -- How It Works, Tools,
// Property Score, Why BlindSpot, The Team -- on phones with no way to
// reach them. This adds a toggle so they're still reachable on mobile.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SiteHeader({ homeHref = '/' }) {
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <header>
      <nav className="wrap">
        <Link href={homeHref} className="brand">
          <img className="brand-mark-img" src="/mark.png" alt="BlindSpot" />
          <img className="brand-word-img" src="/wordmark.png" alt="BlindSpot" />
        </Link>
        <div className="nav-links">
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/#products">Tools</Link>
          <Link href="/property-score">Property Score</Link>
          <Link href="/#why">Why BlindSpot</Link>
          <Link href="/#team">The Team</Link>
        </div>
        <div className="nav-cta">
          <a href="https://sun-scout.com" target="_blank" rel="noopener" className="btn nav-tool-btn">
            <span className="btn-dot d-sun"></span>SunScout
          </a>
          <a href="https://aslivastu.com" target="_blank" rel="noopener" className="btn nav-tool-btn">
            <span className="btn-dot d-slate"></span>AsliVastu
          </a>
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
            onClick={() => setMobileOpen(v => !v)}
          >
            <span></span>
          </button>
        </div>
      </nav>

      <div className={`nav-mobile-panel${mobileOpen ? ' is-open' : ''}`}>
        <div className="wrap" style={{ display: 'flex', flexDirection: 'column' }}>
          <Link href="/#how-it-works" onClick={closeMobile}>How It Works</Link>
          <Link href="/#products" onClick={closeMobile}>Tools</Link>
          <Link href="/property-score" onClick={closeMobile}>Property Score</Link>
          <Link href="/#why" onClick={closeMobile}>Why BlindSpot</Link>
          <Link href="/#team" onClick={closeMobile}>The Team</Link>
          <a href="https://sun-scout.com" target="_blank" rel="noopener" onClick={closeMobile} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="btn-dot d-sun"></span>SunScout
          </a>
          <a href="https://aslivastu.com" target="_blank" rel="noopener" onClick={closeMobile} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="btn-dot d-slate"></span>AsliVastu
          </a>
        </div>
      </div>
    </header>
  );
}
