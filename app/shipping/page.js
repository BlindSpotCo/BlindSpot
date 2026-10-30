// app/shipping/page.js -- Shipping and delivery. BlindSpot sells nothing
// physical; this page exists because payment providers ask for it.

import Link from 'next/link';
import LegalPage, { CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Shipping & delivery',
  description: 'BlindSpot is a digital service: nothing is shipped.',
  alternates: { canonical: '/shipping' },
};

const sections = [
  {
    id: 'digital',
    title: 'Nothing is shipped',
    body: (
      <>
        <p>
          BlindSpot is a digital service. Keys and reports are delivered online, instantly, and
          nothing is ever sent to a physical address.
        </p>
        <ul>
          <li><strong>Keys</strong> are added to your account as soon as your payment goes through.</li>
          <li><strong>Reports</strong> are made in your browser, usually in about two minutes, and you can save or download them.</li>
        </ul>
        <p>
          If Keys or a report don&apos;t arrive, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
          or see <Link href="/refunds">Cancellation &amp; refunds</Link>.
        </p>
      </>
    ),
  },
];

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping & delivery"
      intro="Everything BlindSpot sells is digital and delivered instantly."
      sections={sections}
      current="/shipping"
    />
  );
}
