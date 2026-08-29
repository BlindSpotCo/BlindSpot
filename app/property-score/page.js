import SiteHeader from '@/components/SiteHeader';
import PropertyScoreFlow from '@/components/property-score/PropertyScoreFlow';
import { buildLocalitiesByCity, findLocality } from '@/lib/aslivastu/localities';

export const metadata = {
  title: 'Property Score',
  description: 'One score for the neighbourhood, one score for the flat — combined into a single verdict, weighted your way.',
  alternates: { canonical: '/property-score' },
  openGraph: { title: 'Property Score | BlindSpot', description: 'One score for the neighbourhood, one score for the flat — combined into a single verdict, weighted your way.' },
};

// PropertyScoreFlow.js is the whole Your Angle / Location / Unit /
// Verdict flow, as 4 single-screen tabs rather than one long scroll.
//
// "Continue to Sun Score" (NeighbourhoodReport.js's hand-off, for the case
// where that report has no window.opener to postMessage back into and
// navigates here instead, e.g. a bookmarked/reopened report) resolves the
// pin server-side, here, before PropertyScoreFlow ever mounts client-side,
// and hands it down as initialUnit so the flow's very first render already
// opens on the Unit tab with that pin picked -- no client-side fetch, no
// flash of Your Angle first.
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
