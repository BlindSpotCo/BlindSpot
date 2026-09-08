'use client';
// components/ProblemSolution.js
// First section after the hero -- the "why" before the "what". Names the
// real categories of thing a listing photo can't show (same real
// categories the hero's own typed-line cycles through -- see
// BLINDSPOT_EXAMPLES in HeroLiveMapCanvas.js -- kept consistent rather
// than inventing a second, different example list here) and states the
// fix in one line: two real scores, not a broker's word for it.

const BLINDSPOTS = [
  'Sunlight hours on your exact floor',
  'AQI on winter mornings',
  'Crime two streets over',
  'Water supply reliability',
  'How much light a north face loses',
  'Infrastructure vs. the city median',
  'Power cuts logged nearby',
  'What the building next door blocks',
];

export default function ProblemSolution() {
  return (
    <section className="section reveal">
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">01 - What Listings Leave Out</span>
            <h2>Every photo is real. Not every photo is the whole story.</h2>
          </div>
          <p>None of this is on the listing page. All of it changes whether you should buy.</p>
        </div>

        <div className="ps2-grid">
          <div className="ps2-problem">
            <span className="mono ps2-label">THINGS A LISTING WON&apos;T TELL YOU</span>
            <ul className="ps2-tags">
              {BLINDSPOTS.map((b) => (
                <li key={b} className="ps2-tag">{b}</li>
              ))}
            </ul>
          </div>

          <div className="ps2-solution">
            <span className="mono ps2-label ps2-label-solution">THE FIX</span>
            <p className="ps2-solution-lead">
              BlindSpot checks both sides before you sign anything: <strong>Neighbourhood Score</strong> rates
              the area from government records, <strong>Home Comfort Score</strong> rates the exact unit from
              real solar geometry. Not a broker&apos;s word for it, a number you can trace back to its source.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
