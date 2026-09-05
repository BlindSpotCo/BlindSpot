import SiteHeader from '@/components/SiteHeader';
import PropertyScoreFlow from '@/components/property-score/PropertyScoreFlow';
import { buildLocalitiesByCity, findLocality } from '@/lib/aslivastu/localities';

export const metadata = {
  title: 'Property Score',
  description: 'One score for the neighbourhood, one score for the flat, combined into a single verdict, weighted your way.',
  alternates: { canonical: '/property-score' },
  openGraph: { title: 'Property Score | BlindSpot', description: 'One score for the neighbourhood, one score for the flat, combined into a single verdict, weighted your way.' },
};

// PropertyScoreFlow.js is the whole Your Angle / Location / Unit /
// Verdict flow, as 4 single-screen tabs rather than one long scroll.
//
// Every tab keeps the URL in sync with what's selected (see
// PropertyScoreFlow.js's own comment on the sync effect), so a reload --
// or a bookmarked/shared link -- lands back on the same tab with the
// same persona/location/unit already filled in, instead of starting the
// four steps over from Your Angle. This is where that URL gets read back
// on the way in: a pin-based (locality-mode) selection gets resolved to
// its full record server-side, the same way the older "Continue to Sun
// Score" hand-off already did, so the flow's very first render opens
// already-populated -- no client fetch, no flash of an empty tab first.
export default async function PropertyScorePage({ searchParams }) {
  const sp = await searchParams;

  // Back-compat: the older one-shot "Continue to Sun Score" hand-off used
  // ?continue=unit&pin=...  Treat it as shorthand for ?stage=unit&pin=...
  // A bookmarked ?stage=angle (from before Priorities and Location were
  // merged into one screen) maps onto that same merged 'location' stage.
  const rawStage = sp?.continue === 'unit' ? 'unit' : (sp?.stage || null);
  const stage = rawStage === 'angle' ? 'location' : (rawStage === 'priorities' ? 'start' : rawStage);

  let areaRecord = null;
  if (sp?.pin) {
    try {
      const byCity = buildLocalitiesByCity();
      const sector = sp?.sector != null ? Number(sp.sector) : null;
      areaRecord = findLocality(byCity, {
        pin: sp.pin,
        city: sp.city || null,
        sector: Number.isFinite(sector) ? sector : null,
      });
    } catch { /* falls through to a normal, un-prefilled flow */ }
  }

  const initial = {
    stage: stage || null,
    personaId: sp?.persona || null,
    mode: sp?.mode || (areaRecord ? 'locality' : null),
    areaRecord,
    city: areaRecord?.city || sp?.city || null,
    lat: sp?.lat || (areaRecord?.lat ? String(areaRecord.lat) : null),
    lon: sp?.lon || (areaRecord?.lon ? String(areaRecord.lon) : null),
    addressLabel: sp?.addr || areaRecord?.name || null,
    floor: sp?.floor != null && sp.floor !== '' ? Number(sp.floor) : null,
    facing: sp?.facing || null,
  };
  // Nothing at all in the URL -- plain fresh visit, don't force any tab.
  const hasSelection = Boolean(initial.stage || initial.personaId || initial.mode || initial.lat);

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <PropertyScoreFlow initial={hasSelection ? initial : null} />
    </div>
  );
}
