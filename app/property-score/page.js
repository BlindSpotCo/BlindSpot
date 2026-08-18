import SiteHeader from '@/components/SiteHeader';
import PropertyScoreFlow from '@/components/property-score/PropertyScoreFlow';

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
export default function PropertyScorePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <PropertyScoreFlow />
    </div>
  );
}
