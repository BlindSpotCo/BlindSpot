// components/LegalPage.js
//
// Shared layout for the legal and company pages (privacy, terms, refunds,
// shipping, contact, about): site header, a narrow readable column, a
// contents list, and a footer line linking all of them.
// Plain words on purpose -- these pages should be readable by the people
// using BlindSpot, not only by lawyers.

import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

// The registered business name, used on both pages.
export const COMPANY = 'BlindSpot LLP';
export const CONTACT_EMAIL = 'agblindspot@gmail.com';
// Fill these in before applying to Razorpay -- it asks for a phone number
// and the registered address on the Contact page. Left empty, the Contact
// page simply doesn't show those lines (it never shows a placeholder).
export const CONTACT_PHONE = '';
export const REGISTERED_ADDRESS = '';
export const EFFECTIVE = '30 October 2026';

// Every page in this family, in footer order.
export const LEGAL_LINKS = [
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact us' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/refunds', label: 'Cancellation & refunds' },
  { href: '/shipping', label: 'Shipping & delivery' },
];

export default function LegalPage({ title, intro, sections, current, updated = true }) {
  return (
    <>
      <SiteHeader />
      <main className="legal">
        {updated && <p className="legal-eyebrow">Last updated {EFFECTIVE}</p>}
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>

        {sections.length > 2 && (
          <nav className="legal-toc" aria-label="On this page">
            <ol>
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
              ))}
            </ol>
          </nav>
        )}

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="legal-sec">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        <p className="legal-foot">
          Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <nav className="legal-links" aria-label="Company and policies">
          {LEGAL_LINKS.filter((l) => l.href !== current).map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
      </main>
    </>
  );
}
