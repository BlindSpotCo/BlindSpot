'use client';
// components/TwoScores.js
// "The two scores, explained" -- sits at #products (the old hero-verdict
// section's anchor id, kept so the nav's "Tools" link still resolves to
// something on the page). Real weighted dimensions only: the
// Neighbourhood Score list is the actual weights_applied for PIN 110001
// (Connaught Place, Central Delhi, data/aslivastu/nqi_scores.json,
// scored_at 2026-07-28) -- same real record HowItWorks.js's AreaPanel
// used. The Home Comfort Score list is DEFAULT_WEIGHTS from
// lib/sunscout/scoring/types.js, unmodified. Both engines really do sum
// to 100%/1.0 -- not rounded for effect.

const NEIGHBOURHOOD_DIMENSIONS = [
  { label: 'Safety', weight: 25 },
  { label: 'Infrastructure', weight: 20 },
  { label: 'Air Quality', weight: 15 },
  { label: 'Schools', weight: 10 },
  { label: 'Power', weight: 10 },
  { label: 'Water Supply', weight: 8 },
  { label: 'Roads', weight: 7 },
  { label: 'Drainage & Sewerage', weight: 5 },
];

const COMFORT_DIMENSIONS = [
  { label: 'Sun', weight: 30 },
  { label: 'Shade & Heat', weight: 25 },
  { label: 'View', weight: 20 },
  { label: 'Privacy', weight: 15 },
  { label: 'Wind & Ventilation', weight: 10 },
];

function ScoreCard({ accentVar, tag, name, tagline, dims, source }) {
  return (
    <div className="ts2-card" style={{ '--ts2-accent': `var(${accentVar})` }}>
      <span className="mono ts2-tag">{tag}</span>
      <h3 className="ts2-name">{name}</h3>
      <p className="ts2-tagline">{tagline}</p>
      <div className="ts2-dims">
        {dims.map((d) => (
          <div key={d.label} className="ts2-dim">
            <div className="ts2-dim-top">
              <span className="ts2-dim-label">{d.label}</span>
              <span className="mono ts2-dim-weight">{d.weight}%</span>
            </div>
            <div className="ts2-dim-track">
              <div className="ts2-dim-fill" style={{ width: `${d.weight * 4}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="ts2-source">{source}</p>
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
          <p>Every dimension below is weighted and real, not a single opaque number.</p>
        </div>

        <div className="ts2-grid">
          <ScoreCard
            accentVar="--av"
            tag="ENGINE 1"
            name="Neighbourhood Score"
            tagline="Rates the area, from government records."
            dims={NEIGHBOURHOOD_DIMENSIONS}
            source="Police records, DDA/DMRC, CPCB live AQI, CBSE, DISCOM, Delhi Jal Board, PWD road & drainage surveys."
          />
          <ScoreCard
            accentVar="--ss"
            tag="ENGINE 2"
            name="Home Comfort Score"
            tagline="Rates the exact unit, from real solar geometry."
            dims={COMFORT_DIMENSIONS}
            source="Modelled from the floor and facing you pick, not a guess or a generic estimate for the building."
          />
        </div>

        <div className="ts2-combine reveal">
          <span className="mono ts2-combine-label">THEN COMBINED</span>
          <p>
            Both scores feed into one <strong>BlindSpot Score</strong>, starting weighted 50/50 &mdash; drag the
            slider on the flow if the neighbourhood matters more to you than the sunlight, or the other way
            round. The verdict tells you straight: Recommended, Recommended with Caution, or Not Recommended.
          </p>
        </div>
      </div>
    </section>
  );
}
