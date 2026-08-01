'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Sign-in did not complete. Please try again.');
        return;
      }
      const url = new URL(next);
      url.hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
      window.location.href = url.toString();
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0B', color: '#9C9CA1', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
      {message}
    </div>
  );
}
