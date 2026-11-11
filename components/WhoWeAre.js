// components/WhoWeAre.js
//
// "Who's behind BlindSpot" - real people, a real registered company and a
// way to reach them. A buyer about to trust a score on the biggest
// purchase of their life wants to know who made it.
//
// Founder lines are from the founders' own pitch script (Nov 2026), in
// their words. Built together: one shared closing line, no split of who
// built what.
//
// Not added on purpose:
//  - mentors' names: only with each mentor's OK to be named publicly
//  - BITS Pilani NVC: means nothing to a homebuyer (investor/jury only)
//  - photos: initials until real founder photos are added to /public
//    (set `photo: '/team/<file>.jpg'` below once they are)

import Link from 'next/link';
import { COMPANY, CONTACT_EMAIL } from '@/components/LegalPage';

const FOUNDERS = [
  {
    name: 'Arushri Gangji',
    initials: 'AG',
    line: 'When my parents were buying a house, their biggest worry was whether the balcony would actually get sunlight.',
    linkedin: 'https://www.linkedin.com/in/arushri-gangji-056108381/',
    photo: null,
  },
  {
    name: 'Gurshaan Singh Baweja',
    initials: 'GB',
    line: 'My grandfather and my father have spent over 30 years in real estate. I grew up around this problem.',
    linkedin: 'https://www.linkedin.com/in/gurshaan-singh-baweja',
    photo: null,
  },
];

export default function WhoWeAre() {
  return (
    <section className="section section-tint reveal" id="who-we-are">
      <div className="st-grain" aria-hidden="true" />
      <div className="wrap section-inner">
        <div className="section-head">
          <div>
            <span className="eyebrow">05 - Who&apos;s Behind It</span>
            <h2>The people behind every <span className="gold-word">score</span>.</h2>
          </div>
        </div>

        <div className="who-grid">
          {FOUNDERS.map((f) => (
            <div key={f.name} className="who-card reveal">
              {f.photo
                ? <img className="who-avatar" src={f.photo} alt={f.name} />
                : <span className="who-avatar" aria-hidden="true">{f.initials}</span>}
              <div>
                <p className="who-name">{f.name}</p>
                <p className="who-role mono">Co-founder</p>
                <p className="who-line">&ldquo;{f.line}&rdquo;</p>
                <a className="who-link" href={f.linkedin} target="_blank" rel="noopener">
                  LinkedIn <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="who-together reveal">
          We built BlindSpot together so every homebuyer in India can know their home&apos;s blindspot before making the final decision.
        </p>

        <ul className="who-facts reveal">
          <li><span className="mono">Company</span>{COMPANY}, registered in India</li>
          <li><span className="mono">Email</span><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
          <li><span className="mono">Contact</span><Link href="/contact">All the ways to reach us</Link></li>
        </ul>
      </div>
    </section>
  );
}
