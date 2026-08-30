'use client';
// components/PersonaSamples.js
// "Sample Reports" -- sits between HowItWorks and the Team section, in
// the slot the old "02 -- The Verdict" bento left behind.
//
// Per request, each card now uses a REAL locality: one of BlindSpot's 4
// covered cities per persona (Young Professional -> Bangalore, Family
// Buyer -> Chandigarh, Investor -> Mumbai, Broker -> Delhi NCR -- an
// arbitrary but sensible 1:1 assignment, easy to change), and within
// that city, the actual highest-scoring PIN when data/aslivastu/
// nqi_scores.json's 8 raw dimension scores are recomputed with THAT
// persona's own avWeights from lib/personas.js -- the same weighted-mean
// math recomputeAreaScore() does, just precomputed once here rather than
// live (this is static marketing copy, not a live report). Locality
// names come from lib/aslivastu/pinMeta.js, the same PIN->name map the
// real product uses. Home Comfort Score stays the same illustrative 82
// (Floor 7, SE) across all four -- that figure is unit-specific
// (floor/facing a buyer picks), not something that varies by locality
// the way the neighbourhood score does, so there's no real "best" one
// to look up. The combined BlindSpot Score blends each persona's own
// real neighbourhood number with that fixed 82, using their own
// defaultAreaWeight -- so the four cards can (and do) land on visibly
// different final scores, not the same repeated 80.
//
// No fabricated customer names/quotes here on purpose: role label
// (Young Professional / Family Buyer / Investor / Broker), not a
// person, so this reads as an illustrative sample report rather than a
// real testimonial that could be mistaken for a genuine review. This
// got revisited twice (once asking for names + an AI photo, once for
// just a name) and stayed a role label both times -- a name alone,
// paired with "For a young professional in Bangalore: got this
// result," still reads as one specific real customer on a live
// production site, photo or not.
//
// Each SAMPLE has a `reportUrl` placeholder (null for now) for the
// actual generated sample reports, coming later -- set it per persona
// once those exist and the card's "View sample report" link goes
// live automatically; until then it renders as a disabled placeholder
// rather than a link that looks real but goes nowhere.
//
// One-at-a-time horizontal carousel: all 4 cards render in a flex row
// inside .ps-viewport (overflow:hidden), and .ps-track slides via
// translateX(-index * 100%) -- classic single-mounted-track carousel, so
// jumping via a dot still visibly slides across the intervening cards
// instead of hard-cutting, same as pressing Next repeatedly would.
// Content sits directly on the full-bleed field (no inset card box,
// per request) and the field's own background colour switches to that
// persona's accent colour as the active card changes.

import { useState, useCallback } from 'react';
import { PERSONAS, PERSONA_ORDER } from '@/lib/personas';

// `name` is null on every entry below on purpose. Setting it is safe
// ONLY when it's paired with that same person's own real, verified
// result -- their actual place/neighbourhood/homeComfort/combined
// numbers, not the illustrative ones already sitting in this file.
// The numbers below were computed by re-running the real scoring
// formula for illustration (see the file header) -- they were never
// produced by an actual person running an actual report. Attaching a
// real name to THESE numbers would misattribute a made-up result to a
// specific real, identifiable person, which is the thing that was
// actually the problem, not the name by itself. Replace an entire
// entry's checking/take/place/neighbourhood/homeComfort/combined/name
// together, from that person's real result, or don't set `name` yet.
const SAMPLES = {
  young_professional: {
    checking: [
      'Commute time to work',
      'Afternoon sun in the bedroom',
      'How noisy the street gets',
      'Privacy from the building opposite',
    ],
    take: 'For a young professional in Bangalore: HKP Road scores well on connectivity and safety — decent light for late-afternoon work calls, worth an in-person check on street noise before signing.',
    city: 'Bangalore',
    place: 'HKP Road',
    area: 'Central Bengaluru',
    neighbourhood: 81,
    homeComfort: 82,
    combined: 82,
    reportUrl: null, // TODO: set once a real generated sample report exists for this persona
    name: null, // TODO: real customer name -- see the note above SAMPLES before setting this
  },
  family_buyer: {
    checking: [
      'School access nearby',
      'How safe the area really is',
      "Morning light in the kids' room",
      'Elderly-friendly floor and lift access',
    ],
    take: 'For a family in Chandigarh: Sector 12 already leads the city on safety and schools — the extra weight this scoring puts on the neighbourhood shows.',
    city: 'Chandigarh',
    place: 'Sector 12 · PEC',
    area: 'North Chandigarh',
    neighbourhood: 81,
    homeComfort: 82,
    combined: 81,
    reportUrl: null, // TODO: set once a real generated sample report exists for this persona
    name: null, // TODO: real customer name -- see the note above SAMPLES before setting this
  },
  investor: {
    checking: [
      'Is the asking price fair for the area',
      'Upcoming infrastructure plans',
      'Resale-friendly floor and facing',
      'Obstruction risk to future light',
    ],
    take: 'For an investor in Mumbai: Fort tops the city on this weighting, though the neighbourhood score itself is more middling than the other three cities — worth checking rentability and price before committing, not just the headline number.',
    city: 'Mumbai',
    place: 'Fort / CSMT / Churchgate East',
    area: 'A Ward',
    neighbourhood: 70,
    homeComfort: 82,
    combined: 75,
    reportUrl: null, // TODO: set once a real generated sample report exists for this persona
    name: null, // TODO: real customer name -- see the note above SAMPLES before setting this
  },
  broker: {
    checking: [
      'One number to lead the pitch with',
      "The area's honest weak points",
      'What not to promise a client',
    ],
    take: 'For a broker in Delhi NCR: Cantonment leads the city on this weighting — lead with that number, and be ready to caveat the unit’s sun exposure if it comes up.',
    city: 'Delhi NCR',
    place: 'Cantonment',
    area: 'South Delhi',
    neighbourhood: 87,
    homeComfort: 82,
    combined: 84,
    reportUrl: null, // TODO: set once a real generated sample report exists for this persona
    name: null, // TODO: real customer name -- see the note above SAMPLES before setting this
  },
};

export default function PersonaSamples() {
  const [index, setIndex] = useState(0);
  const activeId = PERSONA_ORDER[index];
  const activeColor = PERSONAS[activeId].color;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % PERSONA_ORDER.length);
  }, []);

  return (
    <section className="section persona-samples reveal" style={{ backgroundColor: activeColor }}>
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Sample Reports</span>
            <h2>Built for how you actually buy.</h2>
          </div>
          <p>Four real localities, four different reasons to check them — see what each report actually surfaces.</p>
        </div>
      </div>

      {/* Full-bleed, edge-to-edge -- deliberately NOT inside .wrap like the
          intro above. The slide area itself should fill the whole screen
          width rather than sit in the same ~1180px column as everything
          else, so this is a sibling of .wrap, not a child -- .ps-carousel
          supplies its own (wider, clamp-based) side padding instead of
          inheriting .wrap's. */}
      <div className="ps-carousel">
        <div className="ps-viewport">
          <div className="ps-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {PERSONA_ORDER.map((id) => {
              const persona = PERSONAS[id];
              const sample = SAMPLES[id];
              return (
                <div className="ps-card" key={id} style={{ '--ps-accent': persona.color }}>
                  <div className="ps-card-inner">
                    <div className="ps-copy">
                      <span className="ps-role">{persona.label}</span>
                      <div className="ps-checking-label mono">CHECKING FOR</div>
                      <ul className="ps-checking">
                        {sample.checking.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                      <p className="ps-take">{sample.take}</p>

                      {sample.name && (
                        <p className="ps-attribution">— {sample.name}, {persona.label}</p>
                      )}

                      {sample.reportUrl ? (
                        <a className="ps-report-link" href={sample.reportUrl} target="_blank" rel="noreferrer">
                          View sample report
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                        </a>
                      ) : (
                        <button type="button" className="ps-report-link ps-report-link-pending" disabled title="Sample report coming soon">
                          View sample report — coming soon
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                        </button>
                      )}
                    </div>

                    <div className="hero-score-card ps-score-card">
                      <div className="hsc-head">
                        <span className="hsc-label">BlindSpot Score</span>
                        <span className="hsc-badge">Recommended</span>
                      </div>
                      <div className="hsc-number">{sample.combined}<span>/100</span></div>
                      <p className="hsc-verdict">Good light, safe neighbourhood, fair value for the area.</p>
                      <div className="hsc-row">
                        <div className="hsc-item slate">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
                          <div>
                            <span className="hsc-item-label">Safe, well-connected area</span>
                            <span className="hsc-item-sub">{sample.place} — {sample.neighbourhood}/100</span>
                          </div>
                        </div>
                        <div className="hsc-item sun">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
                          <div>
                            <span className="hsc-item-label">Bright, well-ventilated unit</span>
                            <span className="hsc-item-sub">Floor 7, SE — {sample.homeComfort}/100</span>
                          </div>
                        </div>
                      </div>
                      <div className="hsc-foot">Real solar geometry + government locality data, combined into one number you can trust.</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ps-controls">
          <div className="ps-dots">
            {PERSONA_ORDER.map((id, i) => (
              <button
                key={id}
                type="button"
                className={`ps-dot${i === index ? ' active' : ''}`}
                style={{ '--ps-accent': PERSONAS[id].color }}
                onClick={() => setIndex(i)}
                aria-label={`Show ${PERSONAS[id].label}`}
                aria-current={i === index}
              />
            ))}
          </div>
          <button type="button" className="ps-next" onClick={next}>
            Next <span className="btn-cta-arrow">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
