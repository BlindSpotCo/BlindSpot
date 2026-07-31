'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Where to land after signing in. Defaults to the homepage; if someone
  // got bounced here from a gated page (e.g. /my-reports), that page sets
  // ?next=... so we return them there instead.
  const getNextParam = () => {
    if (typeof window === 'undefined') return '/';
    return new URLSearchParams(window.location.search).get('next') || '/';
  };

  // True when this login page was opened as a popup (e.g. from the "Save
  // to BlindSpot" button on a SunScout report) rather than a normal page
  // visit. In that case we hand the session back via postMessage and
  // close the popup instead of redirecting anywhere.
  const isPopup = () => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('popup') === '1';
  };
  const getPopupOrigin = () => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('origin');
  };

  const finishPopup = (session) => {
    if (window.opener && session) {
      // '*' here, not the origin param: window.opener already uniquely
      // identifies the recipient, and a blob: URL report tab doesn't
      // reliably report a matchable origin, which silently drops the
      // message if we require an exact match.
      window.opener.postMessage(
        { type: 'blindspot-popup-auth', access_token: session.access_token, refresh_token: session.refresh_token },
        '*'
      );
    }
    window.close();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (isPopup()) {
      finishPopup(data.session);
      return;
    }
    const next = getNextParam();
    // If returning to a different domain (SunScout, AsliVastu), that site
    // can't see this domain's session cookie -- hand it the tokens
    // directly via the URL fragment, same as the OAuth path.
    if (next.startsWith('http') && data.session) {
      const url = new URL(next);
      url.hash = `access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}`;
      window.location.href = url.toString();
    } else {
      window.location.href = next;
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const supabase = createClient();
    // In popup mode, send the OAuth flow to /auth/popup-complete instead
    // of the normal next -- that page does the postMessage-and-close.
    const popupOrigin = getPopupOrigin();
    const nextTarget = isPopup() && popupOrigin
      ? `/auth/popup-complete?origin=${encodeURIComponent(popupOrigin)}`
      : getNextParam();
    const next = encodeURIComponent(nextTarget);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
      },
    });
    if (error) setError(error.message);
    // On success, Supabase redirects the browser to Google itself --
    // nothing more to do here.
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28 }}>
          <img src="/mark.png" alt="BlindSpot" style={{ height: 20 }} />
          <img src="/wordmark.png" alt="BlindSpot" style={{ height: 11 }} />
        </a>
        <h1>Sign in</h1>
        <p>Use the same email whether you&apos;re saving from SunScout or AsliVastu.</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="auth-submit"
          style={{ background: '#fff', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.97 10.72c-.18-.54-.28-1.12-.28-1.72s.1-1.18.28-1.72V4.94H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
          or
          <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" className="auth-submit" disabled={sending}>
            {sending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          <a href="/forgot-password">Forgot password?</a>
          <a href="/signup">Don&apos;t have an account? Sign up</a>
        </div>
      </div>
    </div>
  );
}
