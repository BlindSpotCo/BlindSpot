// app/refunds/page.js -- Cancellation and refunds. Shared layout in
// components/LegalPage.js. Keep this in step with lib/paywall/config.js
// (packs, Key cost) and with what the payment code actually does.

import Link from 'next/link';
import LegalPage, { COMPANY, CONTACT_EMAIL } from '@/components/LegalPage';
import { KEY_COST } from '@/lib/paywall/config';

export const metadata = {
  title: 'Cancellation & refunds',
  description: 'When you can get your money back for BlindSpot Keys, and how.',
  alternates: { canonical: '/refunds' },
};

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections = [
  {
    id: 'short',
    title: 'The short version',
    body: (
      <ul>
        <li>Unused Keys from a pack can be refunded within 7 days of buying it.</li>
        <li>Keys already spent on a report that was delivered can&apos;t be refunded.</li>
        <li>If a report fails or comes out broken, we give you the Keys back or refund them.</li>
        <li>Refunds go back to the way you paid, usually within 5 to 7 working days.</li>
      </ul>
    ),
  },
  {
    id: 'what',
    title: 'What you buy',
    body: (
      <p>
        You buy Keys in packs (see <Link href="/pricing">Pricing</Link>). Each report costs{' '}
        {KEY_COST.report} Keys. Keys are a digital credit with {COMPANY}: they aren&apos;t money,
        can&apos;t be transferred or cashed out, and only work on blindspot.properties.
      </p>
    ),
  },
  {
    id: 'unused',
    title: 'Refunds for unused Keys',
    body: (
      <>
        <p>
          Changed your mind? Email {mail}{' '}within 7 days of buying a pack, from the email on your
          account, and we&apos;ll refund the Keys from that pack you haven&apos;t used.
        </p>
        <p>
          We refund per Key at the price you paid for that pack. For example, if you bought the
          Basic pack (6 Keys) and used 2, we refund the other 4 Keys. After 7 days, unused Keys
          stay in your account to use later but can&apos;t be refunded.
        </p>
      </>
    ),
  },
  {
    id: 'used',
    title: 'Keys you have spent',
    body: (
      <p>
        A report is made and delivered to you straight away, so Keys spent on a report that
        worked can&apos;t be refunded. A report you&apos;ve already unlocked opens again for free:
        you never pay twice for the same report on the same flat.
      </p>
    ),
  },
  {
    id: 'failed',
    title: 'When a report goes wrong',
    body: (
      <p>
        If you spent Keys and the report didn&apos;t generate, didn&apos;t open, or came out
        broken or blank, email {mail}{' '}with the address and roughly when it happened. We&apos;ll
        give the Keys back to your account, or refund them if you prefer, within 2 working days.
      </p>
    ),
  },
  {
    id: 'cancel',
    title: 'Cancelling',
    body: (
      <p>
        There&apos;s no subscription, so there&apos;s nothing to cancel and you&apos;re never
        charged again automatically. You only pay when you choose to buy a pack.
      </p>
    ),
  },
  {
    id: 'how',
    title: 'How refunds are paid',
    body: (
      <>
        <p>
          Payments are handled by Razorpay. Approved refunds go back to the card, UPI account,
          wallet or bank account you paid with. Razorpay usually completes them in 5 to 7
          working days; your bank may take a little longer to show it.
        </p>
        <p>
          If a payment went through but no Keys arrived, or you were charged twice, email us with
          the payment ID from your Razorpay receipt and we&apos;ll sort it out.
        </p>
      </>
    ),
  },
];

export default function RefundsPage() {
  return (
    <LegalPage
      title="Cancellation & refunds"
      intro="When you can get your money back for Keys, and how long it takes."
      sections={sections}
      current="/refunds"
    />
  );
}
