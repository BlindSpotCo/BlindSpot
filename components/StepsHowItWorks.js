'use client';
// components/StepsHowItWorks.js
// V2 -- swapped the plain "01/02/03" mono numerals for an icon badge per
// step (search / split-score / verdict-check) sitting on a connecting
// rail, and cut each step's copy down to one short line instead of a
// full sentence -- same real 3-step flow, less to read to get it.

import PinDropTransition from '@/components/PinDropTransition';
import { coverageLabel } from '@/lib/aslivastu/cityMeta';

const STEPS = [
  {
    accent: 'av',
    title: 'Search an address',
    copy: coverageLabel() + ', more cities coming.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    ),
  },
  {
    accent: 'ss',
    title: 'Get both scores',
    copy: 'Area, then the exact floor and facing.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="6" height="11" rx="1"/><rect x="15" y="5" width="6" height="16" rx="1"/><rect x="9" y="14" width="6" height="7" rx="1"/></svg>
    ),
  },
  {
    accent: 'brand',
    title: 'See your verdict',
    copy: 'One score. Recommended, or not.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>
    ),
  },
];

export default function StepsHowItWorks() {
  return (
    <section className="section section-dark reveal" id="how-it-works">
      <div className="sd-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">03 - How It Works</span>
            <h2>Three steps. No <span className="gold-word">broker</span> required.</h2>
          </div>
        </div>

        <div className="hiw3-rail">
          {STEPS.map((s) => (
            <div key={s.title} className={`hiw3-step accent-${s.accent}`}>
              <span className="hiw3-badge">{s.icon}</span>
              <h3>{s.title}</h3>
              <p>{s.copy}</p>
            </div>
          ))}
        </div>

        <div className="hiw2-cta">
          <PinDropTransition href="/property-score" className="btn btn-lg btn-cta">
            Uncover Your BlindSpot <span className="btn-cta-arrow">→</span>
          </PinDropTransition>
        </div>
      </div>
    </section>
  );
}
