// app/contact/page.js -- Contact us. The phone and registered address
// come from components/LegalPage.js and only show once they're filled in.

import Link from 'next/link';
import LegalPage, { COMPANY, CONTACT_EMAIL, CONTACT_PHONE, REGISTERED_ADDRESS } from '@/components/LegalPage';

export const metadata = {
  title: 'Contact us',
  description: 'How to reach the BlindSpot team.',
  alternates: { canonical: '/contact' },
};

const sections = [
  {
    id: 'reach',
    title: 'Reach us',
    body: (
      <>
        <ul className="legal-contact">
          <li><span>Email</span><span><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></span></li>
          {CONTACT_PHONE && (
            <li><span>Phone</span><span><a href={`tel:${CONTACT_PHONE.replace(/\s+/g, '')}`}>{CONTACT_PHONE}</a></span></li>
          )}
          <li><span>Company</span><span>{COMPANY}</span></li>
          {REGISTERED_ADDRESS && (
            <li><span>Registered office</span><span>{REGISTERED_ADDRESS}</span></li>
          )}
        </ul>
        <p>We reply to every email, usually within one working day.</p>
      </>
    ),
  },
  {
    id: 'what',
    title: 'What to write to us about',
    body: (
      <ul>
        <li><strong>Payments and Keys:</strong> include the payment ID from your Razorpay receipt. See <Link href="/refunds">Cancellation &amp; refunds</Link>.</li>
        <li><strong>A number that looks wrong:</strong> tap the small &quot;report&quot; button next to it, or email us the address and what you expected.</li>
        <li><strong>Your account or data:</strong> email from the address on your account. See our <Link href="/privacy">Privacy policy</Link>.</li>
        <li><strong>Anything else:</strong> ideas, bugs, partnerships. The feedback box at the bottom of the home page reaches us too.</li>
      </ul>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      intro="Questions about a report, a payment or your account. We read everything."
      sections={sections}
      current="/contact"
      updated={false}
    />
  );
}
