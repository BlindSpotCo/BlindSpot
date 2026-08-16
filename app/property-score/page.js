import SiteHeader from '@/components/SiteHeader';
import PropertyScoreFlow from '@/components/property-score/PropertyScoreFlow';

export const metadata = {
  title: 'Property Score — BlindSpot',
  description: 'Combine AsliVastu\u2019s neighbourhood score with SunScout\u2019s Home Comfort Score into one verdict.',
};

export default function PropertyScorePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />

      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="wrap section-inner" style={{ paddingBottom: 40 }}>
          <span className="hero-eyebrow">Combined Verdict</span>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 40, lineHeight: 1.15, margin: '18px 0 14px', maxWidth: 620 }}>
            One score for the neighbourhood. One score for the flat.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-mute)', maxWidth: 560, lineHeight: 1.65 }}>
            Start however you know the property — browse a scored locality, or search the exact
            address. Either way you&apos;ll land on the same sun/shadow analysis and a combined
            verdict you control the weighting of.
          </p>
        </div>
      </section>

      <PropertyScoreFlow />
    </div>
  );
}
