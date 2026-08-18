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
import { scoreColor, verdictFor, readableTextColor } from '@/components/property-score/AVDetailedReadout';

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
const SAMPLE_LOCALITIES = [
  { name: 'Connaught Place', meta: 'Central Delhi · PIN 110001', score: 82, grade: 'A', selected: true },
  { name: 'PIN 110010', meta: 'Delhi NCR', score: 87, grade: 'A', selected: false },
  { name: 'PIN 110021', meta: 'Delhi NCR', score: 85, grade: 'A', selected: false },
];

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

const FACING_OPTS = ['North', 'South', 'East', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

// The real property-score page's area card (AVAreaCard.js) is a light
// "blueprint-frame" spec sheet: a 3-box hero row (Sheet identity /
// Composite Index / Verdict, each its own BPF box with "+" corner marks),
// then a dimension readout below. This mock now mirrors that structure
// directly instead of the old 2-column layout it used to have, and reuses
// the real scoreColor()/verdictFor()/readableTextColor() helpers so colour
// and contrast can't drift out of sync with the live card again -- the
// verdict fill's text colour in particular is computed the same way the
// real card computes it (dark ink on the bright mid-tier fills, white only
// on the two genuinely dark tiers), not hardcoded white.
function Box({ className = '', style, children }) {
  return (
    <div className={`av-box hw-box${className ? ' ' + className : ''}`} style={style}>
      <span className="av-box-corner tl" aria-hidden="true" /><span className="av-box-corner tr" aria-hidden="true" />
      <span className="av-box-corner bl" aria-hidden="true" /><span className="av-box-corner br" aria-hidden="true" />
      {children}
    </div>
  );
}

// Same 4-column grid as the real card's dimension rows (label+source /
// weight% / bar+explain sentence / score) -- the old 2-line version only
// showed label+bar+source, dropping the weight and the explain sentence
// that make the real readout legible on its own. Score number is fixed
// light text, not scoreColor(score), for the same reason as the real
// card: red/deep-olive tiers are dark enough to nearly vanish as text on
// this near-black box -- the bar still carries that signal.
function AvDim({ label, weight, score, source, explain }) {
  const col = scoreColor(score);
  const weak = score < 50;
  return (
    <div className="av-dim-row hw-box">
      <div>
        <div className="av-dim-label">{label.toUpperCase()}</div>
        <div className="av-dim-source">{source}</div>
      </div>
      <div className="av-dim-weight mono">{weight}%</div>
      <div>
        <div className="av-dim-track">
          <div className="av-dim-fill" style={{
            width: `${score}%`,
            background: weak ? undefined : col,
            backgroundImage: weak ? `repeating-linear-gradient(45deg, ${col} 0 3px, transparent 3px 6px)` : undefined,
          }} />
        </div>
        <div className="av-dim-explain">{explain}</div>
      </div>
      <div className="av-dim-score">{score}</div>
    </div>
  );
}

function AreaPanel() {
  const selected = SAMPLE_LOCALITIES.find((l) => l.selected);
  const others = SAMPLE_LOCALITIES.filter((l) => !l.selected);
  const verdict = verdictFor(selected.score);
  const verdictCol = scoreColor(selected.score);
  const verdictText = readableTextColor(verdictCol);

  return (
    <div className="howworks-panel av-panel">
      <div className="av-hero3">
        <Box>
          <div className="mono av-tiny">SHEET · {selected.meta.toUpperCase()}</div>
          <div className="av-city">{selected.name.toUpperCase()}</div>
          <div className="av-box-sub">8/8 dimensions · scored 28 Jul 2026</div>
        </Box>

        <Box>
          <div className="mono av-tiny">COMPOSITE INDEX</div>
          <div className="av-score-num">{selected.score}<span>{selected.grade}</span></div>
          <div className="av-box-sub">NQI · weighted mean of 8 dimensions.</div>
          <div className="av-box-divider">First-pass area assessment · reflects this locality, not one building.</div>
        </Box>

        <Box className="av-verdict-box" style={{ background: verdictCol, borderColor: verdictCol, color: verdictText }}>
          <div className="mono av-tiny" style={{ color: 'inherit', opacity: .75 }}>AREA VERDICT</div>
          <div className="av-verdict-word">{verdict.label}</div>
          <div className="av-box-sub" style={{ color: 'inherit', opacity: .88 }}>{verdict.why}</div>
        </Box>
      </div>

      {/* Dimension readout is now its own dark box, same as the real
          card -- all 8 real dimensions for this exact PIN, not a
          trimmed preview. This does mean the area card is taller again
          than the Home Comfort Score card next to it (the tradeoff a
          previous pass traded away to keep the two step-cards the same
          height) -- flagging that, not silently reintroducing it. */}
      <Box className="av-dims-box">
        <div className="mono av-tiny" style={{ marginBottom: 4 }}>DIMENSION READOUT · WEIGHT = EXACT CONTRIBUTION TO THE {selected.score}</div>
        <div className="av-dims">
          {SAMPLE_DIMENSIONS.map((d) => <AvDim key={d.label} {...d} />)}
        </div>
      </Box>

      <div className="av-more">
        <div className="av-more-list">
          {others.map((l) => (
            <span key={l.name} className="av-more-chip">{l.name} <b>{l.score}</b></span>
          ))}
        </div>
        <div className="av-more-cta hw-box">
          <span className="av-locked-dot" aria-hidden="true" />
          Full report — map, price &amp; more →
        </div>
      </div>
    </div>
  );
}

// SunScout's real UI, at the point that matters here, is the LiveScore
// modal: a cream card floating over the dark 3D map, an orange "LIVESCORE"
// tag, a bold question as the headline, then a floor slider and a facing
// grid feeding one big orange CTA. Matched directly, including the dark
// slider track (only the handle is orange in the real thing, not the fill).
// A small, legible vector map — real road grid, blocks of buildings sitting
// between the streets, the unit's building picked out in orange with a pin,
// and a dotted sun-path arc — rather than a scatter of unrelated boxes.
function SsMap() {
  return (
    <div className="ss-map-strip" aria-hidden="true">
      <div className="ss-map-toolbar">
        <span className="ss-map-chip active">3D</span>
        <span className="ss-map-chip">2D</span>
      </div>
      <svg className="ss-map-svg" viewBox="0 0 520 132" preserveAspectRatio="xMidYMid slice">
        <path className="ss-map-road" d="M0,44 H520 M0,100 H520 M130,0 V132 M290,0 V132 M400,0 V132" />

        <rect className="ss-map-bldg" x="14" y="8" width="48" height="24" rx="2" />
        <rect className="ss-map-bldg" x="145" y="8" width="56" height="24" rx="2" />
        <rect className="ss-map-bldg" x="212" y="8" width="46" height="24" rx="2" />
        <rect className="ss-map-bldg" x="305" y="8" width="56" height="24" rx="2" />
        <rect className="ss-map-bldg" x="415" y="8" width="44" height="24" rx="2" />
        <rect className="ss-map-bldg" x="470" y="8" width="34" height="24" rx="2" />

        <rect className="ss-map-bldg" x="14" y="52" width="42" height="36" rx="2" />
        <rect className="ss-map-bldg" x="62" y="58" width="46" height="30" rx="2" />
        <rect className="ss-map-bldg ss-map-bldg-target" x="150" y="50" width="60" height="38" rx="2" />
        <rect className="ss-map-bldg" x="305" y="52" width="40" height="36" rx="2" />
        <rect className="ss-map-bldg" x="410" y="52" width="44" height="36" rx="2" />
        <rect className="ss-map-bldg" x="460" y="58" width="46" height="30" rx="2" />

        <path className="ss-map-sunpath" d="M20,126 Q260,100 500,126" />
        <circle className="ss-map-sun" cx="260" cy="102" r="4" />

        <circle className="ss-map-ping" cx="180" cy="69" r="9" />
        <path className="ss-map-pin" d="M180 56c-5.5 0-10 4.4-10 9.9 0 7.4 10 17.1 10 17.1s10-9.7 10-17.1c0-5.5-4.5-9.9-10-9.9z" />
        <circle className="ss-map-pin-hole" cx="180" cy="66" r="3.6" />
      </svg>
      <span className="ss-map-time">04:52 PM</span>
    </div>
  );
}

// SunScout's real UI, at the point that matters here, is the LiveScore
// modal: a cream card over a dark 3D map, a bold question as the headline,
// a floor slider and facing grid feeding one big orange CTA — and, next to
// it, an AI Summary pane, matching the product's LiveScore / AI Solar
// Report split screen. Matched directly, including the dark slider track
// (only the handle is orange in the real thing, not the fill).
function UnitPanel() {
  return (
    <div className="howworks-panel ss-panel">
      <SsMap />

      <div className="ss-body">
        <div className="ss-main">
          <div className="mono ss-tag">HOME COMFORT SCORE</div>
          <h4 className="ss-heading">Will This Unit Work For You?</h4>

          <div className="ss-field">
            <div className="mono ss-label">FLOOR NUMBER</div>
            <div className="ss-slider-row">
              <div className="ss-slider-track"><div className="ss-slider-handle" style={{ left: '23%' }} /></div>
              <div className="ss-value-chip">7</div>
            </div>
          </div>

          <div className="ss-field">
            <div className="mono ss-label">FACING DIRECTION</div>
            <div className="ss-facing-grid">
              {FACING_OPTS.map((dir) => (
                <div key={dir} className={`hw-box ss-facing-cell${dir === 'South-East' ? ' active' : ''}`}>
                  {dir}
                </div>
              ))}
            </div>
          </div>

          <div className="ss-cta hw-pulse">GET MY HOME COMFORT SCORE</div>

          <div className="hw-box ss-result">
            <div className="mono ss-label">HOME COMFORT SCORE</div>
            <div className="ss-result-num">82<span>/100</span></div>
            <div className="ss-result-desc">Strong morning light, minimal shadow before 3pm, good cross-ventilation for this facing.</div>
          </div>
        </div>

        {/* AI Summary pane, side by side with LiveScore — condensed version
            of the real AI Solar Report pane (sun/shadow narration + report
            CTA), not full report data. */}
        <div className="ss-ai-col">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" /></svg>
          <div className="mono ss-ai-col-tag">AI SOLAR</div>
          <div className="ss-ai-col-heading">AI Summary</div>
          <p className="ss-ai-col-desc">Real sun &amp; shadow data for this unit, narrated in plain English.</p>
          <div className="ss-ai-col-cta">Generate Report</div>
          <div className="mono ss-ai-col-meta">~30 SEC · FREE</div>
        </div>
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
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 6 }}>BLINDSPOT COMBINED SCORE</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 46, lineHeight: 1, color: 'var(--text)' }}>
            80<span style={{ fontSize: 18, color: 'var(--text-mute)' }}>/100</span>
          </div>
        </div>
        {/* Solid --brand fill, not the old sun→slate gradient -- matches the
            .hsc-badge cleanup in globals.css. This one was hardcoded as an
            inline style here rather than sharing that class, which is why
            it got missed the first time. */}
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff', background: 'var(--brand)', padding: '8px 16px', borderRadius: 3 }}>
          Recommended
        </div>
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 20 }}>
        Solid area score with a genuinely bright unit — good light most of the year, no major shadow issues at this floor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', marginBottom: 6 }}>AREA — KORAMANGALA — 50%</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--slate)' }}>78</div>
        </div>
        <div className="hw-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 3, padding: '14px 16px' }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mute)', marginBottom: 6 }}>UNIT — FL 7, SE — 50%</div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--sun)' }}>82</div>
        </div>
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
