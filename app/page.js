'use client';

import { useEffect } from 'react';
import SiteHeader from '@/components/SiteHeader';
import HeroLiveMap from '@/components/HeroLiveMap';
import ProblemSolution from '@/components/ProblemSolution';
import TwoScores from '@/components/TwoScores';
import StepsHowItWorks from '@/components/StepsHowItWorks';
import FAQSection from '@/components/FAQSection';
import ClosingCTA from '@/components/ClosingCTA';

export default function Home() {
  // Auth state, scroll-reveal and the mobile menu all now live in
  // SiteHeader (shared across every page) — this file only needs the
  // hero's own coordinate-readout ref.

  // Reveal-on-scroll for .reveal elements — same behavior as the original.
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;
    if (!('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const seenByParent = {};
    const revealTimers = [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          // Every top-level .reveal section is a direct child of body, so keying
      // on the parent's className gave them all the same key and one shared
      // counter -- the last section, and the whole footer with it, sat at
      // opacity:0 for 450ms after coming into view. Stagger within a group,
      // not across the page.
      const parent = el.parentElement;
      const parentKey = parent && parent !== document.body ? (parent.className || 'g') : `top:${el.className}`;
          const delayIndex = seenByParent[parentKey] || 0;
          seenByParent[parentKey] = delayIndex + 1;
          revealTimers.push(setTimeout(() => el.classList.add('in-view'), delayIndex * 90));
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
    return () => { io.disconnect(); revealTimers.forEach(clearTimeout); };
  }, []);

  return (
    <>
      <SiteHeader />

      {/* ===== HERO -- the map itself is the hero =====
          Live Leaflet map (CartoDB Dark Matter tiles), search bar
          floating on top, real /api/sunscout/geocode-suggest results.
          Selecting a result flies in, drops a pin, and reveals a few
          preview insight chips -- everything lives in
          components/HeroLiveMap.js / HeroLiveMapCanvas.js so this file
          only has to mount it. Untouched by the site redo below --
          this section was already polished separately. */}
      <section className="hero hero-statement">
        <HeroLiveMap />
      </section>

      {/* ===== THE REST OF THE PAGE -- redone from scratch =====
          Five sections, each its own component: the problem/solution
          framing, the two real scoring engines explained, the 3-step
          flow, an FAQ, and the closing CTA + footer. The team used to
          be its own sixth section here -- moved into ClosingCTA's
          footer instead (see that file's top comment for why). */}
      <ProblemSolution />
      <TwoScores />
      <StepsHowItWorks />
      <FAQSection />
      <ClosingCTA />
    </>
  );
}
