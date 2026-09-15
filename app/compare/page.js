import { Suspense } from 'react';
import SiteHeader from '@/components/SiteHeader';
import CompareStudio from '@/components/compare/CompareStudio';
import { decodeSlots } from '@/lib/compare/derive';

export const metadata = {
  title: 'Compare flats · BlindSpot',
  description:
    'Two or three flats side by side: the sun each one actually gets, the neighbourhood around it, and what the price difference really buys.',
};

export default async function ComparePage({ searchParams }) {
  // The comparison lives in its own URL, so a shared link opens with the
  // properties already in place.
  const sp = await searchParams;
  const initial = decodeSlots(typeof sp?.c === 'string' ? sp.c : null) || [];

  return (
    <>
      {/* The header, like every other page. Without it this page had no
          logo, no navigation, no sign-in state and no way back to the rest
          of the site -- the same gap floor-plan-analysis had. */}
      <SiteHeader />
      <main className="bx-page">
      <div className="bx-wrap">
        <header className="bx-hero">
          <p className="bx-eyebrow">Side by side</p>
          <h1>You&apos;ve shortlisted three.<br /><em>Only one gets the winter sun.</em></h1>
          <p className="bx-sub">
            Point us at the flats you&apos;re choosing between. We measure the light on each one&apos;s
            facade, at its floor, and the neighbourhood around it - then show you what the price
            difference actually buys. No account. Nothing saved.
          </p>
        </header>
        <Suspense fallback={<p className="bx-empty">Loading…</p>}>
          <CompareStudio initial={initial} />
        </Suspense>
        </div>
      </main>
    </>
  );
}
