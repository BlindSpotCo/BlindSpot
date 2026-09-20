// components/ProblemSolution.js
//
// V5 -- the tab strip is gone. It only ever showed one of the six
// blindspots at a time, which meant the scale of what a listing leaves
// out (the actual point of this section) was never on screen at once:
// you had to click through six panels to learn there were six. Worse,
// it hid the thing that makes the product legible -- that these fall
// into exactly two groups, one scored for your specific flat and one
// scored for the pincode around it, which is precisely the two scores
// the rest of the page sells.
//
// So: two columns, four rows each, everything visible, no state. The
// grouping does the work the closing equation badge-row used to do --
// each column is headed by its own score, so "Neighbourhood Score +
// Home Comfort Score" is read off the layout rather than asserted
// underneath it.
//
// Earlier rounds rejected a boxed icon-tile grid and a 3x2 spec grid,
// and this is neither: the row is a line of a ledger (icon, what it is,
// what it answers, where the number comes from), not a tile, and the
// two ledgers are the two halves of the report itself.
//
// Every `source` line below is a claim about real data and has to stay
// that way -- they match what FAQSection.js states (CPCB live AQI,
// police records, DISCOM data, municipal water surveys, solar-geometry
// modelling) and what lib/sunscout/scoring actually computes (sun,
// heat + the AC cost estimate, dampness from monsoon climate and
// orientation). Don't add a row here without a scorer behind it.

const SUN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
);

const GROUPS = [
  {
    key: 'ss',
    score: 'Home Comfort Score',
    scope: 'For the exact floor and facing you pick',
    source: 'Solar-geometry modelling',
    items: [
      {
        label: 'Sunlight hours',
        desc: 'Real hours, not "well-lit".',
        icon: SUN_ICON,
      },
      {
        label: 'Blocked light',
        desc: 'What the next tower takes.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h7V9l-3-4-3 4v8H3z"/><path d="M14 21h7V6l-3-4-3 4v11z"/></svg>
        ),
      },
      {
        label: 'Summer heat',
        desc: 'The AC bill this facing earns.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14.8V4.5a2 2 0 1 1 4 0v10.3a4 4 0 1 1-4 0z"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>
        ),
      },
      {
        label: 'Damp rooms',
        desc: 'Corners that never dry after monsoon.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3" width="17" height="13" rx="1.4"/><path d="M12 3v13M3.5 9.5h17"/><path d="M7.4 21c-.9 0-1.6-.7-1.6-1.6 0-.8 1.6-2.6 1.6-2.6s1.6 1.8 1.6 2.6c0 .9-.7 1.6-1.6 1.6zM16.6 21c-.9 0-1.6-.7-1.6-1.6 0-.8 1.6-2.6 1.6-2.6s1.6 1.8 1.6 2.6c0 .9-.7 1.6-1.6 1.6z"/></svg>
        ),
      },
    ],
  },
  {
    key: 'av',
    score: 'Neighbourhood Score',
    scope: 'From government records for that pincode',
    source: 'CPCB · Police · DISCOM · Municipal surveys',
    items: [
      {
        label: 'Air quality',
        desc: 'What you breathe on the balcony.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h11a3 3 0 1 0-2.4-4.8M3 16h14a3 3 0 1 1-2.4 4.8M3 12h17a3 3 0 1 0-2.4-4.8"/></svg>
        ),
      },
      {
        label: 'Crime nearby',
        desc: 'The record, not word of mouth.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
        ),
      },
      {
        label: 'Water supply',
        desc: 'Tankers by April, or not.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5s6.5 7.4 6.5 12a6.5 6.5 0 1 1-13 0c0-4.6 6.5-12 6.5-12z"/></svg>
        ),
      },
      {
        label: 'Power cuts',
        desc: 'How often the lift stops.',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
        ),
      },
    ],
  },
];

export default function ProblemSolution() {
  return (
    <section className="section section-tint reveal">
      <div className="st-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">01 - What Listings Leave Out</span>
            <h2>Every photo is real. Not every photo is the <span className="gold-word">whole story</span>.</h2>
          </div>
        </div>

        <div className="ps4-grid">
          {GROUPS.map((g) => (
            <div key={g.key} className={`ps4-col accent-${g.key}`}>
              <div className="ps4-col-head">
                <span className="ps4-col-badge">{g.score}</span>
                <p className="ps4-col-scope">{g.scope}</p>
                {/* The eight per-row source lines this replaces were a
                    whole second layer of text down the card. The claim
                    is the same -- these are records, not opinions --
                    said once per column instead of once per row. */}
                <p className="ps4-col-source">{g.source}</p>
              </div>

              <ul className="ps4-list">
                {g.items.map((b) => (
                  <li className="ps4-row" key={b.label}>
                    <span className="ps4-row-icon" aria-hidden="true">{b.icon}</span>
                    <span className="ps4-row-body">
                      <span className="ps4-row-label">{b.label}</span>
                      <span className="ps4-row-desc">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="ps4-foot">
          Two scores. Eight answers. <strong>No broker&apos;s word in any of them.</strong>
        </p>
      </div>
    </section>
  );
}
