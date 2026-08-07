'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Only these origins are ever allowed to receive session tokens this way.
// Without this check, 'next' could be set to any attacker-controlled URL
// in the address bar, and a signed-in visitor's access/refresh tokens
// would be handed straight to it -- full account takeover via one link.
const ALLOWED_ORIGINS = ['https://sun-scout.com', 'https://www.sun-scout.com', 'https://aslivastu.com', 'https://www.aslivastu.com', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

// Reached right after /auth/callback establishes a session via cookies.
// Its only job: read that session and jump to the external site (SunScout,
// AsliVastu) with the tokens in the URL fragment, done via a plain client-
// side navigation so the fragment can never be silently dropped the way it
// can be in a server redirect's Location header.
export default function ExternalRedirect() {
  const [message, setMessage] = useState('Redirecting…');

  useEffect(() => {
    (async () => {
      const next = new URLSearchParams(window.location.search).get('next');
      if (!next) {
        setMessage('Missing destination.');
        return;
      }

      let url;
      try {
        url = new URL(next);
      } catch {
        setMessage('Invalid destination.');
        return;
      }
      if (!ALLOWED_ORIGINS.includes(url.origin)) {
        setMessage('This redirect destination is not recognized.');
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Sign-in did not complete. Please try again.');
        return;
      }
      url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
      window.location.href = url.toString();
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-mute)', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
      {message}
    </div>
  );
}
