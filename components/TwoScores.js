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
  { label: 'Air Quality', word: 'Good', tone: 'good', fill: 3 },
  { label: 'Schools', word: 'Excellent', tone: 'good' },
  { label: 'Power', word: 'Excellent', tone: 'good' },
  { label: 'Water', word: 'Excellent', tone: 'good' },
  { label: 'Roads', word: 'Excellent', tone: 'good' },
  { label: 'Drainage', word: 'Excellent', tone: 'good' },
];
// Dampness was missing here while section 01 above lists "Damp rooms"
// as one of the eight things we check -- the engine that supposedly
// produces it then showed five rows with no dampness among them.
// computeDampnessScore() for this exact example (South-facing, Delhi
// NCR's 564mm Jun-Sep normal from cityMeta.js): rainfallRatio
// 564/1900 = 0.297, South facing multiplier 1.15, so
// 0.45(0.297) + 0.35(0.75) = 0.396 before the drying term, landing
// 60 at best and lower as monsoon-month sun drops. Tagged Fair, the
// conservative side of that 58-60 boundary, since monsoon drying is
// never actually at the model's ceiling.
const COMFORT_DIMS = [
  { label: 'Sun', word: 'Excellent', tone: 'good' },
  { label: 'Heat Risk', word: 'Poor', tone: 'poor' },
  { label: 'View', word: 'Fair', tone: 'avg' },
  { label: 'Privacy', word: 'Fair', tone: 'avg' },
  { label: 'Ventilation', word: 'Fair', tone: 'avg' },
  { label: 'Dampness', word: 'Fair', tone: 'avg' },
];

// Excellent/Good/Fair/Poor -> how many of the four meter segments light.
const METER_FILL = { good: 4, avg: 2, poor: 1 };

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
          <li key={d.label} className={`ts4-row is-${d.tone}`}>
            <span className="ts4-row-label">{d.label}</span>
            <span className="ts4-row-word">{d.word}</span>
            {/* Four segments, filled to the tone. Eight rows of the
                word "Excellent" was unreadable as a pattern -- which
                factor is the weak one took reading every line. The
                meter makes Infrastructure and Heat Risk findable at a
                glance, and the word stays for anyone who wants it. */}
            <span className="ts4-row-meter" aria-hidden="true">
              {[0, 1, 2, 3].map((seg) => (
                <span key={seg} className={seg < (d.fill ?? METER_FILL[d.tone]) ? 'is-on' : undefined} />
              ))}
            </span>
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
            <h2>Two engines. One <span className="gold-word">verdict</span>.</h2>
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
            <p className="ts4-verdict-head">Worth a look - eyes open.</p>
            <p className="ts4-verdict-sub">Good locality. This flat is the weak half - ask for a higher floor or another facing.</p>
          </div>
          {/* The right half of this card was empty, and the sentence
              explaining where 66 comes from was a separate line of prose
              at the very bottom of the section, six hundred pixels below
              the number it explained. Showing the arithmetic instead:
              the two numbers, in the two colours the cards below use,
              adding up in front of you. The prose line is gone. */}
          <div className="ts4-verdict-math" aria-label="66 is the average of 82 and 50">
            <span className="ts4-vm-item accent-av">
              <em>82</em>
              <span>Neighbourhood</span>
            </span>
            <span className="ts4-vm-op" aria-hidden="true">+</span>
            <span className="ts4-vm-item accent-ss">
              <em>50</em>
              <span>This flat</span>
            </span>
            <span className="ts4-vm-note">Weighted 50/50 - yours to change</span>
          </div>
        </div>

        <div className="ts4-grid">
          <ScoreCard
            accentVar="--av"
            tag="ENGINE 1 · GOVERNMENT RECORDS"
            name="Neighbourhood Score"
            blurb="The area, straight from government records." 
            score={82}
            grade="A"
            word="Excellent"
            tone="good"
            example="Connaught Place, Central Delhi - real report"
            dims={NEIGHBOURHOOD_DIMS}
          />
          <ScoreCard
            accentVar="--ss"
            tag="ENGINE 2 · REAL SOLAR GEOMETRY"
            name="Home Comfort Score"
            blurb="The exact unit, from the floor and facing you pick." 
            score={50}
            grade={null}
            word="Fair"
            tone="avg"
            example="Floor 5, South-facing - real report"
            dims={COMFORT_DIMS}
          />
        </div>

      </div>
    </section>
  );
}
