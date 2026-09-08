'use client';
// components/TwoScores.js
// V4 -- the score used to be a bare number (".ts4-score"), which read
// as more of the same text-heavy page. Replaced it with an animated SVG
// ring that fills to the real score and a count-up from 0, so the two
// numbers that matter most on the page (82, 50) are the one genuinely
// visual, animated moment in this section instead of another line of
// text. Same real numbers as v3 -- nothing invented, just presented
// as a chart instead of a label.

import { useEffect, useRef, useState } from 'react';

const NEIGHBOURHOOD_DIMS = ['Safety', 'Infrastructure', 'Air Quality', 'Schools', 'Power', 'Water', 'Roads', 'Drainage'];
const COMFORT_DIMS = ['Sun', 'Shade & Heat', 'View', 'Privacy', 'Wind'];

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

function ScoreRing({ score }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [count, setCount] = useState(0);

  // Own IntersectionObserver rather than reusing the page-level .reveal
  // one below -- this needs to *know* when it's visible (to start the
  // count-up loop and flip the ring's real dashoffset), not just get a
  // class added to it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { setInView(true); return undefined; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setInView(true); io.unobserve(el); }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(score);
      return undefined;
    }
    const duration = 1200;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setCount(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, score]);

  const offset = RING_C * (1 - (inView ? score : 0) / 100);

  return (
    <div className="ts4-ring-wrap" ref={ref}>
      <svg className="ts4-ring" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
        <circle className="ts4-ring-track" cx="48" cy="48" r={RING_R} />
        <circle
          className="ts4-ring-fill"
          cx="48" cy="48" r={RING_R}
          style={{ strokeDasharray: RING_C, strokeDashoffset: offset }}
        />
      </svg>
      <div className="ts4-ring-center">
        <span className="ts4-ring-num">{count}</span>
        <span className="ts4-ring-max">/100</span>
      </div>
    </div>
  );
}

function ScoreCard({ accentVar, tag, name, blurb, score, grade, example, dims }) {
  return (
    <div className="ts4-card reveal" style={{ '--ts4-accent': `var(${accentVar})` }}>
      <span className="mono ts4-tag">{tag}</span>
      <h3 className="ts4-name">{name}</h3>
      <p className="ts4-blurb">{blurb}</p>

      <div className="ts4-readout">
        <ScoreRing score={score} />
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
    <section className="section section-tint reveal" id="products">
      <div className="st-grain" aria-hidden="true" />
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
