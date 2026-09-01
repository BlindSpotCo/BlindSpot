'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Only these origins are allowed to receive a session via postMessage from
// a popup -- prevents some unrelated site from opening a login popup and
// harvesting a session token back to itself.
//
// BlindSpot's own domains are in here too now, not just SunScout/
// AsliVastu's -- lib/auth/popupSignIn.js opens this same popup flow for
// same-domain sign-in (e.g. from the header, or a "Save report" button),
// so a person can sign in without the calling tab ever navigating away.
const ALLOWED_ORIGINS = ['https://sun-scout.com', 'https://aslivastu.com', 'https://blindspotco.net', 'https://www.blindspotco.net', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

// Same-domain BlindSpot origins specifically -- these can (and do) use
// BroadcastChannel below, which SunScout/AsliVastu (genuinely different
// domains) can't, since a broadcast channel only reaches tabs on the
// exact same origin.
const SAME_ORIGIN = ['https://blindspotco.net', 'https://www.blindspotco.net', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

export default function PopupComplete() {
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    (async () => {
      const origin = new URLSearchParams(window.location.search).get('origin');
      if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
        setMessage('Sign-in complete. You can close this window.');
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Something went wrong. You can close this window and try again.');
        return;
      }

      const payload = { type: 'blindspot-popup-auth', access_token: session.access_token, refresh_token: session.refresh_token };
      let delivered = false;

      // Primary path for BlindSpot's own domain: BroadcastChannel doesn't
      // need window.opener at all -- just a matching origin + channel
      // name. This is what actually fixes sign-in getting stuck: a
      // Google sign-in inside the popup routes through accounts.google.com,
      // and that hop severs window.opener in most browsers (a security
      // behavior on Google's end, not something this code can prevent) --
      // postMessage-to-opener silently has nothing to send to after that,
      // which is why the opening tab never picked up the session.
      if (SAME_ORIGIN.includes(origin) && typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('blindspot-auth');
          bc.postMessage(payload);
          bc.close();
          delivered = true;
        } catch {}
      }

      // Still try postMessage too -- required for the cross-origin
      // SunScout/AsliVastu case (BroadcastChannel can't reach a different
      // domain), and harmless as a second delivery path for the
      // same-origin case if window.opener does happen to still be alive.
      if (window.opener) {
        try {
          window.opener.postMessage(payload, '*');
          delivered = true;
        } catch {}
      }

      if (delivered) {
        setMessage('Signed in, you can close this window.');
        setTimeout(() => window.close(), 600);
      } else {
        setMessage('Signed in, but couldn\u2019t reach the original tab automatically, please close this window and refresh the other tab.');
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-mute)', fontFamily: 'Inter,sans-serif', fontSize: 14, textAlign: 'center', padding: 24 }}>
      {message}
    </div>
  );
}
