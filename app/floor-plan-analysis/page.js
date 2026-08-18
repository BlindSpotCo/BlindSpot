import FloorPlanAnalysis from '@/components/floor-plan/FloorPlanAnalysis';

export const metadata = {
  title: 'Furnishing Advisor',
  description: 'Upload a floor plan and get room-by-room furniture and placement suggestions.',
  alternates: { canonical: '/floor-plan-analysis' },
  openGraph: { title: 'Furnishing Advisor | BlindSpot', description: 'Upload a floor plan and get room-by-room furniture and placement suggestions.' },
};

export default function FloorPlanAnalysisPage() {
  return <FloorPlanAnalysis />;
}
