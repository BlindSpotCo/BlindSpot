'use client';
// components/PersonaSamples.js
// "Sample Reports" -- sits between HowItWorks and the Team section, in
// the slot the old "02 -- The Verdict" bento left behind.
//
// Every card below is a REAL BlindSpot Combined Report, run by a real
// person, with their real name and their real result -- not the
// illustrative "best locality per city" numbers this file used to
// carry. The four PDFs are the source of truth for every number here:
//   Vainavee Subash (Young Professional) -- Mahadevapura, Bangalore
//   Jai Mittal (Investor)                 -- Sector 6, Chandigarh
//   Mayookha Satheesh (Family Buyer)      -- R.K. Puram, Delhi NCR
//   Ishaan Yadav (Broker)                 -- Fort / CSMT / Churchgate East, Mumbai
// and are also copied verbatim into public/sample-reports/ so
// `reportUrl` below links to the actual report, not a placeholder --
// see the "View sample report" button, which now points at a real PDF
// for all four cards instead of rendering the disabled "coming soon"
// state it used to.
//
// This is also why a real name was fine to add here and wasn't before:
// earlier asks were for invented names (once with an AI photo, once
// name-only) attached to numbers that were never anyone's actual
// result. These are that same real person's own real result, sourced
// from the report they actually ran -- the thing that was missing
// both previous times, not the name by itself.
//
// `caution` flips the score-card badge between the report's own two
// verdicts ("Recommended" / "Recommended with Caution", see .hsc-badge
// vs .hsc-badge-caution in globals.css) -- not every one of these four
// results is a clean "Recommended," and the badge should say so rather
// than defaulting every card to the same green pill regardless of
// score. `summary` is a one-line condensation of each PDF's own "Home
// Buyer Verdict" paragraph; `take` is the longer version under the
// checking-for list, in the same role-voiced style this section always
// used, now grounded in that person's real numbers instead of a
// computed illustrative ones.
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

const SAMPLES = {
  young_professional: {
    name: 'Vainavee Subash',
    checking: [
      'Commute time to work',
      'Afternoon sun in the bedroom',
      'How noisy the street gets',
      'Privacy from the building opposite',
    ],
    take: 'Mahadevapura came out to 79/100 - excellent air quality (88/100) and strong light most of the year, though the unit goes fully shaded from May to August and water/roads are the honest trade-off.',
    summary: 'Bright, well-ventilated, excellent air quality, patchy summer light.',
    city: 'Bangalore',
    place: 'Mahadevapura',
    floor: 15,
    facingLabel: 'South',
    facingAbbr: 'S',
    neighbourhood: 72,
    homeComfort: 87,
    combined: 79,
    caution: false,
    verdictLabel: 'Recommended',
    reportUrl: '/sample-reports/young-professional-sample-report.pdf',
  },
  family_buyer: {
    name: 'Mayookha Satheesh',
    checking: [
      'School access nearby',
      'How safe the area really is',
      "Natural light in the kids' room",
      'Elderly-friendly floor and lift access',
    ],
    take: "R.K. Puram scored 66/100 - a 100/100 schools score and 91/100 crime rating are hard to beat for a family, but the neighbourhood's 45/100 infrastructure and this west-facing unit's afternoon heat gain are real trade-offs to plan around.",
    summary: 'Exceptional schools and safety, infrastructure and afternoon heat need a plan.',
    city: 'Delhi NCR',
    place: 'R.K. Puram',
    floor: 10,
    facingLabel: 'West',
    facingAbbr: 'W',
    neighbourhood: 77,
    homeComfort: 50,
    combined: 66,
    caution: true,
    verdictLabel: 'Recommended with Caution',
    reportUrl: '/sample-reports/family-buyer-sample-report.pdf',
  },
  investor: {
    name: 'Jai Mittal',
    checking: [
      'Is the asking price fair for the area',
      'Upcoming infrastructure plans',
      'Resale-friendly floor and facing',
      'Obstruction risk to future light',
    ],
    take: "Sector 6 scored 59/100 - a strong 76/100 neighbourhood (top schools, low crime, excellent utilities) undercut by this specific unit's 44/100 Home Comfort: a low floor and an east-facing obstruction that delays winter light. The area justifies the price; this particular unit is the risk.",
    summary: "Strong neighbourhood fundamentals, this unit's limited light is the catch.",
    city: 'Chandigarh',
    place: 'Sector 6',
    floor: 2,
    facingLabel: 'East',
    facingAbbr: 'E',
    neighbourhood: 76,
    homeComfort: 44,
    combined: 59,
    caution: true,
    verdictLabel: 'Recommended with Caution',
    reportUrl: '/sample-reports/investor-sample-report.pdf',
  },
  broker: {
    name: 'Ishaan Yadav',
    checking: [
      'One number to lead the pitch with',
      "The area's honest weak points",
      'What not to promise a client',
    ],
    take: "Fort / CSMT / Churchgate East scored 72/100 - safer than 97% of comparable areas, with strong air quality and reliable morning light on this North-East unit. The honest caveat for a pitch: don't promise all-day sun, and be ready on the 58/100 water score.",
    summary: 'Safe, well-connected, bright mornings, an easy pitch with honest caveats.',
    city: 'Mumbai',
    place: 'Fort / CSMT / Churchgate East',
    floor: 23,
    facingLabel: 'North-East',
    facingAbbr: 'NE',
    neighbourhood: 72,
    homeComfort: 72,
    combined: 72,
    caution: false,
    verdictLabel: 'Recommended',
    reportUrl: '/sample-reports/broker-sample-report.pdf',
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
          <p>Four real localities, four different reasons to check them, see what each report actually surfaces.</p>
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
                      {sample.name && (
                        <p className="ps-person-name">{sample.name}</p>
                      )}
                      <span className="ps-role">{persona.label}</span>
                      <div className="ps-checking-label mono">CHECKING FOR</div>
                      <ul className="ps-checking">
                        {sample.checking.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                      <p className="ps-take">{sample.take}</p>

                      {sample.reportUrl ? (
                        <a className="ps-report-link" href={sample.reportUrl} target="_blank" rel="noreferrer">
                          View sample report
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                        </a>
                      ) : (
                        <button type="button" className="ps-report-link ps-report-link-pending" disabled title="Sample report coming soon">
                          View sample report - coming soon
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                        </button>
                      )}
                    </div>

                    <div className="hero-score-card ps-score-card">
                      <div className="hsc-head">
                        <span className="hsc-label">BlindSpot Score</span>
                        <span className={`hsc-badge${sample.caution ? ' hsc-badge-caution' : ''}`}>{sample.verdictLabel}</span>
                      </div>
                      <div className="hsc-number">{sample.combined}<span>/100</span></div>
                      <p className="hsc-verdict">{sample.summary}</p>
                      <div className="hsc-row">
                        <div className="hsc-item slate">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>
                          <div>
                            <span className="hsc-item-label">Safe, well-connected area</span>
                            <span className="hsc-item-sub">{sample.place} - {sample.neighbourhood}/100</span>
                          </div>
                        </div>
                        <div className="hsc-item sun">
                          <svg className="hsc-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M4 20 L10 14 M20 20 L14 14"/></svg>
                          <div>
                            <span className="hsc-item-label">Bright, well-ventilated unit</span>
                            <span className="hsc-item-sub">Floor {sample.floor}, {sample.facingAbbr} - {sample.homeComfort}/100</span>
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
