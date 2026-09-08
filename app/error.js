'use client';

// app/error.js
//
// The App Router needs an error boundary of its own. Without one, a runtime
// error anywhere in the tree has nowhere to land: in dev you get "missing
// required error components, refreshing..." and a reload loop, and in
// production the visitor gets a blank page with no way forward.
//
// A buyer who hits this is mid-decision on a house. Tell them what happened,
// give them the way back, and don't make them read a stack trace.

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Keep the detail in the console for us; the page stays plain for them.
    console.error('[blindspot] unhandled error:', error);
  }, [error]);

  return (
    <div className="bs-errpage">
      <h1>Something went wrong on our side.</h1>
      <p>
        This is a fault in BlindSpot, not in the address you searched. Trying again usually works —
        if it doesn&apos;t, start over from the home page and the report will rebuild from scratch.
      </p>
      <p className="bs-errpage-actions">
        <button type="button" onClick={reset}>Try again</button>
        <a href="/">Back to the start</a>
      </p>
      {error?.digest ? <p className="bs-errpage-ref">Reference: {error.digest}</p> : null}

      <style jsx>{`
        .bs-errpage {
          max-width: 44rem;
          margin: 0 auto;
          padding: 96px 24px;
          text-align: center;
          color: var(--text, #1c1812);
        }
        .bs-errpage h1 {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 12px;
          text-wrap: balance;
        }
        .bs-errpage p {
          margin: 0 auto;
          max-width: 52ch;
          font-size: 17px;
          line-height: 1.6;
          color: var(--text-mute, #5a5140);
        }
        .bs-errpage-actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          align-items: center;
          margin-top: 26px;
        }
        .bs-errpage-actions button {
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          min-height: 50px;
          padding: 14px 28px;
          border: 0;
          border-radius: 4px;
          background: var(--ss, #af5f30);
          color: #fffdf8;
        }
        .bs-errpage-actions button:hover { background: #95502a; }
        .bs-errpage-actions a {
          font-weight: 600;
          color: var(--ss, #af5f30);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .bs-errpage-ref {
          margin-top: 22px;
          font-size: 13.5px;
          color: var(--text-dim, #847c70);
        }
      `}</style>
    </div>
  );
}
