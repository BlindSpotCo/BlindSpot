'use client';
// components/FAQSection.js
// New section, wasn't on the page before. Every answer is a real fact
// about the actual product (free to search, no login required for a
// score, government-record + solar-geometry sourcing, live coverage via
// coverageLabel(), 50/50 adjustable weighting) -- no invented stats.

import { useState } from 'react';
import { coverageLabel } from '@/lib/aslivastu/cityMeta';

function useFaqItems() {
  return [
    {
      q: 'Is BlindSpot free?',
      a: 'Yes. Search an address and see both scores at no cost. Sign in only if you want to save a report under My Reports.',
    },
    {
      q: 'Where does the data actually come from?',
      a: 'The Neighbourhood Score comes from government records — police, CPCB live AQI, DISCOM power data, municipal water and road surveys, CBSE school listings. The Home Comfort Score comes from real solar-geometry modelling for the floor and facing you pick — not broker-supplied information either way.',
    },
    {
      q: 'Which cities are covered?',
      a: `Currently ${coverageLabel()}, with more cities coming.`,
    },
    {
      q: 'How is this different from asking a broker?',
      a: "BlindSpot has no stake in any specific listing — the score doesn't change based on who's selling, and it's the same number whether you ask about the flat they're pushing or the one next door.",
    },
    {
      q: 'Can I change how much the area matters vs. the unit itself?',
      a: 'Yes. The two scores start weighted 50/50 into your BlindSpot Score, and you can drag that balance yourself if the neighbourhood matters more to you than the sunlight, or the other way round.',
    },
  ];
}

export default function FAQSection() {
  const items = useFaqItems();
  const [open, setOpen] = useState(0);

  return (
    <section className="section section-dark reveal">
      <div className="sd-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">05 - Questions</span>
            <h2>Before you <span className="gold-word">ask</span>.</h2>
          </div>
        </div>

        <div className="faq2-list">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`faq2-item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="faq2-q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span className="faq2-plus" aria-hidden="true" />
                </button>
                <div className="faq2-a-wrap">
                  <p className="faq2-a">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
