'use client';
// components/SiteHeader.js
// The nav bar, extracted from the homepage so every page (not just "/") gets
// the logo, links, tool buttons, and auth state instead of a bare
// "back to home" link floating in empty space.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SiteHeader({ homeHref = '/' }) {
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

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
          <a href="https://sun-scout.com" target="_blank" rel="noopener" className="btn">
            <span className="btn-dot d-sun"></span>SunScout
          </a>
          <a href="https://aslivastu.com" target="_blank" rel="noopener" className="btn">
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
        </div>
      </nav>
    </header>
  );
}
