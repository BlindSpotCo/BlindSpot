'use client';
// components/FAQSection.js
// Every answer is a real fact about the actual product (free to search,
// no login required for a score, government-record + solar-geometry
// sourcing, live coverage via coverageLabel(), the per-window room-photo
// analysis) -- no invented stats.
//
// v4 -- "Can I change how much the area matters vs. the unit itself?"
// claimed a manual 50/50 weighting toggle that ReportScreen.js had
// already removed (areaWeight is now a hardcoded 0.5 there, see that
// file's own comment) -- so the FAQ was advertising a control that no
// longer exists. Swapped for a question about the room-photo window
// analysis (RoomPhotoAnalyzer.js / app/api/sunscout/room-photo/analyse),
// a real, currently-live feature the old FAQ never mentioned at all.
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
//
// v3 -- the section as a whole read as flat (grey text, hairline rules,
// no colour or texture until you actually click something), and
// coverageLabel() -- Currently Bangalore, Chandigarh... with more cities
// coming -- doubled as data (the "which cities" question) and, unused
// everywhere else, string formatting that had nothing else to do here.
// 1. The header now fills the second half of .section-head's own
//    flex row (every section has this space; nothing on the page
//    actually used it before) with a short line previewing what's
//    below -- real content, not spacing.
// 2. "Which cities are covered" now renders KNOWN_CITIES as chips
//    instead of a joined sentence -- an honest, glance-able answer
//    instead of one more paragraph to read.
// 3. The open row gets a faint accent-tinted background (its own
//    accent-av/accent-ss, same pair as the number badge) so opening a
//    question gives it some visual weight, not just more grey text.

import { useState } from 'react';
import { KNOWN_CITIES } from '@/lib/aslivastu/cityMeta';

function useFaqItems() {
  return [
    {
      q: 'Is BlindSpot free?',
      a: 'Yes, both scores. Sign in only if you want the report saved.',
    },
    {
      q: 'Where does the data actually come from?',
      a: "The area half is government records - police, CPCB, DISCOM, municipal surveys, CBSE listings - scored by zone, so neighbouring pincodes often land close. Schools are the exception, matched address by address. The flat half is solar geometry for the floor and facing you pick. Nothing broker-supplied either way.",
    },
    {
      q: 'Which cities are covered?',
      a: 'Full Neighbourhood Score coverage in these five. The flat half works anywhere - it is geometry, not records.',
      cities: KNOWN_CITIES,
    },
    {
      q: 'How is this different from asking a broker?',
      a: "A broker earns on the flat they show you. We earn nothing either way, so the number is the same for the one they're pushing and the one next door.",
    },
    {
      q: 'Can it tell me about one specific room, not just the whole flat?',
      a: "Yes. Upload a room photo and the direction you faced - every window in it gets its own sun and heat numbers, not the flat\'s overall facing. AI only finds the windows; the numbers come from the same solar model.",
    },
    {
      q: 'How accurate are the sun numbers?',
      a: "They are geometry, not forecast: the real sun path for that date against OpenStreetMap building footprints and heights around the pin. That means shadow from the tower next door is modelled; cloud cover on any given day is not.",
    },
  ];
}

export default function FAQSection() {
  const items = useFaqItems();
  const [open, setOpen] = useState(0);

  return (
    <section className="section section-tint reveal">
      <div className="st-grain" aria-hidden="true" />
      {/* Heading beside the questions, not stacked above them. Stacked,
          the list ran at 760px down the left of a 1440px section with
          the whole right half empty, and the section was taller than it
          had any reason to be. */}
      <div className="wrap section-inner faq2-wrap">
        <div className="section-head faq2-head">
          <div>
            <span className="eyebrow">03 - Questions</span>
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
                  <div className="faq2-a">
                    <p>{item.a}</p>
                    {item.cities && (
                      <div className="faq2-chips">
                        {item.cities.map((c) => (
                          <span key={c} className="faq2-chip">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
