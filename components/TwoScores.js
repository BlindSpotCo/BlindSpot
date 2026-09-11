'use client';
// components/TwoScores.js
// V6 -- the per-dimension chips used to be undecorated labels with no
// per-factor status, and the top readout was an animated ring + grade
// pill -- neither matched how the real report actually presents this
// (components/report/ReportScreen.js): a coloured rating WORD + "X out
// of 100 [· grade Y]" line, then each factor as its own row with a
// coloured Excellent/Good/Fair/Poor tag, not a plain chip. Rebuilt to
// match that shape using the SAME real records the 82/50 example has
// always used (see the V3 comment history): PIN 110001's raw factor
// scores from data/aslivastu/nqi_scores.json (crime 90, schools 100,
// air 75, water 100, power 94, roads 100, infrastructure 45, sewerage
// 100), and the real sun/shade/view/privacy sub-scores computeSolarSummary()
// produces for floor 5, South, at that same location (100 / 0 / 41 / 44) --
// from lib/sunscout/scoring/*.js, run directly against those real inputs,
// not invented. Each raw number is turned into a word/tone with the
// report's own thresholds (>=80 Excellent/good, >=60 Good/good, >=40
// Fair/avg, else Poor/poor). One exception: Wind needs a live Open-Meteo
// reading that can't be replayed after the fact, so its tag uses
// windScore.js's own documented "live data unavailable" fallback (score
// 50, Fair) -- real code, not a guess -- which is also exactly what
// makes the four known real sub-scores land on the same 50/Fair combined
// example already used elsewhere on this page. Dropped the ring: a plain
// word + number reads faster and is one less thing that doesn't exist
// in the real report.

const NEIGHBOURHOOD_DIMS = [
  { label: 'Safety', word: 'Excellent', tone: 'good' },
  { label: 'Infrastructure', word: 'Fair', tone: 'avg' },
  { label: 'Air Quality', word: 'Good', tone: 'good' },
  { label: 'Schools', word: 'Excellent', tone: 'good' },
  { label: 'Power', word: 'Excellent', tone: 'good' },
  { label: 'Water', word: 'Excellent', tone: 'good' },
  { label: 'Roads', word: 'Excellent', tone: 'good' },
  { label: 'Drainage', word: 'Excellent', tone: 'good' },
];
const COMFORT_DIMS = [
  { label: 'Sun', word: 'Excellent', tone: 'good' },
  { label: 'Shade & Heat', word: 'Poor', tone: 'poor' },
  { label: 'View', word: 'Fair', tone: 'avg' },
  { label: 'Privacy', word: 'Fair', tone: 'avg' },
  { label: 'Wind', word: 'Fair', tone: 'avg' },
];

function ScoreCard({ accentVar, tag, name, blurb, score, grade, word, tone, example, dims }) {
  return (
    <div className="ts4-card reveal" style={{ '--ts4-accent': `var(${accentVar})` }}>
      <span className="mono ts4-tag">{tag}</span>
      <h3 className="ts4-name">{name}</h3>
      <p className="ts4-blurb">{blurb}</p>

      <div className="ts4-rating">
        <span className={`ts4-word is-${tone}`}>{word}</span>
        <span className="ts4-outof">{score} out of 100{grade ? ` · grade ${grade}` : ''}</span>
      </div>
      <p className="ts4-example">{example}</p>

      <ul className="ts4-rows">
        {dims.map((d) => (
          <li key={d.label} className="ts4-row">
            <span className="ts4-row-label">{d.label}</span>
            <span className={`ts4-row-tag is-${d.tone}`}>{d.word}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TwoScores() {
  return (
    <section className="section section-tint reveal" id="products">
      <div className="st-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">02 - The Two Scores</span>
            <h2>What the neighbourhood does to a home, and what the home does to you. One <span className="gold-word">verdict</span>.</h2>
          </div>
        </div>

        {/* V5 -- added to close the gap between this section and the real
            report: this box is a faithful miniature of the actual opening
            moment on /report (see .bsr-answer in components/report/
            report.css) -- big number + "out of 100", a plain headline and
            a line of context, top-bordered by the same good/avg/poor tone
            colours the real page uses. The number and both lines of copy
            are not invented: 66 is the real 50/50 average of the two
            scores below it, and the headline + sub-line are exactly what
            ReportScreen.js's own headlineFor()/verdictSay() would print
            for an area score of 82 and a unit score of 50. */}
        <div className="ts4-verdict reveal">
          <div className="ts4-verdict-big">
            <span className="ts4-verdict-n">66</span>
            <span className="ts4-verdict-of">out of 100</span>
          </div>
          <div className="ts4-verdict-say">
            <p className="ts4-verdict-head">Worth a look, but go in with your eyes open.</p>
            <p className="ts4-verdict-sub">Good locality, but this specific flat is the weak half — light, outlook or airflow. Ask to see a higher floor or a different facing in the same tower before deciding.</p>
          </div>
        </div>

        <div className="ts4-grid">
          <ScoreCard
            accentVar="--av"
            tag="ENGINE 1 · GOVERNMENT RECORDS"
            name="Neighbourhood Score"
            blurb="Rates the area: crime, air, power, water, schools, roads — pulled from government records, not a broker's word for it."
            score={82}
            grade="A"
            word="Excellent"
            tone="good"
            example="Connaught Place, Central Delhi — real report"
            dims={NEIGHBOURHOOD_DIMS}
          />
          <ScoreCard
            accentVar="--ss"
            tag="ENGINE 2 · REAL SOLAR GEOMETRY"
            name="Home Comfort Score"
            blurb="Rates the exact unit: sun, shade & heat, view, privacy, wind — modelled from the floor and facing you pick."
            score={50}
            grade={null}
            word="Fair"
            tone="avg"
            example="Floor 5, South-facing — real report"
            dims={COMFORT_DIMS}
          />
        </div>

        <p className="ts3-combine">
          That verdict up top is these two, weighted 50/50 by default — pick whether the area or the flat matters more to you.
        </p>
      </div>
    </section>
  );
}
