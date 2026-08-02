'use client';

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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28 }}>
          <img src="/mark.png" alt="BlindSpot" style={{ height: 20 }} />
          <img src="/wordmark.png" alt="BlindSpot" style={{ height: 11 }} />
        </a>
        <h1>Create an account</h1>
        <p>Use the same email whether you&apos;re saving from SunScout or AsliVastu.</p>

        {sent ? (
          <p className="auth-success">Check your inbox — we sent a confirmation link to {email}. Click it to finish creating your account.</p>
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
            {error && <p style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" className="auth-submit" disabled={sending}>
              {sending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <a href="/login">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  );
}
