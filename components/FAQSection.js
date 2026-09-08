'use client';
// components/FAQSection.js
// Every answer is a real fact about the actual product (free to search,
// no login required for a score, government-record + solar-geometry
// sourcing, live coverage via coverageLabel(), 50/50 adjustable
// weighting) -- no invented stats.
//
// v2 -- two changes:
// 1. Each row got its own `.reveal` class so the list would cascade in
//    on scroll -- but .reveal's "in-view" class is added imperatively
//    (classList.add, in page.js's IntersectionObserver) straight to the
//    DOM node, and this component re-renders EVERY row whenever `open`
//    changes (clicking any question re-renders the whole list, and the
//    row whose isOpen flips gets a genuinely new className string).
//    React then reapplies that row's className from scratch, wiping
//    the manually-added "in-view" class the observer had set --
//    exactly what made rows silently go transparent after any click,
//    not just the one you opened. Reveal now lives on the outer
//    <section> only (untouched by `open`, so it's safe), and the list
//    cascades in via pure CSS keyed off .section-tint.in-view instead
//    (see .faq2-item in globals.css) -- nothing here mutates a row's
//    classList imperatively, so there's nothing for a re-render to
//    stomp on.
// 2. Added a small numbered badge per row (alternating the same --av/
//    --ss accents as every other section) that lights up on open --
//    was just a plain text list before.

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
    <section className="section section-tint reveal">
      <div className="st-grain" aria-hidden="true" />
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
            const accent = i % 2 === 0 ? 'av' : 'ss';
            return (
              <div key={item.q} className={`faq2-item accent-${accent}${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="faq2-q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span className="faq2-q-left">
                    <span className="faq2-num">{String(i + 1).padStart(2, '0')}</span>
                    <span>{item.q}</span>
                  </span>
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
