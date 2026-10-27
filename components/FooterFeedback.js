'use client';
// components/FooterFeedback.js
//
// "Send us feedback" in the site footer. One short form: what kind of
// thing it is, the message, and an optional email for a reply. Works
// signed out. Posts to /api/feedback.

import { useState } from 'react';

const KINDS = [
  { key: 'bug', label: 'Something’s broken' },
  { key: 'idea', label: 'An idea' },
  { key: 'data', label: 'Wrong data' },
  { key: 'other', label: 'Other' },
];

const PLACEHOLDER = {
  bug: 'What happened, and on which page? e.g. “Save report did nothing on my phone.”',
  idea: 'What would make BlindSpot more useful to you?',
  data: 'Which address or area, and what’s wrong? e.g. “560066 says no metro, there’s one 500 m away.”',
  other: 'Anything you want us to know.',
};

export default function FooterFeedback() {
  const [kind, setKind] = useState('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

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
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="ff ff-sent" role="status">
        <p className="ff-title">Thanks, that’s sent.</p>
        <p className="ff-sub">The two of us read every message.{email ? ' We’ll reply by email if we need more.' : ''}</p>
        <button type="button" className="ff-again" onClick={() => setState('idle')}>Send another</button>
      </div>
    );
  }

  return (
    <form className="ff" onSubmit={send} aria-labelledby="ff-title">
      <p className="ff-title" id="ff-title">Send us feedback</p>
      <p className="ff-sub">Bugs, ideas, numbers that look wrong. We read every one.</p>

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

      <label className="ff-field">
        <span className="ff-label">Message</span>
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder={PLACEHOLDER[kind]}
          rows={3}
          maxLength={3000}
          required
        />
      </label>

      <label className="ff-field">
        <span className="ff-label">Email <span className="ff-opt">(optional, if you’d like a reply)</span></span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </label>

      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="ff-trap" />

      {state === 'error' && <p className="ff-error" role="alert">{error}</p>}

      <button type="submit" className="ff-send" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
