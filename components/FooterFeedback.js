'use client';
// components/FooterFeedback.js
//
// "Send us feedback" in the site footer. One short form: what kind of
// thing it is, the message, and an optional email for a reply. Works
// signed out. Posts to /api/feedback.

import { useState } from 'react';

const KINDS = [
  { key: 'bug', label: 'Bug' },
  { key: 'idea', label: 'Idea' },
  { key: 'data', label: 'Wrong data' },
  { key: 'other', label: 'Other' },
];

const PLACEHOLDER = {
  bug: 'What broke, and on which page?',
  idea: 'What would make it more useful?',
  data: 'Which address, and what’s wrong?',
  other: 'Anything you want us to know.',
};

export default function FooterFeedback() {
  const [kind, setKind] = useState('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  // Collapsed to one line until someone clicks in; then the type chips and
  // the email box slide in.
  const [open, setOpen] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (message.trim().length < 3) { setError('Write a few words first.'); setState('error'); return; }
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, email, website: trap, page: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Couldn’t send that just now. Try again in a minute.');
      setState('sent');
      setMessage('');
      setOpen(false);
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="ff ff-sent" role="status">
        <span className="footer-col-title">Feedback</span>
        <p className="ff-done">Thanks, that’s sent.{email ? ' We’ll reply by email if we need more.' : ''}{' '}
          <button type="button" className="ff-again" onClick={() => setState('idle')}>Send another</button>
        </p>
      </div>
    );
  }

  return (
    <form className={`ff${open ? ' is-open' : ''}`} onSubmit={send} aria-labelledby="ff-title">
      <span className="footer-col-title" id="ff-title">Feedback</span>

      {open && (
        <div className="ff-kinds" role="radiogroup" aria-label="What kind of feedback">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              className={`ff-kind${kind === k.key ? ' is-on' : ''}`}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="ff-row">
        <textarea
          aria-label="Your feedback"
          value={message}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setMessage(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder={open ? PLACEHOLDER[kind] : 'Bug, idea, wrong number?'}
          rows={open ? 2 : 1}
          maxLength={3000}
          required
        />
        <button type="submit" className="ff-send" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>

      {open && (
        <input type="email" aria-label="Email (optional, for a reply)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email for a reply (optional)" autoComplete="email" />
      )}

      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="ff-trap" />

      {state === 'error' && <p className="ff-error" role="alert">{error}</p>}
    </form>
  );
}
