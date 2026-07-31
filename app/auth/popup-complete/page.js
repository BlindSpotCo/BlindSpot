'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Only these origins are allowed to receive a session via postMessage from
// a popup -- prevents some unrelated site from opening a login popup and
// harvesting a session token back to itself.
const ALLOWED_ORIGINS = ['https://sun-scout.com', 'https://aslivastu.com', 'http://localhost:3001', 'http://localhost:3002'];

export default function PopupComplete() {
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    (async () => {
      const origin = new URLSearchParams(window.location.search).get('origin');
      if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        setMessage('Sign-in complete. You can close this window.');
        return;
      }
      if (!window.opener) {
        setMessage('Sign-in complete. You can close this window.');
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.opener.postMessage(
          { type: 'blindspot-popup-auth', access_token: session.access_token, refresh_token: session.refresh_token },
          origin
        );
        setMessage('Signed in — you can close this window.');
        setTimeout(() => window.close(), 600);
      } else {
        setMessage('Something went wrong. You can close this window and try again.');
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0B', color: '#9C9CA1', fontFamily: 'Inter,sans-serif', fontSize: 14 }}>
      {message}
    </div>
  );
}
