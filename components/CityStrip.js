// components/CityStrip.js
//
// Slow scrolling row of the cities where the neighbourhood score is live,
// straight under the hero. Stands in for the "logos of people who use us"
// strip other sites have: we have no partner logos yet, but every city
// here is real coverage a buyer can try right now.
//
// The list is KNOWN_CITIES from lib/aslivastu/cityMeta.js, so adding a
// city there adds it here; nothing is typed in by hand.
//
// The row is rendered twice inside one track so the CSS loop is seamless;
// the second copy is aria-hidden so screen readers hear each city once.
// With reduced motion the track stops and wraps as a plain centred list.

import { KNOWN_CITIES } from '@/lib/aslivastu/cityMeta';

export default function CityStrip() {
  return (
    <section className="city-strip" aria-label="Cities with neighbourhood scores">
      <p className="city-strip-title mono">Neighbourhood scores live in</p>
      <div className="city-strip-window">
        <div className="city-strip-track">
          <ul className="city-strip-row">
            {KNOWN_CITIES.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <ul className="city-strip-row" aria-hidden="true">
            {KNOWN_CITIES.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
