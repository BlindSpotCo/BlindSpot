'use client';
// components/auth/SignInSheet.js
//
// Sign-in, in place, as a sheet over whatever page you're on. Replaces the
// popup window (lib/auth/popupSignIn.js, removed).
//
// The popup was there so the page underneath -- a generated report, a
// floor/facing you'd set -- survived signing in. It didn't, reliably:
//  - On a phone a popup is just a second tab, and after sign-in it was left
//    open saying "you can close this window". The "extra tab".
//  - Google's sign-in page cuts the popup's link back to the page that
//    opened it, which made `popup.closed` read true half a second in. The
//    opener took that as "you closed it", gave up, and sent ITS OWN tab to
//    /login too -- so a Google sign-in from the header ended with two tabs
//    and the page you were on gone.
//
// Now:
//  - Email + password signs in right here. No navigation at all.
//  - Google needs a real page visit, so it goes in the same tab and comes
//    back to this exact URL. A report waiting to be saved is held in
//    IndexedDB across the trip (lib/auth/pendingSave.js) and saved on the
//    way back (components/auth/PendingSaveResume.js).

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { stashPendingSave } from '@/lib/auth/pendingSave';

function hereUrl() {
  const { pathname, search, hash } = window.location;
  // Never come back to the auth pages themselves.
  if (/^\/(login|signup|forgot-password|reset-password|auth)\b/.test(pathname)) return '/';
  return `${pathname}${search}${hash}`;
}

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.71-1.57 2.68-3.88 2.68-6.64z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z"/><path fill="#FBBC05" d="M3.97 10.72c-.18-.54-.28-1.12-.28-1.72s.1-1.18.28-1.72V4.94H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
);

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} [props.onSignedIn]  called after an in-place (email) sign-in
 * @param {string} [props.heading]
 * @param {string} [props.blurb]
 * @param {{source:string, data:any, title?:string}} [props.pendingSave]
 *   a report to save once signed in, if sign-in has to leave the page
 */
export default function SignInSheet({ open, onClose, onSignedIn, heading = 'Sign in', blurb, pendingSave }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling while the sheet is up (phones
    // otherwise scroll the report underneath when you drag inside it).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  // Hold the report (if any) before leaving the page. If it can't be held,
  // say so instead of losing it on the way.
  const holdPending = async () => {
    if (!pendingSave) return true;
    try {
      await stashPendingSave(pendingSave);
      return true;
    } catch {
      setError('This report is too big to carry through that sign-in. Sign in with email and password above instead - that keeps it on screen.');
      return false;
    }
  };

  const signInWithEmail = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setPassword('');
    onSignedIn?.();
    onClose?.();
  };

  const signInWithGoogle = async () => {
    setError('');
    if (!(await holdPending())) return;
    setLeaving(true);
    const next = encodeURIComponent(hereUrl());
    // Where to come back to. Carried in a cookie, not on redirectTo: a
    // plain /auth/callback is the URL most likely to match Supabase's
    // allowed-redirect list exactly, and when one doesn't match, Supabase
    // silently falls back to the Site URL and the page you came from was
    // lost. Read by /auth/callback (and proxy.js for that fallback).
    document.cookie = `bs_auth_next=${next}; path=/; max-age=1800; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`;
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setLeaving(false); setError(err.message); }
  };

  const goTo = async (path) => {
    if (!(await holdPending())) return;
    window.location.href = `${path}?next=${encodeURIComponent(hereUrl())}`;
  };

  return createPortal(
    <>
      <div className="sis-backdrop" onClick={onClose} />
      <div className="sis-panel" role="dialog" aria-modal="true" aria-labelledby="sis-title">
        <div className="sis-head">
          <h2 id="sis-title">{heading}</h2>
          <button type="button" className="sis-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {blurb ? <p className="sis-blurb">{blurb}</p> : null}

        <button type="button" className="sis-google" onClick={signInWithGoogle} disabled={leaving || busy}>
          {GOOGLE_ICON}
          {leaving ? 'Taking you to Google…' : 'Continue with Google'}
        </button>

        <div className="sis-or"><span />or<span /></div>

        <form onSubmit={signInWithEmail}>
          <div className="auth-field">
            <label htmlFor="sis-email">Email</label>
            <input
              id="sis-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="sis-password">Password</label>
            <input
              id="sis-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="auth-submit" disabled={busy || leaving}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="sis-links">
          <a href="/forgot-password" onClick={(e) => { e.preventDefault(); goTo('/forgot-password'); }}>Forgot password?</a>
          <a href="/signup" onClick={(e) => { e.preventDefault(); goTo('/signup'); }}>No account? Sign up</a>
        </div>
      </div>
    </>,
    document.body
  );
}
