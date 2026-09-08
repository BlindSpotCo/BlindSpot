'use client';
// components/TwoScores.js
// V3 -- v2 showed only the per-dimension weight numbers, which isn't
// the part that matters to a visitor deciding whether to bother
// searching their address. Replaced the weight grid with what each
// engine actually produces: a real example score (same real records
// HowItWorks.js used -- PIN 110001 / Connaught Place, nqi_composite 82,
// grade A, from data/aslivastu/nqi_scores.json; and the real
// computeLiveScore() output for floor 5/South, liveScore 50, grade
// Fair -- both unchanged real numbers, not invented for this card),
// plus what it measures (in words, not percentages) and where the data
// comes from.

const NEIGHBOURHOOD_DIMS = ['Safety', 'Infrastructure', 'Air Quality', 'Schools', 'Power', 'Water', 'Roads', 'Drainage'];
const COMFORT_DIMS = ['Sun', 'Shade & Heat', 'View', 'Privacy', 'Wind'];

function ScoreCard({ accentVar, tag, name, blurb, score, grade, example, dims }) {
  return (
    <div className="ts4-card" style={{ '--ts4-accent': `var(${accentVar})` }}>
      <span className="mono ts4-tag">{tag}</span>
      <h3 className="ts4-name">{name}</h3>
      <p className="ts4-blurb">{blurb}</p>

      <div className="ts4-readout">
        <div className="ts4-score">{score}<span>/100</span></div>
        <span className="ts4-grade">{grade}</span>
      </div>
      <p className="ts4-example">{example}</p>

      <div className="ts4-dims">
        {dims.map((d) => (
          <span key={d} className="ts4-dim">{d}</span>
        ))}
      </div>
    </div>
  );
}

export default function TwoScores() {
  return (
    <section className="section section-dark reveal" id="products">
      <div className="sd-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">02 - The Two Scores</span>
            <h2>The area, and the exact flat. Rated separately, then <span className="gold-word">combined</span>.</h2>
          </div>
        </div>

        <div className="ts4-grid">
          <ScoreCard
            accentVar="--av"
            tag="ENGINE 1 · GOVERNMENT RECORDS"
            name="Neighbourhood Score"
            blurb="Rates the area: crime, air, power, water, schools, roads — pulled from government records, not a broker's word for it."
            score={82}
            grade="Grade A"
            example="Connaught Place, Central Delhi — real report"
            dims={NEIGHBOURHOOD_DIMS}
          />
          <ScoreCard
            accentVar="--ss"
            tag="ENGINE 2 · REAL SOLAR GEOMETRY"
            name="Home Comfort Score"
            blurb="Rates the exact unit: sun, shade & heat, view, privacy, wind — modelled from the floor and facing you pick."
            score={50}
            grade="Fair"
            example="Floor 5, South-facing — real report"
            dims={COMFORT_DIMS}
          />
        </div>

        <p className="ts3-combine">
          Combined 50/50 into one <strong>BlindSpot Score</strong> — drag the slider to change the balance.
        </p>
      </div>
    </section>
  );
}
