'use client';
// components/ProblemSolution.js
// V3 -- v2's icon grid used flat neutral chips and a run-on sentence at
// the bottom that read as another paragraph (plus a text-wrapping
// glitch around the second <strong>, fixed here with explicit {' '}
// instead of relying on same-line JSX whitespace). Each icon chip is now
// solid-colored in the engine that would actually catch that blindspot
// (--av = Neighbourhood Score, --ss = Home Comfort Score) -- both a
// visual upgrade and a real preview of which engine below finds each
// thing, not decoration. The closing line is now a compact equation
// (badge + badge = outcome) instead of a sentence.

const BLINDSPOTS = [
  {
    label: 'Sunlight hours',
    accent: 'ss',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
    ),
  },
  {
    label: 'Air quality',
    accent: 'av',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h11a3 3 0 1 0-2.4-4.8M3 16h14a3 3 0 1 1-2.4 4.8M3 12h17a3 3 0 1 0-2.4-4.8"/></svg>
    ),
  },
  {
    label: 'Crime nearby',
    accent: 'av',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
    ),
  },
  {
    label: 'Water supply',
    accent: 'av',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5s6.5 7.4 6.5 12a6.5 6.5 0 1 1-13 0c0-4.6 6.5-12 6.5-12z"/></svg>
    ),
  },
  {
    label: 'Power cuts',
    accent: 'av',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
    ),
  },
  {
    label: 'Blocked light',
    accent: 'ss',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h7V9l-3-4-3 4v8H3z"/><path d="M14 21h7V6l-3-4-3 4v11z"/></svg>
    ),
  },
];

export default function ProblemSolution() {
  return (
    <section className="section section-dark reveal">
      <div className="sd-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">01 - What Listings Leave Out</span>
            <h2>Every photo is real. Not every photo is the <span className="gold-word">whole story</span>.</h2>
          </div>
        </div>

        <div className="ps3-grid">
          {BLINDSPOTS.map((b) => (
            <div key={b.label} className={`ps3-item accent-${b.accent}`}>
              <span className="ps3-icon">{b.icon}</span>
              <span className="ps3-item-label">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="ps3-eq">
          <span className="ps3-eq-badge accent-av">Neighbourhood Score</span>
          <span className="ps3-eq-op">+</span>
          <span className="ps3-eq-badge accent-ss">Home Comfort Score</span>
          <span className="ps3-eq-op">=</span>
          <span className="ps3-eq-result">not a broker&apos;s word for it</span>
        </div>
      </div>
    </section>
  );
}
