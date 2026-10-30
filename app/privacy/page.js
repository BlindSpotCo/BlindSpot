// app/privacy/page.js -- Privacy policy. Written against what the code
// actually does (see components/LegalPage.js for the shared layout). If
// you add a new service that receives user data, add it to "Who else
// handles it" below.

import LegalPage, { COMPANY, CONTACT_EMAIL } from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy policy',
  description: 'What BlindSpot collects, why, who else handles it, and how to get it deleted.',
  alternates: { canonical: '/privacy' },
};

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const sections = [
  {
    id: 'short',
    title: 'The short version',
    body: (
      <ul>
        <li>You can search and read reports without an account. We only ask you to sign in to save a report.</li>
        <li>We don&apos;t sell your data, show ads, or pass you to brokers, builders or sellers.</li>
        <li>Photos and floor plans you upload are sent to Google&apos;s AI to be analysed. We don&apos;t keep them unless you save a report that includes them.</li>
        <li>You can delete saved reports yourself, and ask us to delete your account at any time.</li>
      </ul>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <h3>Addresses you search</h3>
        <p>
          When you search an address or drop a pin, its location is sent to our servers to build
          the report. If you&apos;re not signed in, it isn&apos;t linked to you.
        </p>
        <h3>Your account</h3>
        <p>
          If you sign up with email, we store your email address and a password. The password is
          stored scrambled (hashed) by our database provider, so we can&apos;t read it. If you sign in
          with Google, Google shares your name, email address and profile picture with us.
        </p>
        <h3>Reports and folders you save</h3>
        <p>
          A saved report holds the address, its scores and text, and the map images in it. If you
          added a room photo or floor plan to that report, it&apos;s saved too. Folder names you
          create are saved with them.
        </p>
        <h3>Photos and floor plans you upload</h3>
        <p>
          These are sent to Google&apos;s Gemini AI to work out rooms, windows and light. Don&apos;t
          upload photos of people, documents or anything private you wouldn&apos;t want analysed.
        </p>
        <h3>Purchases and Keys</h3>
        <p>
          When you buy Keys, we keep a record of the purchase (pack, amount, date, Razorpay payment
          ID), your Key balance, and which reports you&apos;ve unlocked. We need this for receipts,
          refunds and tax records. Your card, UPI or bank details go to Razorpay, not to us.
        </p>
        <h3>Feedback you send</h3>
        <p>
          The footer feedback box and the small &quot;report&quot; buttons next to numbers in a report store your message,
          the page you were on, your browser type, your email if you give it, and your account if
          you&apos;re signed in.
        </p>
        <h3>Usage and technical data</h3>
        <p>
          We use Vercel Analytics to count page visits. It doesn&apos;t use cookies or identify you.
          Our servers see your IP address, like any website. We use it briefly to stop spam and
          abuse (for example, limiting how many feedback messages one connection can send), and our
          hosting provider keeps short-lived logs.
        </p>
        <h3>Cookies and storage in your browser</h3>
        <p>
          We use cookies only to keep you signed in and to bring you back to your report after you
          sign in. The 3D map remembers its last camera angle in your browser. We don&apos;t use
          advertising or tracking cookies.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <ul>
        <li>To build the reports you ask for and save the ones you keep.</li>
        <li>To let you sign in and see your saved reports on any device.</li>
        <li>To reply to you if you sent feedback with your email.</li>
        <li>To fix bugs, correct wrong data, and see which parts of the site get used.</li>
        <li>To keep the service safe from spam, abuse and overload.</li>
      </ul>
    ),
  },
  {
    id: 'others',
    title: 'Who else handles it',
    body: (
      <>
        <p>We use these services to run BlindSpot. Each only gets what it needs for its job:</p>
        <ul>
          <li><strong>Supabase</strong> stores accounts, saved reports, folders and feedback.</li>
          <li><strong>Vercel</strong> hosts the website and counts visits.</li>
          <li><strong>Razorpay</strong> processes payments for Keys. It receives your payment details and the email and phone you give at checkout. We only receive the payment ID, the amount and whether it succeeded, never your full card or bank details.</li>
          <li><strong>Google</strong> handles Google sign-in, writes report text and analyses uploaded photos and floor plans (Gemini), and provides air quality readings for a location.</li>
          <li><strong>Map and weather providers</strong> receive the location being looked up: OpenStreetMap&apos;s Nominatim and Komoot&apos;s Photon (address search), Esri and CARTO (map pictures), OSM Buildings (building heights), and Open-Meteo (weather and air). Some map pictures load straight from these providers, so they see your IP address like any website you visit.</li>
        </ul>
        <p>
          These providers may store data outside India. We&apos;ll also share information if the law
          requires it, or if BlindSpot is ever sold or merged, in which case this policy still
          applies to your data.
        </p>
      </>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>Your account and saved reports: until you delete them or ask us to delete your account.</li>
        <li>Feedback: until we&apos;ve dealt with it and it&apos;s no longer useful for fixing the product.</li>
        <li>Uploaded photos and floor plans you don&apos;t save: not kept by us after the analysis.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your choices and rights',
    body: (
      <>
        <p>
          Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask us to show you the
          personal data we hold about you, correct it, or delete it. You can also withdraw your
          consent, and nominate someone to act for you if you&apos;re unable to.
        </p>
        <p>
          You can delete saved reports and folders yourself from your profile. For anything else,
          including deleting your whole account, email {mail}{' '}from the email address on your
          account. We&apos;ll reply within 30 days.
        </p>
        <p>
          If you&apos;re unhappy with how we handled a request, tell us at the same address. If
          we don&apos;t resolve it, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        BlindSpot is meant for adults researching a home. Please don&apos;t create an account if
        you&apos;re under 18. If we learn that a child has given us personal data, we&apos;ll delete it.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Data travels over encrypted connections, and each saved report can only be read by the
        account that saved it. No system is perfectly secure. If we find out your data has been
        exposed, we&apos;ll tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change this policy, we&apos;ll update the date at the top. If a change affects how
        we use data you&apos;ve already given us, we&apos;ll tell signed-in users before it applies.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        {COMPANY} runs blindspot.properties. For privacy questions and requests, email {mail}.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="What BlindSpot collects when you use it, why, who else handles it, and how to get it deleted."
      sections={sections}
      current="/privacy"
    />
  );
}
