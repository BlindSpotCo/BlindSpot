'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    const supabase = createClient();
    // Reuses the same /auth/callback route as everything else -- it
    // exchanges the code and sends the (now-authenticated) browser on to
    // /reset-password to actually set the new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
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
        <h1>Reset your password</h1>
        <p>Enter your email and we&apos;ll send you a link to set a new password.</p>

        {sent ? (
          <p className="auth-success">Check your inbox — we sent a password reset link to {email}.</p>
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
            {error && <p style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" className="auth-submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <a href="/login">Back to sign in</a>
        </div>
      </div>
    </div>
  );
}
