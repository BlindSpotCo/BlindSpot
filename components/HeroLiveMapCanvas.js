'use client';
// components/HeroLiveMapCanvas.js
// The live map hero -- rebuilt clean. A real, pannable Leaflet map on
// the exact same tile source AddressConfirmMap.js already uses
// (OpenStreetMap standard tiles -- free, no key, proven in this repo),
// with a CSS filter on the tile layer only (not the markers/UI) to get
// a dark, muted mood without needing a paid/keyed dark-tile provider.
// Swap the TileLayer + drop the filter for a real dark-styled provider
// (CARTO/MapTiler, once there's a key) in one place if that's ever wanted.
//
// Layout is a single flex column (.hlm-content) instead of magic-number
// absolute positioning -- copy, search, and the insight row all sit in
// normal flow, so nothing can overlap regardless of how tall the
// headline wraps on a given screen.
//
// The insight strip below the search box used to be three static,
// invented lines ("Bright most of the year" etc.) that never changed no
// matter what you searched -- looked like decoration, not product, and
// didn't describe anything BlindSpot actually does per-address without a
// floor/facing. It's real now, sourced from the same two things the rest
// of the app already treats as ground truth for a picked address:
//   - /api/av-localities/lookup -- the real scored Neighbourhood record
//     for this exact PIN code, when BlindSpot has one (five cities,
//     309 pincodes right now -- see lib/aslivastu). Reuses verdictFor()/
//     scoreColor() from AVDetailedReadout.js so the phrasing/colour
//     matches the real report, not a homepage-only invention.
//   - /api/aqi -- live modelled air quality for the exact coordinate,
//     works for effectively any point in India, not just covered pins
//     (see that route's own header comment). aqiCategory() is the same
//     CPCB-band function the real scoring pipeline uses.
// A floor/facing-based Home Comfort number genuinely can't be shown here
// -- the hero only has a pin, not a unit -- so rather than fake one, the
// CTA copy says plainly what the next step actually adds.

import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PinDropTransition from '@/components/PinDropTransition';
import { verdictFor, scoreColor } from '@/components/property-score/AVDetailedReadout';
import { aqiCategory } from '@/lib/aslivastu/aqi';
import TypewriterCycle from '@/components/TypewriterCycle';

// Same default coordinates as the homepage's original rotating
// coordinate readout -- opens on the same place that readout used to cite.
const DEFAULT_CENTER = { lat: 12.9716, lon: 77.5946 };
const DEFAULT_ZOOM = 12.4;
const FLY_ZOOM = 15;

// Real categories BlindSpot actually scores -- not invented copy.
// Sunlight/obstruction/shadow come from the Sunscout floor+facing engine
// (lib/sunscout/solarReport.js); crime/infrastructure/air/power/water/
// roads/schools come from the NQI neighbourhood pipeline's own weighted
// dimensions (lib/aslivastu/aqi.js); AQI is the live route. Keep each
// entry short -- under ~44 characters -- so it types out in well under
// two seconds and doesn't wrap mid-type on a narrow screen.
const BLINDSPOT_EXAMPLES = [
  'Only 3 usable sunlight hours on this floor',
  'AQI over 180 on winter mornings here',
  'A crime spike two streets over',
  'Water supply flagged irregular this block',
  'North-facing units lose light by 11am',
  'Infrastructure score below the city median',
  'Power cuts logged above average nearby',
  'The tower next door blocks afternoon sun',
];

const pinIcon = L.divIcon({
  className: 'hlm-pin-icon',
  html: '<span class="hlm-pin-ring"></span><span class="hlm-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FlyTo({ lat, lon, zoom, flyKey }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.flyTo([lat, lon], zoom, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);
  return null;
}

// First-load moment: the map mounts a couple of zoom levels out and
// glides in to its real resting zoom, like descending toward the city
// rather than the whole page just appearing already-arrived. Fires once
// per mount, never again -- this is an entrance, not something that
// should replay on every re-render.
const INTRO_ZOOM_OFFSET = 2.4;
function IntroFly({ lat, lon, zoom }) {
  const map = useMap();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const t = setTimeout(() => {
      map.flyTo([lat, lon], zoom, { duration: 2.2, easeLinearity: 0.12 });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// AQI's 0-500 scale runs the opposite direction of a 0-100 "score" --
// low AQI is good. This only decides the chip's accent colour, same
// bands aqiCategory() already uses.
function aqiAccent(aqi) {
  if (aqi == null) return 'warn';
  if (aqi <= 100) return 'sun';
  if (aqi <= 200) return 'warn';
  return 'plum';
}

export default function HeroLiveMapCanvas() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState(null);
  const [flyKey, setFlyKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [neighbourhood, setNeighbourhood] = useState(null); // null | {found, record?}
  const [aqi, setAqi] = useState(null); // null | {aqi,...} | 'unavailable'
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  const requestIdRef = useRef(0);

  const center = pin || DEFAULT_CENTER;

  const runSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, lat: String(center.lat), lon: String(center.lon) });
        const res = await fetch(`/api/sunscout/geocode-suggest?${params.toString()}`);
        const data = await res.json();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 280);
  }, [center.lat, center.lon]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    setRevealed(false);
    runSearch(v);
  };

  const pick = (r) => {
    setPin({ lat: r.lat, lon: r.lon });
    setQuery(r.displayName);
    setOpen(false);
    setResults([]);
    setFlyKey((k) => k + 1);
    setRevealed(false);
    setNeighbourhood(null);
    setAqi(null);

    // Guards against a fast second pick's response landing after an
    // even-faster third pick -- same idiom lib/aslivastu/useLiveAqi.js
    // already uses for exactly this race.
    const reqId = ++requestIdRef.current;

    const neighbourhoodPromise = r.postcode
      ? fetch(`/api/av-localities/lookup?pin=${encodeURIComponent(r.postcode)}`)
          .then((res) => res.json())
          .catch(() => ({ found: false }))
      : Promise.resolve({ found: false });

    const aqiPromise = fetch(`/api/aqi?lat=${r.lat}&lon=${r.lon}`)
      .then((res) => res.json())
      .catch(() => ({ aqi: null }));

    Promise.allSettled([neighbourhoodPromise, aqiPromise]).then(([nRes, aRes]) => {
      if (reqId !== requestIdRef.current) return;
      const nData = nRes.status === 'fulfilled' ? nRes.value : { found: false };
      const aData = aRes.status === 'fulfilled' ? aRes.value : { aqi: null };
      setNeighbourhood(nData);
      setAqi(aData?.aqi != null ? aData : 'unavailable');
      // Small deliberate floor so the pin-drop + fly animation always
      // gets to register before the strip pops in, even when both
      // fetches resolve near-instantly from a warm cache.
      setTimeout(() => { if (reqId === requestIdRef.current) setRevealed(true); }, 450);
    });
  };

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const nRecord = neighbourhood?.found ? neighbourhood.record : null;
  const nVerdict = nRecord ? verdictFor(nRecord.nqi_composite) : null;
  const aqiValue = aqi && aqi !== 'unavailable' ? aqi.aqi : null;
  const aqiLabel = aqiValue != null ? aqiCategory(aqiValue) : null;
  const hasAnyInsight = !!nRecord || aqiValue != null;

  return (
    <div className="hlm-root">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={pin ? FLY_ZOOM : DEFAULT_ZOOM - INTRO_ZOOM_OFFSET}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        className="hlm-map"
      >
        <TileLayer
          className="hlm-tiles"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
          detectRetina
        />
        {pin && <Marker position={[pin.lat, pin.lon]} icon={pinIcon} />}
        <FlyTo lat={center.lat} lon={center.lon} zoom={pin ? FLY_ZOOM : DEFAULT_ZOOM} flyKey={flyKey} />
        {!pin && <IntroFly lat={DEFAULT_CENTER.lat} lon={DEFAULT_CENTER.lon} zoom={DEFAULT_ZOOM} />}
      </MapContainer>

      <div className="hlm-glow" aria-hidden="true" />
      <div className="hlm-scrim" aria-hidden="true" />
      <div className="hlm-grain" aria-hidden="true" />

      <div className="hlm-content">
        <div className="hlm-copy">
          <span className="hlm-eyebrow">Property Intelligence</span>
          <h1 className="hlm-h1">Every property has a <span className="hlm-h1-accent">blindspot.</span></h1>
          <p className="hlm-typed-line">
            <TypewriterCycle
              items={BLINDSPOT_EXAMPLES}
              className="hlm-typed-text"
              cursorClassName="hlm-typed-cursor"
            />
            <span className="sr-only">
              We catch things like hidden water damage, poor natural light, high pollution, extra noise, and safety risks the listing photos won&apos;t show you.
            </span>
          </p>
          <p className="hlm-resolve">Search your address to find yours.</p>
        </div>

        <div className="hlm-searchwrap" ref={boxRef}>
          <div className="hlm-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input
              value={query}
              onChange={handleChange}
              onFocus={() => setOpen(true)}
              placeholder="Search an address or drop a pin"
              className="hlm-search-input"
            />
            {loading && <span className="hlm-search-spinner" aria-hidden="true" />}
          </div>

          {open && results.length > 0 && (
            <ul className="hlm-suggestions">
              {results.map((r, i) => (
                <li key={`${r.lat},${r.lon},${i}`}>
                  <button type="button" onClick={() => pick(r)}>{r.displayName}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {pin && (
          <div className={`hlm-panel${revealed ? ' is-visible' : ''}${hasAnyInsight ? '' : ' hlm-panel-cta-only'}`}>
            {hasAnyInsight && (
              <div className="hlm-panel-facts">
                {nRecord && (
                  <div className="hlm-fact">
                    <span className="hlm-fact-dot" style={{ background: scoreColor(nRecord.nqi_composite) }} />
                    <div>
                      <span className="hlm-fact-label">{nRecord.area || nRecord.name} &middot; {nVerdict.label}</span>
                      <span className="hlm-fact-sub">Neighbourhood Score {nRecord.nqi_composite}/100</span>
                    </div>
                  </div>
                )}
                {nRecord && aqiValue != null && <span className="hlm-fact-div" aria-hidden="true" />}
                {aqiValue != null && (
                  <div className="hlm-fact">
                    <span className="hlm-fact-dot" style={{ background: aqiAccent(aqiValue) === 'sun' ? 'var(--ss)' : aqiAccent(aqiValue) === 'plum' ? 'var(--plum)' : 'var(--brand-yellow)' }} />
                    <div>
                      <span className="hlm-fact-label">{aqiLabel} air quality</span>
                      <span className="hlm-fact-sub">Live AQI {aqiValue} right now</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <PinDropTransition href="/property-score" className="hlm-cta">
              {hasAnyInsight ? 'See sunlight, safety & more' : 'See the full breakdown'} <span>→</span>
            </PinDropTransition>
          </div>
        )}
      </div>

      <span className="hlm-scroll-cue mono">Scroll<span className="hlm-scroll-cue-arrow">↓</span></span>
    </div>
  );
}
