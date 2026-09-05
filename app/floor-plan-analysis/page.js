import SiteHeader from '@/components/SiteHeader';
import FloorPlanAnalysis from '@/components/floor-plan/FloorPlanAnalysis';

export const metadata = {
  title: 'Furnishing Advisor',
  description: 'Upload a floor plan and get room-by-room furniture and placement suggestions.',
  alternates: { canonical: '/floor-plan-analysis' },
  openGraph: { title: 'Furnishing Advisor | BlindSpot', description: 'Upload a floor plan and get room-by-room furniture and placement suggestions.' },
};

// SiteHeader, same as every other page. This one was the exception, and
// the effect was that arriving here from the Property Score start screen
// dropped you onto a page with no logo, no nav, no sign-in state and no
// link back into the flow -- a dead end you could only leave with the
// browser's own Back button.
export default function FloorPlanAnalysisPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <FloorPlanAnalysis />
    </div>
  );
}
