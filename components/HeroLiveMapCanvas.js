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

import { useRouter } from 'next/navigation';
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

// How long the insight chips get to sit on screen, once they're ready,
// before the report opens on its own. Selecting an address used to need
// a second, separate click on a "see the report" button below this --
// now that click is gone: picking an address is enough, this is just a
// short beat so the neighbourhood/AQI facts aren't yanked away unread.
const AUTO_REPORT_HOLD_MS = 650;

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

// The search box used to only make sense as an address search --
// placeholder said so outright, and nothing signalled that typing just
// "Koramangala" or "Bengaluru" also works (Photon/Nominatim both handle
// place-level queries fine, the box just never said so). These three
// modes bias the geocode-suggest request to the matching OSM place tier
// (see that route's OSM_TAGS_BY_TYPE) and swap the placeholder to match,
// so someone who only knows the neighbourhood, not a street address,
// has an explicit way to say that instead of getting an empty dropdown.
const SEARCH_MODES = [
  { value: 'city', label: 'City', placeholder: 'Search a city, e.g. Bengaluru.' },
  { value: 'neighbourhood', label: 'Neighbourhood', placeholder: 'Search a neighbourhood or locality.' },
  { value: 'address', label: 'Address', placeholder: 'Search your address to find yours.' },
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
      map.flyTo([lat, lon], zoom, { duration: 2.1, easeLinearity: 0.18 });
    }, 350);
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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('address');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState(null);
  const [flyKey, setFlyKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [autoGo, setAutoGo] = useState(false);
  const [neighbourhood, setNeighbourhood] = useState(null); // null | {found, record?}
  const [aqi, setAqi] = useState(null); // null | {aqi,...} | 'unavailable'
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  const requestIdRef = useRef(0);
  // Which suggestion the keyboard is on. The list had no key handling at
  // all: you could tab into it, but nothing announced it and nothing
  // dismissed it.
  const [active, setActive] = useState(-1);

  const center = pin || DEFAULT_CENTER;

  const runSearch = useCallback((q, mode) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      // The debounce clears the timer, not the request already in flight.
      // Two fetches 280ms apart can come back out of order and the older one
      // wins -- suggestions for "conn" under the text "connaught", and from
      // there a wrong pin and a wrong report. Same guard pick() already uses.
      const reqId = ++requestIdRef.current;
      try {
        const params = new URLSearchParams({ q, lat: String(center.lat), lon: String(center.lon) });
        // 'address' is the same unfiltered query every existing call made
        // before search modes existed -- only send `type` for the two
        // that actually restrict the geocoder (see that route's own
        // OSM_TAGS_BY_TYPE), so a stray/older client-side cache entry
        // never behaves differently just because this param exists now.
        if (mode && mode !== 'address') params.set('type', mode);
        const res = await fetch(`/api/sunscout/geocode-suggest?${params.toString()}`);
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        setResults(Array.isArray(data?.results) ? data.results : []);
        setActive(-1);
      } catch {
        if (reqId === requestIdRef.current) setResults([]);
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 280);
  }, [center.lat, center.lon]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    setRevealed(false);
    runSearch(v, searchMode);
  };

  // Switching mode with an existing query re-runs the search under the
  // new place-type filter rather than leaving stale address-mode results
  // sitting in a now-mismatched "Search a city" box.
  const handleModeChange = (mode) => {
    if (mode === searchMode) return;
    setSearchMode(mode);
    if (query.trim().length >= 2) { setOpen(true); runSearch(query, mode); }
  };

  // Arrow keys, Enter and Escape on the suggestions.
  const onSearchKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') { setOpen(false); setActive(-1); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? results.length : i) - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  // The debounce was never cleared: navigate away mid-search and a fetch
  // plus two setState calls fire against a component that is gone.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current += 1;
  }, []);

  const pick = (r) => {
    setPin({ lat: r.lat, lon: r.lon, postcode: r.postcode || '', label: r.displayName || '' });
    setQuery(r.displayName);
    setOpen(false);
    setResults([]);
    setFlyKey((k) => k + 1);
    setRevealed(false);
    setAutoGo(false);
    setNeighbourhood(null);
    setAqi(null);

    router.prefetch?.(
      `/report?lat=${r.lat}&lon=${r.lon}` +
      `&pin_code=${encodeURIComponent(r.postcode || '')}` +
      `&address=${encodeURIComponent(r.displayName || '')}`
    );

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
      setTimeout(() => {
        if (reqId !== requestIdRef.current) return;
        setRevealed(true);
        // Straight to the report from here -- no extra click. The CTA
        // link below still works if someone taps it before this fires.
        setTimeout(() => { if (reqId === requestIdRef.current) setAutoGo(true); }, AUTO_REPORT_HOLD_MS);
      }, 450);
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
    <div className="hlm-root" id="find">
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
        {/* CARTO's basemaps.cartocdn.com now requires a registered API
            key -- unauthenticated requests come back as tiles watermarked
            "API key required", which is what shipped here briefly. Back
            to plain OSM tiles (proven, no key) with the dark treatment
            done entirely via the .hlm-tiles CSS filter below. */}
        <TileLayer
          className="hlm-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
          <h1 className="hlm-h1">Every property has a <span className="hlm-h1-accent" data-text="blindspot.">blindspot.</span></h1>
          <p className="hlm-typed-line">
            <TypewriterCycle
              items={BLINDSPOT_EXAMPLES}
              className="hlm-typed-text"
              cursorClassName="hlm-typed-cursor"
            />
            <span className="sr-only">
              We measure what a listing leaves out: how much real sunlight this flat gets through the year, how much of it sits in shade, and what government records say about safety, water, power, schools, roads and air in the area around it.
            </span>
          </p>
        </div>

        <div className="hlm-searchwrap" ref={boxRef}>
          <div className="hlm-search-modes" role="tablist" aria-label="Search by">
            {SEARCH_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="tab"
                aria-selected={searchMode === m.value}
                className={`hlm-search-mode${searchMode === m.value ? ' is-active' : ''}`}
                onClick={() => handleModeChange(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="hlm-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            {/* A placeholder is not an accessible name -- it disappears the
                moment you type and is not reliably announced. Without a
                label, the only interactive control on the homepage read as
                "edit, blank" to a screen reader. */}
            <label htmlFor="hlm-address" className="sr-only">
              Search for {SEARCH_MODES.find((m) => m.value === searchMode)?.label || 'an address'}
            </label>
            <input
              id="hlm-address"
              type="search"
              value={query}
              onChange={handleChange}
              onFocus={() => setOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder={SEARCH_MODES.find((m) => m.value === searchMode)?.placeholder}
              className="hlm-search-input"
              role="combobox"
              aria-expanded={open && results.length > 0}
              aria-controls="hlm-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `hlm-opt-${active}` : undefined}
              autoComplete="off"
            />
            {loading && <span className="hlm-search-spinner" aria-hidden="true" />}
          </div>

          {open && results.length > 0 && (
            <ul className="hlm-suggestions" id="hlm-suggestions" role="listbox" aria-label="Address suggestions">
              {results.map((r, i) => (
                <li key={`${r.lat},${r.lon},${i}`} role="presentation">
                  <button
                    type="button"
                    id={`hlm-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'is-active' : undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                  >{r.displayName}</button>
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
            <PinDropTransition
              href={`/report?lat=${pin.lat}&lon=${pin.lon}` +
                    `&pin_code=${encodeURIComponent(pin.postcode || '')}` +
                    `&address=${encodeURIComponent(pin.label || query || '')}`}
              className="hlm-cta"
              autoStart={autoGo}
            >
              {hasAnyInsight ? 'See sunlight, safety & more' : 'See the full breakdown'} <span>→</span>
            </PinDropTransition>
          </div>
        )}
      </div>

      <span className="hlm-scroll-cue mono">Scroll<span className="hlm-scroll-cue-arrow">↓</span></span>
    </div>
  );
}
