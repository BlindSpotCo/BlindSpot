import SiteHeader from '@/components/SiteHeader';
import PropertyScoreFlow from '@/components/property-score/PropertyScoreFlow';
import { buildLocalitiesByCity, findLocality } from '@/lib/aslivastu/localities';

export const metadata = {
  title: 'Property Score',
  description: 'One score for the neighbourhood, one score for the flat — combined into a single verdict, weighted your way.',
  alternates: { canonical: '/property-score' },
  openGraph: { title: 'Property Score | BlindSpot', description: 'One score for the neighbourhood, one score for the flat — combined into a single verdict, weighted your way.' },
};

// The old "Combined Verdict" intro block now lives inside
// PropertyScoreFlow.js, paired side-by-side with the persona dial in a
// two-column layout (same .hero-grid pattern as the homepage) instead of
// two separate full-width sections stacked on top of each other.
//
// "Continue to Sun Score" (NeighbourhoodReport.js's hand-off, for the case
// where that report has no window.opener to postMessage back into and
// navigates here instead, e.g. a bookmarked/reopened report) resolves the
// pin server-side, here, before PropertyScoreFlow ever mounts client-side.
// The alternative -- resolving it client-side after mount -- is what used
// to make this land on the plain top-of-page threshold screen for a beat
// (a network round trip to /api/av-localities) before smooth-scrolling
// itself down to the Unit step once the fetch resolved. Handing the
// already-resolved record down as a prop means the very first paint
// already has the Unit section in place, so the client only needs to jump
// the scroll position there -- no fetch, no visible "opens at the top"
// moment first.
export default async function PropertyScorePage({ searchParams }) {
  const sp = await searchParams;
  let initialUnit = null;
  if (sp?.continue === 'unit' && sp?.pin) {
    try {
      const byCity = buildLocalitiesByCity();
      const sector = sp.sector != null ? Number(sp.sector) : null;
      const record = findLocality(byCity, {
        pin: sp.pin,
        city: sp.city || null,
        sector: Number.isFinite(sector) ? sector : null,
      });
      if (record) initialUnit = { record, city: record.city };
    } catch { /* falls through to a normal, un-prefilled flow */ }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <PropertyScoreFlow initialUnit={initialUnit} />
    </div>
  );
}
