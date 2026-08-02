'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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
    // By the time someone reaches this page, /auth/callback has already
    // exchanged the reset link's code for a valid (recovery) session, so
    // this just updates the password on that already-authenticated user.
    const { error } = await supabase.auth.updateUser({ password });
    setSending(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 28 }}>
          <img src="/mark.png" alt="BlindSpot" style={{ height: 20 }} />
          <img src="/wordmark.png" alt="BlindSpot" style={{ height: 11 }} />
        </a>
        <h1>Set a new password</h1>

        {done ? (
          <>
            <p className="auth-success">Your password has been updated.</p>
            <div className="auth-links" style={{ marginTop: 20 }}>
              <a href="/">Go to homepage</a>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="password">New password</label>
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
              <label htmlFor="confirmPassword">Confirm new password</label>
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
              {sending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
