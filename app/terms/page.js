// app/terms/page.js -- Terms of use. Shared layout in components/LegalPage.js.

import Link from 'next/link';
import LegalPage, { COMPANY, CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of use',
  description: 'The rules for using BlindSpot, and what our reports are and aren’t.',
  alternates: { canonical: '/terms' },
};

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections = [
  {
    id: 'agree',
    title: 'Agreeing to these terms',
    body: (
      <p>
        These terms are an agreement between you and {COMPANY}, which runs blindspot.properties.
        By using the site, you agree to them. If you don&apos;t agree, please don&apos;t use
        BlindSpot. You need to be at least 18 to create an account.
      </p>
    ),
  },
  {
    id: 'what',
    title: 'What BlindSpot is, and isn’t',
    body: (
      <>
        <p>
          BlindSpot gives you information to help you research a home: neighbourhood scores built
          from government records, and sun, heat and light estimates built from the sun&apos;s path
          and the buildings around a flat. Some of the report text is written by AI.
        </p>
        <p>
          <strong>It&apos;s a research aid, not professional advice.</strong>{' '}A report is not a
          property survey, structural inspection, legal or title check, valuation, or financial
          advice. Government data can be out of date or incomplete. Sun and heat numbers are
          estimates that don&apos;t include daily weather, and AI-written text can get things wrong.
        </p>
        <p>
          Before you buy or rent, visit the home, check its documents, and talk to the right
          professionals. You&apos;re responsible for the decisions you make. If something in a
          report looks wrong, tap the small &quot;report&quot; button next to it, or use the feedback
          box at the bottom of the home page, and we&apos;ll look into it.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <p>
        Keep your sign-in details to yourself. You&apos;re responsible for what happens under your
        account. Tell us at {mail} if you think someone else has used it.
      </p>
    ),
  },
  {
    id: 'rules',
    title: 'Using BlindSpot fairly',
    body: (
      <>
        <p>Please don&apos;t:</p>
        <ul>
          <li>scrape, bulk-download or automate requests to the site or its data;</li>
          <li>copy, resell or republish our scores or reports as a dataset or competing service;</li>
          <li>try to break, overload, or get around the limits and security of the site, including its payments and Keys;</li>
          <li>upload anything illegal, or photos you don&apos;t have the right to share, such as photos of other people or their private documents;</li>
          <li>use BlindSpot to mislead others, for example by passing off an edited report as ours.</li>
        </ul>
        <p>We may limit or close access for anyone who does.</p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your uploads and feedback',
    body: (
      <p>
        Photos and floor plans you upload stay yours. You let us process them, including sending
        them to the services listed in our <Link href="/privacy">privacy policy</Link>, so we can
        build your report. If you send feedback or suggestions, we may use them to improve
        BlindSpot without owing you anything for them.
      </p>
    ),
  },
  {
    id: 'ours',
    title: 'Our content and data sources',
    body: (
      <p>
        The site, its design, scores and report text belong to {COMPANY}. You can save and share
        your own reports for personal use, such as sending one to family. Map and source data
        belongs to its owners, including © OpenStreetMap contributors, Esri and its imagery
        providers, CARTO, and the government bodies whose public records we use.
      </p>
    ),
  },
  {
    id: 'price',
    title: 'Prices, Keys and payment',
    body: (
      <>
        <p>
          Searching, both scores, the 3D sun map, the visit checklist and comparing flats are
          free. Detailed written reports cost Keys, which you buy in packs. Current packs and the
          Key cost of each report are on the <Link href="/pricing">Pricing</Link> page.
        </p>
        <ul>
          <li>Prices are in Indian rupees and shown before you pay. Every paid button shows its Key cost, and nothing is spent until you confirm.</li>
          <li>Payments are processed by Razorpay. We never see or store your full card or bank details.</li>
          <li>Keys are a credit for BlindSpot reports only. They aren&apos;t money, can&apos;t be transferred, sold or exchanged for cash, and don&apos;t expire while your account is open.</li>
          <li>A report you&apos;ve unlocked opens again for free. There&apos;s no subscription and no automatic charge.</li>
          <li>Refunds follow our <Link href="/refunds">Cancellation &amp; refunds</Link> policy.</li>
        </ul>
        <p>
          We may change prices or packs. A change never affects Keys you&apos;ve already bought.
          Keys obtained through a bug, a fraudulent payment or a chargeback may be removed.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Changes and availability',
    body: (
      <p>
        We&apos;re a small team and we change BlindSpot often. Features may change or stop, and
        the site may sometimes be down. We&apos;ll try to give notice before removing something
        that affects your saved reports.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Our responsibility to you',
    body: (
      <>
        <p>
          BlindSpot is provided &quot;as is&quot;. As far as the law allows, we don&apos;t promise that
          reports are complete, accurate or right for your purpose. We aren&apos;t responsible for
          losses caused by decisions made using a report, or for indirect losses such as lost
          money on a property deal.
        </p>
        <p>
          If we are found responsible for something, our total liability is limited to the amount
          you paid us in the 12 months before the claim. Nothing in these terms takes away rights
          you have under Indian consumer protection law that can&apos;t be waived.
        </p>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: (
      <p>
        You can stop using BlindSpot at any time, and ask us to delete your account at {mail}. We
        may suspend or close accounts that break these terms.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Law and disputes',
    body: (
      <p>
        These terms are governed by the laws of India. If there&apos;s a problem, please email us
        first and we&apos;ll try to sort it out. If we can&apos;t, the courts of India will decide.
      </p>
    ),
  },
  {
    id: 'updates',
    title: 'Changes to these terms',
    body: (
      <p>
        If we change these terms, we&apos;ll update the date at the top. Using BlindSpot after a
        change means you accept the new terms. For big changes, we&apos;ll tell signed-in users
        first.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="The rules for using BlindSpot, and what our reports can and can’t tell you."
      sections={sections}
      current="/terms"
    />
  );
}
