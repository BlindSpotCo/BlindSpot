'use client';
// components/StepsHowItWorks.js
// "How it works," redone as a plain 3-step flow instead of the old
// scroll-driven, tab-synced interactive walkthrough (components/HowItWorks.js,
// now removed from the homepage) -- same real 3-step product flow
// (area -> unit -> verdict) that CombinedScoreFlow actually runs, just
// told in three sentences instead of three full mock panels.

import PinDropTransition from '@/components/PinDropTransition';
import { coverageLabel } from '@/lib/aslivastu/cityMeta';

const STEPS = [
  {
    n: '01',
    accent: 'av',
    title: 'Search an address',
    copy: 'Type any address or locality. Works across ',
    trailing: ', more cities coming.',
  },
  {
    n: '02',
    accent: 'ss',
    title: 'Get both scores',
    copy: 'Neighbourhood Score for the area, Home Comfort Score for that exact floor and facing.',
  },
  {
    n: '03',
    accent: 'brand',
    title: 'See your verdict',
    copy: 'One BlindSpot Score, a plain-English recommendation, and the specific blindspots for that property.',
  },
];

export default function StepsHowItWorks() {
  return (
    <section className="section reveal" id="how-it-works">
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">03 - How It Works</span>
            <h2>Three steps. No broker required.</h2>
          </div>
          <p>The same flow every report on this site runs, start to finish.</p>
        </div>

        <div className="hiw2-steps">
          {STEPS.map((s) => (
            <div key={s.n} className={`hiw2-step accent-${s.accent}`}>
              <span className="mono hiw2-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>
                {s.copy}
                {s.n === '01' && <strong>{coverageLabel()}</strong>}
                {s.trailing}
              </p>
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
