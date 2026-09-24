'use client';
// components/shared/FieldFeedback.js
//
// The "report this" affordance from docs/data-integrity-architecture.md's
// L5 ("Local-expert feedback as a first-class input"): a small, per-field
// trigger next to any stat in AVDetailedReadout, not a generic contact
// form. Captures exactly what the doc specifies -- field, pin, the value
// we're currently showing, the person's asserted correction, and an
// optional note -- and posts it to /api/field-feedback.
//
// Deliberately usable signed-out: the doc's whole point is that a local
// expert (the Delhi investor who spotted the Cantonment/metro errors) is
// "the most scalable verification instrument available" and today has no
// way to tell us anything. Gating that behind a sign-in wall would lose
// most of them before they ever submit.
//
// Renders as an inline expand-in-place row, not a modal, so it doesn't
// interrupt someone scanning the rest of the readout.

import { useState } from 'react';

export default function FieldFeedback({ pinCode, city, fieldName, fieldLabel, currentValue }) {
  const [open, setOpen] = useState(false);
  const [claimed, setClaimed] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  async function submit(e) {
    e.preventDefault();
    if (!claimed.trim() && !note.trim()) return;
    setState('sending');
    try {
      const res = await fetch('/api/field-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_code: pinCode,
          city,
          field_name: fieldName,
          field_label: fieldLabel,
          reported_value: currentValue == null ? null : String(currentValue),
          claimed_value: claimed.trim() || null,
          note: note.trim() || null,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      });
      if (!res.ok) throw new Error('request failed');
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <span style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 6, fontStyle: 'italic' }}>
        Thanks - flagged for review.
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Report an issue with ${fieldLabel}`}
        style={{
          font: 'inherit', fontSize: 10, fontWeight: 700, letterSpacing: '.03em',
          color: 'var(--text-dim)', background: 'none', border: '1px solid var(--line-soft)',
          borderRadius: 999, padding: '1px 7px', cursor: 'pointer', lineHeight: 1.6,
        }}
      >
        report
      </button>

      {open && (
        <form
          onSubmit={submit}
          style={{
            position: 'relative', marginTop: 8, padding: 12, width: 240,
            background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 6,
            display: 'grid', gap: 8, zIndex: 5,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Does <strong style={{ color: 'var(--text)' }}>{fieldLabel}</strong> look wrong for this pin?
            {currentValue != null && <> Currently shown: <strong>{String(currentValue)}</strong>.</>}
          </div>
          <input
            type="text"
            value={claimed}
            onChange={(e) => setClaimed(e.target.value)}
            placeholder="What should it be? (optional)"
            style={{ font: 'inherit', fontSize: 12, padding: '6px 8px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else? Source, link, local knowledge..."
            rows={2}
            style={{ font: 'inherit', fontSize: 12, padding: '6px 8px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ font: 'inherit', fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={state === 'sending' || (!claimed.trim() && !note.trim())}
              style={{ font: 'inherit', fontSize: 11, fontWeight: 700, color: 'var(--paper)', background: 'var(--ink)', border: 'none', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', opacity: state === 'sending' ? 0.6 : 1 }}
            >
              {state === 'sending' ? 'Sending…' : 'Submit'}
            </button>
          </div>
          {state === 'error' && (
            <div style={{ fontSize: 10.5, color: '#b33' }}>Couldn&apos;t send that - try again in a moment.</div>
          )}
        </form>
      )}
    </span>
  );
}
