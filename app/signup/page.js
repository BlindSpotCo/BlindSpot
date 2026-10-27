'use client';
import Link from 'next/link';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don\u2019t match.');
      return;
    }

    setSending(true);
    const supabase = createClient();
    // ?next= (set by the sign-in sheet) brings the confirmation link back to
    // the page they signed up from. Same-site paths only: anything else is
    // dropped, so this can't be used to bounce people to another domain.
    const rawNext = new URLSearchParams(window.location.search).get('next') || '';
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\') ? rawNext : '';
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`,
      },
    });
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28 }}>
          <img src="/mark.png" alt="BlindSpot" style={{ height: 20 }} />
          <img src="/wordmark.png" alt="BlindSpot" className="auth-wordmark" style={{ height: 11 }} />
        </Link>
        <h1>Create an account</h1>
        <p>Use the same email whether you&apos;re saving from Home Comfort Score or Neighbourhood Score.</p>

        {sent ? (
          <p className="auth-success">Check your inbox, we sent a confirmation link to {email}. Click it to finish creating your account.</p>
        ) : (
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={sending}>
              {sending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="auth-legal">
          By creating an account you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.
        </p>

        <div className="auth-links">
          <a href="/login">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  );
}
