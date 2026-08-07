'use client';
// components/HowItWorks.js
// "How it works" explainer — sits right after the hero, before the two
// product cards. Walks through the real 3-step flow (area -> unit ->
// verdict) that the actual CombinedScoreFlow tool runs, using the same
// visual language (locality rows, grade badges, floor/facing picker,
// combined-score card) so this reads as a preview of the real product
// rather than an abstract illustration. No live data/API calls here —
// this is the static main-branch explainer; the interactive version lives
// in CombinedScoreFlow on the product branch.

import { useState, useEffect, useRef, useCallback } from 'react';

const STEPS = [
  {
    id: 'area',
    tabLabel: '1. Pick your area',
    eyebrow: 'STEP 1 — AREA',
    accent: 'slate',
    heading: 'Search a locality, see the score before you see the flat.',
    copy: "AsliVastu scores every locality 0–100 across crime, air quality, power, water, schools and infrastructure — pulled from government records, not what a broker tells you. Type an area name, get the number in seconds.",
    bullets: [
      'Searchable by name, not just pincode',
      '8 weighted dimensions, one composite score',
      'Nearby-locality comparison built in',
    ],
  },
  {
    id: 'unit',
    tabLabel: '2. Check the unit',
    eyebrow: 'STEP 2 — UNIT',
    accent: 'sun',
    heading: 'Then check the specific flat — floor, facing, and how much sun it actually gets.',
    copy: "The area score is the same for every flat on the block. This step is what makes it personal: pick a floor and facing, and SunScout's real solar geometry returns a Home Comfort Score for that exact unit.",
    bullets: [
      'Real sun-path modelling, not a guess',
      'Floor + facing change the number',
      'Home Comfort Score: sun, shade and ventilation combined',
    ],
  },
  {
    id: 'verdict',
    tabLabel: '3. Get your verdict',
    eyebrow: 'STEP 3 — VERDICT',
    accent: 'combo',
    heading: 'One weighted score, one plain-English answer.',
    copy: 'Area and unit combine into a single BlindSpot Score, starting 50/50 — drag the slider if the neighbourhood matters more to you than the sunlight, or the other way round. The verdict tells you straight: recommended, recommended with caution, or not recommended.',
    bullets: [
      'You control the area/unit weighting',
      'Clear recommended / caution / not-recommended verdict',
      'Full breakdown, not just a number',
    ],
  },
];

const SAMPLE_LOCALITIES = [
  { name: 'Koramangala 5th Block', meta: 'Bengaluru · 560095', score: 78, grade: 'B+', selected: true },
  { name: 'Whitefield', meta: 'Bengaluru · 560066', score: 71, grade: 'B', selected: false },
  { name: 'Indiranagar', meta: 'Bengaluru · 560038', score: 84, grade: 'A-', selected: false },
];

const SAMPLE_FACTORS = [
  { label: 'Crime', score: 81 },
  { label: 'Air Quality', score: 64 },
  { label: 'Power', score: 88 },
  { label: 'Schools', score: 76 },
];

const FACING_OPTS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

function GradeBadge({ grade, color }) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-block', fontSize: 11, fontWeight: 500, letterSpacing: '.08em',
        textTransform: 'uppercase', border: `1px solid ${color}`, color, padding: '4px 10px', borderRadius: 3,
      }}
    >
      {grade}
    </span>
  );
}

function FactorBar({ label, score }) {
  const color = score >= 75 ? '#4ADE80' : score >= 50 ? 'var(--slate)' : '#f87171';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-mute)', marginBottom: 4 }}>
        <span>{label}</span><span className="mono" style={{ color: 'var(--text)' }}>{score}</span>
      </div>
      <div style={{ background: 'var(--line-soft)', height: 4, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function AreaPanel() {
  const selected = SAMPLE_LOCALITIES.find((l) => l.selected);
  return (
    <div className="howworks-panel">
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 14 }}>
        SEARCH — &ldquo;koramangala&rdquo;
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid var(--line)', borderRadius: 3, marginBottom: 22 }}>
        {SAMPLE_LOCALITIES.map((l) => (
          <div
            key={l.name}
            className="hw-box"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '11px 14px', borderBottom: '1px solid var(--line-soft)', borderRadius: 4,
              background: l.selected ? 'rgba(30,92,71,0.10)' : 'transparent',
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>{l.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{l.meta}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--slate)' }}>{l.score}</span>
              <GradeBadge grade={l.grade} color="var(--slate)" />
            </div>
          </div>
        ))}
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 10 }}>
        {selected.name.toUpperCase()} — FACTOR BREAKDOWN
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '4px 20px' }}>
        {SAMPLE_FACTORS.map((f) => (
          <FactorBar key={f.label} label={f.label} score={f.score} />
        ))}
      </div>
    </div>
  );
}

function UnitPanel() {
  return (
    <div className="howworks-panel">
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', marginBottom: 14 }}>
        7TH FLOOR · SOUTH-EAST FACING
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', flexShrink: 0 }}>Floor</span>
        <div style={{ flex: 1, height: 4, borderRadius: 3, background: 'var(--line-soft)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '23%', background: 'var(--sun)', borderRadius: 3 }} />
        </div>
        <div className="hw-pulse" style={{ background: 'var(--sun)', color: '#fff', borderRadius: 4, padding: '4px 12px', fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>7</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, marginBottom: 22 }}>
        {FACING_OPTS.map((dir) => (
          <div
            key={dir}
            className={`hw-box${dir === 'South-East' ? ' hw-pulse' : ''}`}
            style={{
              background: dir === 'South-East' ? 'var(--sun)' : 'transparent',
              color: dir === 'South-East' ? '#fff' : 'var(--text-mute)',
              border: `1px solid ${dir === 'South-East' ? 'var(--sun)' : 'var(--line)'}`,
              padding: '8px 4px', fontSize: 10.5, fontWeight: 700, textAlign: 'center',
              marginLeft: -1, marginTop: -1, cursor: 'default',
            }}
          >
            {dir}
          </div>
        ))}
      </div>
      <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '16px 18px' }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>HOME COMFORT SCORE</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 34, color: 'var(--sun)' }}>82</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>/100</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-mute)', marginTop: 6, lineHeight: 1.6 }}>
          Strong morning light, minimal shadow before 3pm, good cross-ventilation for this facing.
        </div>
      </div>
    </div>
  );
}

function VerdictPanel() {
  return (
    <div className="howworks-panel">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 8 }}>
          <span className="mono" style={{ color: 'var(--slate)' }}>AREA 50%</span>
          <span className="mono" style={{ color: 'var(--sun)' }}>UNIT 50%</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: 'linear-gradient(90deg, var(--slate) 50%, var(--sun) 50%)' }} />
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
          Starts 50/50 — drag anytime to change how much the neighbourhood matters vs. the specific flat.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 6 }}>BLINDSPOT COMBINED SCORE</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 46, lineHeight: 1, color: 'var(--text)' }}>
            80<span style={{ fontSize: 18, color: 'var(--text-dim)' }}>/100</span>
          </div>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', background: 'linear-gradient(90deg, var(--sun), var(--slate))', padding: '8px 16px', borderRadius: 3 }}>
          Recommended
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 20 }}>
        Solid area score with a genuinely bright unit — good light most of the year, no major shadow issues at this floor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>AREA — KORAMANGALA — 50%</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--slate)' }}>78</div>
        </div>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT — FL 7, SE — 50%</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--sun)' }}>82</div>
        </div>
      </div>
    </div>
  );
}

const PANELS = { area: AreaPanel, unit: UnitPanel, verdict: VerdictPanel };

export default function HowItWorks() {
  const [active, setActive] = useState('area');
  const Panel = PANELS[active];
  const stepRefs = useRef({});
  const tickingRef = useRef(false);

  // Scroll-driven step switching (desktop only — see the matching
  // max-width:900px rule in globals.css that turns the sticky panel back
  // into normal flow, at which point this tracking isn't meaningful).
  // On every scroll frame, find whichever step block's vertical centre is
  // closest to the viewport's vertical centre and make that the active
  // step. No scroll-jacking — native scroll speed/position is untouched,
  // this only reads position and swaps which panel is shown.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)');

    const updateActive = () => {
      tickingRef.current = false;
      if (!mq.matches) return;
      const viewportCenter = window.innerHeight / 2;
      let closestId = null;
      let closestDist = Infinity;
      STEPS.forEach((s) => {
        const el = stepRefs.current[s.id];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = s.id;
        }
      });
      if (closestId) setActive(closestId);
    };

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(updateActive);
    };

    updateActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scrollToStep = useCallback((id) => {
    const el = stepRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <section className="section" id="how-it-works">
      <div className="wrap section-inner">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">02 — How It Works</span>
            <h2>Area, then unit, then the verdict.</h2>
          </div>
          <p>Every property decision runs through the same three steps — scroll to see what actually happens when you drop a pin.</p>
        </div>

        <div className="howworks-tabs reveal">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToStep(s.id)}
              className={`howworks-tab${active === s.id ? ` active-${s.accent}` : ''}`}
            >
              {s.tabLabel}
            </button>
          ))}
        </div>

        <div className="howworks-scroll reveal">
          <div className="howworks-panel-sticky">
            <Panel key={active} />
          </div>

          <div className="howworks-steps">
            {STEPS.map((s) => (
              <div
                key={s.id}
                ref={(el) => { stepRefs.current[s.id] = el; }}
                className={`howworks-step-block${active === s.id ? ' active' : ''}`}
              >
                <div className={`mono howworks-step-eyebrow accent-${s.accent}`}>{s.eyebrow}</div>
                <h3>{s.heading}</h3>
                <p>{s.copy}</p>
                <ul className="howworks-bullets">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
