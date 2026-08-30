'use client';
// components/PersonaSamples.js
// "Sample Reports" -- sits between HowItWorks and the Team section, in
// the slot the old "02 -- The Verdict" bento left behind. Per request:
// one property, four different reasons to check it. Deliberately reuses
// the exact same real numbers as the hero score card and HowItWorks'
// SAMPLE_RECORD (78 Neighbourhood / 82 Home Comfort / 80 BlindSpot Score,
// Koramangala, Floor 7 SE, Recommended) rather than inventing a new
// dataset per persona -- what changes per card is what that persona was
// checking for and how they'd read the same score, not the score itself.
// No fabricated customer names/quotes here on purpose: role label
// (Young Professional / Family Buyer / Investor / Broker), not a person,
// so this reads as an illustrative sample report rather than a real
// testimonial that could be mistaken for a genuine review.
//
// One-at-a-time horizontal carousel: all 4 cards render in a flex row
// inside .ps-viewport (overflow:hidden), and .ps-track slides via
// translateX(-index * 100%) -- classic single-mounted-track carousel, so
// jumping via a dot still visibly slides across the intervening cards
// instead of hard-cutting, same as pressing Next repeatedly would.

import { useState, useCallback } from 'react';
import { PERSONAS, PERSONA_ORDER } from '@/lib/personas';

const SAMPLES = {
  young_professional: {
    checking: [
      'Commute time to work',
      'Afternoon sun in the bedroom',
      'How noisy the street gets',
      'Privacy from the building opposite',
    ],
    take: 'For a young professional: solid connectivity, decent light for late-afternoon work calls — worth an in-person check on street noise before signing.',
  },
  family_buyer: {
    checking: [
      'School access nearby',
      'How safe the area really is',
      "Morning light in the kids' room",
      'Elderly-friendly floor and lift access',
    ],
    take: 'For a family: safety and school access already look strong here — the extra weight this scoring puts on the neighbourhood shows.',
  },
  investor: {
    checking: [
      'Is the asking price fair for the area',
      'Upcoming infrastructure plans',
      'Resale-friendly floor and facing',
      'Obstruction risk to future light',
    ],
    take: 'For an investor: priced in line with the fundamentals this score reflects — worth checking rentability before committing.',
  },
  broker: {
    checking: [
      'One number to lead the pitch with',
      "The area's honest weak points",
      'What not to promise a client',
    ],
    take: "For a broker: lead with the safety number, and be ready to caveat the unit's sun exposure if it comes up.",
  },
};

export default function PersonaSamples() {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % PERSONA_ORDER.length);
  }, []);

  return (
    <section className="section persona-samples reveal">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Sample Reports</span>
            <h2>Built for how you actually buy.</h2>
          </div>
          <p>Same property, four different reasons to check it — see what each report actually surfaces.</p>
        </div>

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
                    </div>

                    <div className="hero-score-card ps-score-card">
                      <div className="hsc-head">
                        <span className="hsc-label">BlindSpot Score</span>
                        <span className="hsc-badge">Recommended</span>
                      </div>
                      <div className="hsc-number">80<span>/100</span></div>
                      <p className="hsc-verdict">Good light, safe neighbourhood, fair value for the area.</p>
                      <div className="hsc-row">
                        <div className="hsc-item slate">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
                          <div>
                            <span className="hsc-item-label">Safe, well-connected area</span>
                            <span className="hsc-item-sub">Koramangala — 78/100</span>
                          </div>
                        </div>
                        <div className="hsc-item sun">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
                          <div>
                            <span className="hsc-item-label">Bright, well-ventilated unit</span>
                            <span className="hsc-item-sub">Floor 7, SE — 82/100</span>
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
      </div>
    </section>
  );
}
