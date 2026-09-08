'use client';
// components/TwoScores.js
// V2 -- was two white cards with a full sentence + an 8-row list of thin
// progress bars, read as dense/text-heavy. Same real weighted data
// (weights_applied for PIN 110001 / DEFAULT_WEIGHTS, both unchanged, see
// the v1 comment history), now shown as a dark stat-grid card -- big bold
// weight numbers you can scan in a glance, not a paragraph you have to
// read.

const NEIGHBOURHOOD_DIMENSIONS = [
  { label: 'Safety', weight: 25 },
  { label: 'Infrastructure', weight: 20 },
  { label: 'Air Quality', weight: 15 },
  { label: 'Schools', weight: 10 },
  { label: 'Power', weight: 10 },
  { label: 'Water', weight: 8 },
  { label: 'Roads', weight: 7 },
  { label: 'Drainage', weight: 5 },
];

const COMFORT_DIMENSIONS = [
  { label: 'Sun', weight: 30 },
  { label: 'Shade & Heat', weight: 25 },
  { label: 'View', weight: 20 },
  { label: 'Privacy', weight: 15 },
  { label: 'Wind', weight: 10 },
];

function ScoreCard({ accentVar, tag, name, dims }) {
  return (
    <div className="ts3-card" style={{ '--ts3-accent': `var(${accentVar})` }}>
      <span className="mono ts3-tag">{tag}</span>
      <h3 className="ts3-name">{name}</h3>
      <div className="ts3-stat-grid">
        {dims.map((d) => (
          <div key={d.label} className="ts3-stat">
            <div className="ts3-stat-num">{d.weight}<span>%</span></div>
            <div className="ts3-stat-label">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TwoScores() {
  return (
    <section className="section reveal" id="products">
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">02 - The Two Scores</span>
            <h2>The area, and the exact flat. Rated separately, then combined.</h2>
          </div>
        </div>

        <div className="ts3-grid">
          <ScoreCard accentVar="--av" tag="ENGINE 1 · GOVERNMENT RECORDS" name="Neighbourhood Score" dims={NEIGHBOURHOOD_DIMENSIONS} />
          <ScoreCard accentVar="--ss" tag="ENGINE 2 · REAL SOLAR GEOMETRY" name="Home Comfort Score" dims={COMFORT_DIMENSIONS} />
        </div>

        <p className="ts3-combine">
          Combined 50/50 into one <strong>BlindSpot Score</strong> — drag the slider to change the balance.
        </p>
      </div>
    </section>
  );
}
