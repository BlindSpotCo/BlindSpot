'use client';
// components/paywall/PricingView.js -- the /pricing page body.

import { useKeys } from '@/lib/paywall/KeysProvider';
import { KEY_COST, PACKS, inr, inr2, perKey } from '@/lib/paywall/config';
import KeyBalance from './KeyBalance';
import './paywall.css';
import './pricing.css';

const EXAMPLES = [
  { who: 'First home', what: '4 flats shortlisted across 2 towers', math: '2 + 1 + 2 + 1', keys: 6, pack: 'Basic' },
  { who: 'Comparing towers', what: 'One flat each in 3 different towers', math: '2 + 2 + 2', keys: 6, pack: 'Basic' },
  { who: 'A broker', what: '10 listings, 2 flats each to show buyers', math: '10 × (2 + 1)', keys: 30, pack: 'Investor' },
];

export default function PricingView() {
  const { openPacks, enabled } = useKeys();
  return (
    <main className="pr-page">
      <div className="pr-wrap">
        <header className="pr-hero">
          <p className="pw-eyebrow">Pricing</p>
          <h1>Pay per property, not per month.</h1>
          <p className="pr-sub">
            You open BlindSpot when you&apos;ve got a shortlist and need to pick one. That&apos;s one decision,
            not a subscription. Buy Keys, spend them on the reports you want, and use them on any
            property in any city we cover.
          </p>
          {enabled && <div className="pr-hero-actions"><KeyBalance /></div>}
        </header>

        <section className="pr-sec">
          <h2>How Keys get spent</h2>
          <div className="pw-rules">
            <div><strong>{KEY_COST.first} Keys</strong>First report on a property</div>
            <div><strong>{KEY_COST.extra} Key</strong>Each extra floor, facing or report on that property</div>
            <div><strong>Any city</strong>Keys aren&apos;t tied to one address</div>
          </div>
          <p className="pr-p">
            Three reports cost Keys: the <b>detailed neighbourhood report</b>, the <b>year-round sunlight report</b> for
            a flat, and the <b>full BlindSpot report</b>, which includes both. Every paid button shows a lock and its
            Key cost before you click, and nothing is charged until you confirm.
          </p>
        </section>

        <section className="pr-sec">
          <h2>Packs</h2>
          <div className="pw-packs">
            {PACKS.map((p) => (
              <div key={p.id} className={`pw-pack${p.tag ? ' is-hot' : ''}`}>
                {p.tag && <span className="pw-tag">{p.tag}</span>}
                <strong className="pw-pack-name">{p.name}</strong>
                <span className="pw-pack-keys">{p.keys} <small>Keys</small></span>
                <span className="pw-pack-price">{inr(p.price)}</span>
                <span className="pw-pack-per">{inr2(perKey(p))} per Key</span>
                <span className="pw-pack-fits">{p.fits}</span>
                {enabled && <button type="button" className="pw-btn" onClick={openPacks}>Choose {p.name}</button>}
              </div>
            ))}
          </div>
        </section>

        <section className="pr-sec">
          <h2>Sized for real shortlists</h2>
          <div className="pr-ex">
            {EXAMPLES.map((x) => (
              <div key={x.who} className="pr-ex-card">
                <strong>{x.who}</strong>
                <span>{x.what}</span>
                <span className="pr-ex-math">{x.math} = {x.keys} Keys</span>
                <span className="pr-ex-res">{x.pack} pack, used exactly</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pr-sec pr-split">
          <div className="pr-col">
            <h3>Free on every flat</h3>
            <ul>
              <li>The 3D sun and shadow map</li>
              <li>Neighbourhood Score and Home Comfort Score</li>
              <li>The score breakdowns and trends</li>
              <li>Your checklist of what to verify</li>
              <li>Saving properties to your profile</li>
            </ul>
          </div>
          <div className="pr-col is-paid">
            <h3>Costs Keys</h3>
            <ul>
              <li>Detailed neighbourhood report</li>
              <li>Year-round sunlight report</li>
              <li>Full BlindSpot report, written up with a PDF</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
