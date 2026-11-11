'use client';
// components/OurPromise.js
//
// Three promise cards between The Two Scores and the FAQ. A first-time
// visitor has no reason yet to believe a property score from a site they
// have never heard of, so this section says plainly what the score is
// NOT influenced by, where it comes from, and what to do when it is wrong.
//
// Every card has to be true on the live site today:
//  1. Scores can't be bought - there is no paid placement or
//     listing fee anywhere in the product; the FAQ already says
//     "Nothing comes from brokers or sellers".
//  2. Public records + sun geometry - same sources the FAQ and the
//     footer ("Government records + real solar geometry") describe.
//  3. Tell us - the footer feedback form already has a "Wrong data"
//     type that posts to /api/feedback. The button here opens that
//     form with "Wrong data" already picked (see FooterFeedback.js's
//     bs:feedback listener) instead of linking somewhere new.
//
// Do not add a card here for anything the site cannot show yet
// (testimonials, user counts, partner names).

const PROMISES = [
  {
    accent: 'brand',
    title: 'Scores can’t be bought',
    copy: 'Not by brokers, builders or sellers. Every flat is scored the same way.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
    ),
  },
  {
    accent: 'av',
    title: 'Built on public records',
    copy: 'The neighbourhood score uses government data. The flat score uses the sun’s real path and the buildings around the flat.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>
    ),
  },
  {
    accent: 'ss',
    title: 'Something wrong? Tell us',
    copy: 'If a score doesn’t match what you know about an area, send it to us and we’ll check it.',
    action: 'Report wrong data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M12 8v4"/><path d="M12 15.5h.01"/></svg>
    ),
  },
];

function openWrongDataForm() {
  window.dispatchEvent(new CustomEvent('bs:feedback', { detail: { kind: 'data' } }));
}

export default function OurPromise() {
  return (
    <section className="section section-tint reveal" id="our-promise">
      <div className="st-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">03 - Our Promise</span>
            <h2>A score you can <span className="gold-word">trust</span>.</h2>
          </div>
        </div>

        <div className="op-grid">
          {PROMISES.map((p) => (
            <div key={p.title} className={`op-card reveal accent-${p.accent}`}>
              <span className="op-badge">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.copy}</p>
              {p.action && (
                <button type="button" className="op-action" onClick={openWrongDataForm}>
                  {p.action} <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
