import SiteHeader from '@/components/SiteHeader';
import PricingView from '@/components/paywall/PricingView';

export const metadata = {
  title: 'Pricing · BlindSpot',
  description:
    'Pay per property, not per month. Keys unlock the detailed neighbourhood report, the year-round sunlight report and the full BlindSpot report for a flat.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <PricingView />
    </>
  );
}
