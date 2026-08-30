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
import { scoreColor, verdictFor, readableTextColor, BPF } from '@/components/property-score/AVDetailedReadout';

const STEPS = [
  {
    id: 'area',
    tabLabel: '1. Pick your area',
    eyebrow: 'STEP 1 — AREA',
    accent: 'slate',
    heading: 'Search a locality, see the score before you see the flat.',
    copy: "Neighbourhood Score rates every locality 0–100 across crime, air quality, power, water, schools and infrastructure — pulled from government records, not what a broker tells you. Type an area name, get the number in seconds.",
    bullets: [
      'Searchable by name, not just pincode',
      '8 weighted dimensions, one composite score',
      'Nearby-locality comparison built in',
      'Unlock the full report — inspection notes, price and commute check',
    ],
  },
  {
    id: 'unit',
    tabLabel: '2. Check the unit',
    eyebrow: 'STEP 2 — UNIT',
    accent: 'sun',
    heading: 'Then check the specific flat — floor, facing, and how much sun it actually gets.',
    copy: "The area score is the same for every flat on the block. This step is what makes it personal: pick a floor and facing, and real solar geometry returns a Home Comfort Score for that exact unit.",
    bullets: [
      'Real sun-path modelling, not a guess',
      'Change the floor or facing, get a new score instantly',
      'Home Comfort Score: sun, shade and ventilation combined',
      'AI Summary narrates the sun & shadow pattern in plain English',
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

// Real record, not invented -- data/aslivastu/nqi_scores.json +
// master_by_pin.json, PIN 110001 (Connaught Place / Central Delhi),
// scored_at 2026-07-28. Every field below (score, grade, weight, source,
// explain sentence) is pulled straight from that record or the same
// source()/explain() logic AVDetailedReadout.js uses for the real card,
// so this mockup can't drift from what the live property-score page
// actually shows for this exact PIN.
const SAMPLE_RECORD = {
  area: 'Central Delhi',
  pin_code: '110001',
  name: 'Connaught Place',
  dimensions_scored: 8,
  dimensions_total: 8,
  scoredAt: '28 Jul 2026',
  nqi_composite: 82,
  grade: 'A',
};

const SAMPLE_DIMENSIONS = [
  { label: 'Safety', weight: 25, score: 90, source: 'Delhi Police Annual Report · est. 2023', explain: '290 crimes reported — safer than 73% of tracked Delhi NCR areas (low tier).' },
  { label: 'Infrastructure', weight: 20, score: 45, source: 'DDA Master Plan · DMRC · est. 2024', explain: '0 operational metro station(s) · low highway access · commercial zone.' },
  { label: 'Air Quality', weight: 15, score: 75, source: 'CPCB live AQI · updated daily', explain: 'AQI ~113, Moderate — okay for healthy people; asthma/heart/lung patients should limit long outdoor exertion.' },
  { label: 'Schools', weight: 10, score: 100, source: 'CBSE affiliation database · est. 2023', explain: '15 CBSE school(s) mapped to this pin.' },
  { label: 'Power', weight: 10, score: 94, source: 'BSES / Tata Power · est. 2023', explain: 'Excellent reliability · ~1.2 outage hrs/month via NDMC.' },
  { label: 'Water Supply', weight: 8, score: 100, source: 'Delhi Jal Board supply & quality · est. 2023', explain: '22 hrs daily supply · Low TDS · 99% piped coverage.' },
  { label: 'Roads', weight: 7, score: 100, source: 'MCD / PWD road surveys · est. 2023', explain: 'Excellent condition · ~0.2 potholes/km · last resurfaced 2023.' },
  { label: 'Drainage & Sewerage', weight: 5, score: 100, source: 'Drainage & waterlogging records · est. 2023', explain: 'Low monsoon waterlogging risk.' },
];

// Two earlier attempts at this, both wrong in opposite directions. First:
// render the real report's exact .avsheet-* markup (built for a fixed
// 1056px layout) and shrink it with a CSS transform to fit here -- looked
// right (it WAS the real report) but the shrink made the text too small to
// read, and dragged along per-row "data source" + "explain" copy that only
// earns its place in the full report. Second: drop the shared .avsheet-*
// system entirely for a lighter, differently-styled card -- fixed the text
// size, but reads as a different, generic design rather than a preview of
// the actual report.
//
// This keeps the real report's visual system -- BPF blueprint-frame boxes
// with "+" corner marks, the same Bricolage Grotesque hero-score type, the
// same dashed-border dimension rows -- reusing AVAreaCard.js's own
// .avsheet-label/-name/-score/-grade/-verdict-word/-row-label/-track/
// -row-score/-row-weight classes directly, so the fonts/colours match the
// real card exactly (sizes are scaled down via inline style where a box is
// meaningfully narrower here than on the real 1056px-wide sheet -- see the
// per-element comments below). The 3-box hero (Sheet identity / Composite
// Index / Verdict) and each row's %-weight are both back, matching the
// real card's structure -- an earlier pass had merged the first two boxes
// and dropped weight, which read as missing real information rather than
// just a lighter version of it. Two things still don't render: the
// per-row data-source caption and one-sentence "explain" paragraph. Those
// stay real and correct in SAMPLE_DIMENSIONS, they just don't render here
// -- the full report (one tap away via the CTA below) is where that
// belongs.
function AreaPanel() {
  const rec = SAMPLE_RECORD;
  const verdict = verdictFor(rec.nqi_composite);
  const verdictCol = scoreColor(rec.nqi_composite);
  const verdictText = readableTextColor(verdictCol);

  return (
    <div className="howworks-panel av-panel">
      <div className="hw-area">
        {/* 3 equal boxes, like the real card's .avsheet-hero -- but this
            panel's actual width is well under the real sheet's 1056px, so
            each box only gets ~1/3 of that. Rather than let the real
            card's 84px score / 40px name / 24px box padding cramp or
            overflow at this width, both boxes' type and padding are
            explicitly scaled down here via inline style (same font family/
            weight/colour as .avsheet-score/-name -- only the size differs,
            same idea as the real card's own max-width:640px mobile
            override, just tuned for this box's width instead of the
            viewport's). */}
        <div className="hw-area-hero3">
          <BPF dark className="avsheet-box" style={{ padding: '16px 14px' }}>
            <p className="avsheet-label" style={{ color: 'rgba(255,253,248,0.65)' }}>
              Sheet · PIN {rec.pin_code}
            </p>
            <h3 className="avsheet-name" style={{ fontSize: 22, marginTop: 8 }}>{rec.name}</h3>
          </BPF>

          <BPF dark className="avsheet-box" style={{ padding: '16px 14px' }}>
            <p className="avsheet-label" style={{ color: 'rgba(255,253,248,0.65)' }}>Composite index</p>
            <div className="avsheet-scorerow" style={{ marginTop: 10 }}>
              <span className="avsheet-score" style={{ fontSize: 42 }}>{rec.nqi_composite}</span>
              <span className="avsheet-grade" style={{ fontSize: 18 }}>{rec.grade}</span>
            </div>
          </BPF>

          <div className="avsheet-verdict" style={{ background: verdictCol, color: verdictText, padding: '16px 14px' }}>
            <p className="avsheet-label" style={{ color: 'inherit', opacity: .75 }}>Verdict</p>
            <div className="avsheet-verdict-word" style={{ fontSize: 18, marginTop: 8 }}>{verdict.label}</div>
            <p className="avsheet-verdict-why" style={{ opacity: .92 }}>{verdict.why}</p>
          </div>
        </div>

        <BPF className="avsheet-readout">
          <p className="avsheet-label avsheet-readout-label">
            Dimension readout · weight = exact contribution to the {rec.nqi_composite}
          </p>
          {SAMPLE_DIMENSIONS.map((d) => {
            const weak = d.score < 50;
            const col = scoreColor(d.score);
            return (
              <div key={d.label} className="hw-area-row">
                <div className="avsheet-row-label" style={{ fontSize: 15 }}>{d.label}</div>
                <div className="avsheet-row-weight">{d.weight}%</div>
                <div>
                  <div className="avsheet-track" style={{ height: 6 }}>
                    <div style={{
                      position: 'absolute', inset: 0, width: `${d.score}%`,
                      background: weak ? undefined : col,
                      backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
                    }} />
                  </div>
                </div>
                <div className="avsheet-row-score" style={{ color: col, fontSize: 20 }}>{d.score}</div>
              </div>
            );
          })}
        </BPF>

        {/* Same footer CTA as the real card, word for word, linking to the
            same standalone full-report page -- this panel is meant to read
            as a first look at that exact report, not a different,
            homepage-only destination. */}
        <a
          href="/neighbourhood-report/110001"
          target="_blank"
          rel="noreferrer"
          className="ps-btn ps-cta-btn"
          style={{ display: 'inline-block', background: 'var(--slate)', color: '#fff', border: '1px solid var(--slate)', borderRadius: 'var(--radius)', padding: '12px 22px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
        >
          See Detailed Neighbourhood Report ↗
        </a>
      </div>
    </div>
  );
}

// Real record, not invented -- SAMPLE_LIVE_SCORE below is what
// lib/sunscout/scoring/scoreAggregator.js's computeLiveScore() actually
// returns for floor=5/South at this locality (sun/shadeHeat/view/privacy
// straight from sunScore.js/shadeHeatScore.js/viewScore.js/privacyScore.js's
// own formulas and copy; wind uses windScore.js's own no-live-data
// fallback, since this static homepage explainer makes no live API calls --
// see the file header). 30/25/20/15/10 weights are DEFAULT_WEIGHTS from
// lib/sunscout/scoring/types.js, unmodified.
const SAMPLE_LIVE_SCORE = {
  liveScore: 50,
  grade: 'Fair',
  unit: { floor: 5, facing: 'South' },
  subScores: [
    { key: 'sun', label: 'Sun', weightPct: 30, score: 100 },
    { key: 'shadeHeat', label: 'Shade & Heat', weightPct: 25, score: 0 },
    { key: 'view', label: 'View', weightPct: 20, score: 41 },
    { key: 'privacy', label: 'Privacy', weightPct: 15, score: 44 },
    { key: 'wind', label: 'Wind & Ventilation', weightPct: 10, score: 50 },
  ],
};

// The real "Home Comfort Score" result -- LiveScoreCard.js, opened from
// the "Will This Unit Work For You?" floor/facing modal on the actual
// /property-score page -- is a composite-score box (left accent bar in
// the grade colour, big number/100, a grade pill) followed by one card per
// weighted factor (label + its %-weight, a coloured bar, the score). This
// used to instead show a decorative fake map, an interactive-looking but
// non-functional floor slider and facing grid, and a single one-line
// result next to an unrelated "AI Summary" panel -- none of which
// resembles what the real modal actually shows. This reuses the real
// component's own colours/fonts (ORG/INK/SUB/LINE and its Space Grotesk /
// Plus Jakarta Sans / IBM Plex Mono stack -- SunScout's own type system,
// separate from the rest of the site's Bricolage Grotesque/Inter) so the
// composite box and factor rows are the same shapes and colours as the
// real thing. What's dropped, same idea as the Area panel: each factor's
// one-sentence "why" and its monospace BASIS calculation line -- real,
// correct detail that belongs in the actual modal, not a homepage teaser
// -- plus the "HOW THE COMPOSITE IS CALCULATED" and "DATA NOTES" boxes
// underneath it. The floor/facing input itself collapses to a plain
// readout line instead of a live-looking slider+grid, since simulating an
// interaction the panel can't actually perform read as more misleading
// than informative once the real result layout took the space it needs.
const SS_ORG = '#E07B00';
const SS_INK = '#1A0A00';
const SS_SUB = '#8A8A8A';
const SS_LINE = 'rgba(26,10,0,0.12)';
const SS_GRADE_COLOR = { Excellent: '#16a34a', Good: '#65a30d', Fair: SS_ORG, Poor: '#dc2626' };
function ssScoreColor(score) {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return SS_ORG;
  if (score >= 25) return '#ea580c';
  return '#dc2626';
}

function UnitPanel() {
  const r = SAMPLE_LIVE_SCORE;
  return (
    <div className="howworks-panel ss-panel">
      <div className="mono ss-tag">HOME COMFORT SCORE</div>
      <h4 className="ss-heading" style={{ marginBottom: 10 }}>Will This Unit Work For You?</h4>
      <p className="hw-live-intro">
        One score for this exact flat — sun, shade &amp; heat, view, privacy and wind — with the full calculation shown, not just a number.
      </p>
      <div className="mono hw-live-unit-readout">
        FLOOR {r.unit.floor} · {r.unit.facing.toUpperCase()}-FACING
      </div>

      <div className="hw-live-score-box" style={{ borderLeftColor: SS_GRADE_COLOR[r.grade] }}>
        <div>
          <div className="mono hw-live-score-label">HOME COMFORT SCORE — COMPOSITE</div>
          <div className="hw-live-score-number">{r.liveScore}<span>/100</span></div>
        </div>
        <div className="mono hw-live-grade-pill" style={{ borderColor: SS_GRADE_COLOR[r.grade], color: SS_GRADE_COLOR[r.grade] }}>
          {r.grade}
        </div>
      </div>

      <div>
        {r.subScores.map((s) => {
          const col = ssScoreColor(s.score);
          return (
            <div key={s.key} className="hw-live-row">
              <div className="hw-live-row-top">
                <div className="hw-live-row-label">
                  {s.label}
                  <span className="mono hw-live-row-weight">weight {s.weightPct}%</span>
                </div>
                <div className="hw-live-row-score" style={{ color: col }}>{s.score}</div>
              </div>
              <div className="hw-live-row-track"><div style={{ width: `${s.score}%`, height: '100%', background: col }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerdictPanel() {
  return (
    <div className="howworks-panel">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
          <span className="mono" style={{ color: 'var(--slate)' }}>AREA 50%</span>
          <span className="mono" style={{ color: 'var(--sun)' }}>UNIT 50%</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: 'linear-gradient(90deg, var(--slate) 50%, var(--sun) 50%)' }} />
        <div className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-mute)', marginTop: 6 }}>
          Starts 50/50 — drag anytime to change how much the neighbourhood matters vs. the specific flat.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 6 }}>BLINDSPOT SCORE</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 46, lineHeight: 1, color: 'var(--text)' }}>
            80<span style={{ fontSize: 18, color: 'var(--text-mute)' }}>/100</span>
          </div>
        </div>
        {/* Real product badge text is one of four verdict labels, each with
            its own quadrant colour (see UnitVerdict.js's VERDICT_COLOR) --
            "Recommended" was a made-up label that doesn't exist anywhere in
            the real product. Two strong scores (78/82) is what the real
            system calls "Prime Pick", coloured var(--brand) -- which this
            already happened to use, so only the label text was wrong. */}
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', background: 'var(--brand)', padding: '8px 16px', borderRadius: 3 }}>
          Prime Pick
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 20 }}>
        Solid area score with a genuinely bright unit — good light most of the year, no major shadow issues at this floor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', marginBottom: 6 }}>AREA — KORAMANGALA — 50%</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--slate)' }}>78</div>
        </div>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', marginBottom: 6 }}>UNIT (HOME COMFORT) — FL 7, SE — 50%</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--sun)' }}>82</div>
        </div>
      </div>

      {/* The real card shows exactly how the two numbers above become the
          one at the top -- (area × weight) + (unit × weight) -- plus a
          couple of lines on what each side of that number actually is and
          isn't. Both were missing here entirely, which is also why this
          card sat on far more blank space than the Area/Unit panels next
          to it: those two are packed to this same 680px budget, this one
          wasn't showing enough of the real card to fill it honestly. */}
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 3, padding: '12px 16px', marginBottom: 16 }}>
        (78 × 50%) + (82 × 50%) = 80
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.8 }}>
        <div>— Area score is the same for every unit in this pincode — only the unit score changes with floor/facing.</div>
        <div>— View and Privacy are deterministic floor-based estimates, not live building lookups.</div>
        <div>— Live wind data unavailable — Wind score fell back to a neutral baseline.</div>
      </div>
    </div>
  );
}

const PANELS = { area: AreaPanel, unit: UnitPanel, verdict: VerdictPanel };

export default function HowItWorks() {
  const [active, setActive] = useState('area');
  const Panel = PANELS[active];
  const activeIndex = STEPS.findIndex((s) => s.id === active);
  const stepRefs = useRef({});
  const tickingRef = useRef(false);

  // Scroll-driven step switching (desktop only — see the matching
  // max-width:900px rule in globals.css that turns the sticky panel back
  // into normal flow, at which point this tracking isn't meaningful).
  // On every scroll frame, find whichever step block's vertical centre is
  // closest to the viewport's vertical centre and make that the active
  // step. No scroll-jacking — native scroll speed/position is untouched,
  // this only reads position and swaps which panel is shown. The mini-map
  // below reacts to this same `active` value purely through CSS classes —
  // there's no continuous scroll-position math driving any visual anymore.
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
    window.addEventListener('resize', updateActive);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateActive);
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

        {/* No `reveal` class on this container — .reveal applies a CSS
            transform, and a transform on an element breaks position:sticky
            on its descendants in most browsers. Separately, a later CSS
            rule used to also redeclare `position:relative` on
            .howworks-panel-sticky for z-index purposes, which — same
            specificity, later in the file — silently overrode the
            `position:sticky` set on it elsewhere. Both are fixed now (see
            globals.css); the sticky card actually stays pinned. */}
        <div className="howworks-scroll">
          <div className="howworks-panel-sticky">
            <Panel key={active} />
          </div>

          <div className="howworks-steps-col">
            {/* No separate map box — instead, a small route marker sits in
                the left margin of each step, structurally locked to that
                step's row via CSS Grid (see `.howworks-steps` below: a
                marker cell and a text cell per step, auto-placed into the
                same row by plain DOM order — no JS measurement involved).
                Each marker's border-left segments join up into one
                continuous vertical line down the margin, coloured in as
                you pass each step.

                Because this whole column is normal document flow (not
                sticky, not a background layer behind something sticky),
                it scrolls at exactly the same rate as the text next to it,
                always, by construction — the sync problem that broke every
                earlier version simply doesn't exist here. */}
            <div className="howworks-steps">
              {/* No per-step visual card on mobile (removed -- see globals.css
                  history for the .howworks-mobile-panel mechanism this used
                  to use). Desktop still shows the real thing via the shared
                  sticky panel (scroll-position-driven, see the matchMedia
                  check above); on mobile it's tabs + copy only now. */}
              {STEPS.map((s, i) => (
                <div key={s.id} style={{ display: 'contents' }}>
                  <div className={`hw-route-marker accent-${s.accent}${i <= activeIndex ? ' reached' : ''}${s.id === active ? ' current' : ''}`}>
                    <span className="hw-route-pin">
                      <svg viewBox="0 0 22 30" width="14" height="19">
                        <path d="M11 0C4.9 0 0 4.9 0 11c0 8.2 11 19 11 19s11-10.8 11-19C22 4.9 17.1 0 11 0z" />
                        <circle cx="11" cy="11" r="4.2" className="hw-route-pin-hole" />
                      </svg>
                    </span>
                  </div>
                  <div
                    ref={(el) => { stepRefs.current[s.id] = el; }}
                    className={`howworks-step-block${active === s.id ? ' active' : ''}${i === 0 ? ' first' : ''}${i === STEPS.length - 1 ? ' last' : ''}`}
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
