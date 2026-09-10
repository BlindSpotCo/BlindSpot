'use client';
// components/HeroLiveMap.js
// Thin wrapper -- dynamic-imports HeroLiveMapCanvas with ssr:false
// (Leaflet needs `window`), same pattern AddressPicker uses for
// AddressConfirmMap. Renders a plain dark placeholder while it loads so
// the hero doesn't jump/flash on mount.
import dynamic from 'next/dynamic';

const HeroLiveMapCanvas = dynamic(() => import('./HeroLiveMapCanvas'), {
  ssr: false,
  loading: () => <div id="find" className="hlm-root hlm-loading" aria-hidden="true" />,
});

export default function HeroLiveMap() {
  return <HeroLiveMapCanvas />;
}
