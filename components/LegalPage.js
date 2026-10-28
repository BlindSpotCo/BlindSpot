// components/LegalPage.js
//
// Shared layout for /privacy and /terms: site header, a narrow readable
// column, a contents list, and a footer line linking the two pages.
// Plain words on purpose -- these pages should be readable by the people
// using BlindSpot, not only by lawyers.

import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

// The registered business name, used on both pages.
export const COMPANY = 'BlindSpot LLP';
export const CONTACT_EMAIL = 'agblindspot@gmail.com';
export const EFFECTIVE = '28 October 2026';

export default function LegalPage({ title, intro, sections, other }) {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        <p className="legal-eyebrow">Last updated {EFFECTIVE}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>

        <nav className="legal-toc" aria-label="On this page">
          <ol>
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="legal-sec">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        <p className="legal-foot">
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          {' '}See also our <Link href={other.href}>{other.label}</Link>.
        </p>
      </main>
    </>
  );
}
