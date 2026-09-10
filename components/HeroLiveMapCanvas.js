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
// "Koramangala" or "Bengaluru" also works too. It's genuinely one box
// now: no mode to pick first, every keystroke searches city, neighbourhood
// AND address results together (see geocode-suggest's own `kind` field),
// and this is just the label each suggestion in the dropdown wears so
// it's clear what you're about to pick.
const SEARCH_PLACEHOLDER = 'Search a city, neighbourhood or address.';
const KIND_LABELS = { city: 'City', neighbourhood: 'Neighbourhood', address: 'Address' };
// The 5 cities BlindSpot actually has neighbourhood-score coverage for --
// named here once, for the "not covered yet" message the city panel
// shows when someone searches a city outside that set.
const COVERED_CITY_NAMES = 'Bangalore, Delhi NCR, Mumbai, Hyderabad and Chandigarh';

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
  // Picking a city-level result doesn't drop a pin or go anywhere -- it
  // expands the search box itself into a panel listing that city's
  // covered neighbourhoods (null when no city is picked; `covered: false`
  // when it's a real city outside BlindSpot's 5). cityPanelOpen is the
  // separate flag that actually drives the CSS grow-in transition -- see
  // the effect below for why it's not just "cityPanel != null".
  const [cityPanel, setCityPanel] = useState(null);
  const [cityPanelOpen, setCityPanelOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('');

  const center = pin || DEFAULT_CENTER;

  const runSearch = useCallback((q) => {
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
    // Typing again backs out of a just-opened city panel -- the box goes
    // back to being a plain search the moment someone edits the query,
    // rather than leaving a stale neighbourhood list sitting there under
    // new, unrelated suggestions.
    setCityPanel(null);
    runSearch(v);
  };

  // Arrow keys, Enter and Escape on the suggestions.
  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); setCityPanel(null); return; }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? results.length : i) - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]); }
  };

  // The debounce was never cleared: navigate away mid-search and a fetch
  // plus two setState calls fire against a component that is gone.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestIdRef.current += 1;
  }, []);

  // A city-level pick doesn't have a unit or even a neighbourhood to
  // score yet -- it opens the search box itself into a panel listing
  // every neighbourhood BlindSpot covers in that city (fetched from
  // /api/av-localities/by-city), rather than dropping a pin nowhere in
  // particular. `city` here is already whichever of the 5 covered city
  // keys geocode-suggest resolved it to (see cityAliases.js); null means
  // it's a real city, just not one of the 5 with scored data yet.
  const pickCity = (r) => {
    setOpen(false);
    setResults([]);
    setQuery(r.displayName);
    setCityFilter('');

    if (!r.coveredCity) {
      setCityPanel({ city: r.displayName, covered: false, loading: false, error: null, neighbourhoods: [] });
      return;
    }

    const city = r.coveredCity;
    setCityPanel({ city, covered: true, loading: true, error: null, neighbourhoods: [] });
    fetch(`/api/av-localities/by-city?city=${encodeURIComponent(city)}`)
      .then((res) => res.json())
      .then((data) => {
        // A later pick may have already replaced this panel by the time
        // this resolves -- only apply it if we're still showing this city.
        setCityPanel((prev) => (prev && prev.city === city
          ? { ...prev, loading: false, neighbourhoods: data?.neighbourhoods || [], error: data?.found ? null : 'load-failed' }
          : prev));
      })
      .catch(() => {
        setCityPanel((prev) => (prev && prev.city === city ? { ...prev, loading: false, error: 'load-failed' } : prev));
      });
  };

  // Clicking a neighbourhood inside the city panel goes to its existing
  // per-neighbourhood report (same page a covered postcode already links
  // to elsewhere in the app) -- BlindSpot has real NQI data for it, just
  // not a specific flat, so this is the honest landing spot rather than
  // routing it through the address flow below with no address.
  const pickCityNeighbourhood = (row) => {
    setCityPanel(null);
    setQuery('');
    const href = `/neighbourhood-report/${row.pin_code}${row.sectorNum != null ? `?sector=${row.sectorNum}` : ''}`;
    router.push(href);
  };

  const closeCityPanel = () => { setCityPanel(null); setCityFilter(''); };

  const pick = (r) => {
    if (r.kind === 'city') { pickCity(r); return; }

    setCityPanel(null);
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
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setCityPanel(null); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Drives the city panel's grow-in transition. It's a second flag
  // instead of just styling off `cityPanel` directly because the panel
  // has to render once in its collapsed state and THEN pick up the
  // `.is-open` class on the next frame for the CSS transition between
  // those two states to actually animate -- setting both at once (as
  // pickCity does) would just paint it already open.
  useEffect(() => {
    if (!cityPanel) { setCityPanelOpen(false); return; }
    const raf = requestAnimationFrame(() => setCityPanelOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [cityPanel]);

  const nRecord = neighbourhood?.found ? neighbourhood.record : null;
  const nVerdict = nRecord ? verdictFor(nRecord.nqi_composite) : null;
  const aqiValue = aqi && aqi !== 'unavailable' ? aqi.aqi : null;
  const aqiLabel = aqiValue != null ? aqiCategory(aqiValue) : null;
  const hasAnyInsight = !!nRecord || aqiValue != null;

  const filteredCityNeighbourhoods = (() => {
    if (!cityPanel?.neighbourhoods) return [];
    const q = cityFilter.trim().toLowerCase();
    if (!q) return cityPanel.neighbourhoods;
    return cityPanel.neighbourhoods.filter(
      (n) => n.name.toLowerCase().includes(q) || (n.area || '').toLowerCase().includes(q)
    );
  })();

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
          <div className="hlm-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            {/* A placeholder is not an accessible name -- it disappears the
                moment you type and is not reliably announced. Without a
                label, the only interactive control on the homepage read as
                "edit, blank" to a screen reader. */}
            <label htmlFor="hlm-address" className="sr-only">
              Search for a city, neighbourhood or address
            </label>
            <input
              id="hlm-address"
              type="search"
              value={query}
              onChange={handleChange}
              onFocus={() => setOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder={SEARCH_PLACEHOLDER}
              className="hlm-search-input"
              role="combobox"
              aria-expanded={(open && results.length > 0) || !!cityPanel}
              aria-controls={cityPanel ? 'hlm-city-panel' : 'hlm-suggestions'}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `hlm-opt-${active}` : undefined}
              autoComplete="off"
            />
            {loading && <span className="hlm-search-spinner" aria-hidden="true" />}
          </div>

          {cityPanel ? (
            <div
              id="hlm-city-panel"
              className={`hlm-city-panel${cityPanelOpen ? ' is-open' : ''}`}
              role="region"
              aria-label={`Neighbourhoods in ${cityPanel.city}`}
            >
              <div className="hlm-city-panel-head">
                <div>
                  <span className="hlm-city-panel-eyebrow">Neighbourhoods in</span>
                  <h3 className="hlm-city-panel-title">{cityPanel.city}</h3>
                </div>
                <button type="button" className="hlm-city-panel-close" onClick={closeCityPanel} aria-label="Close neighbourhood list">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>

              {!cityPanel.covered ? (
                <p className="hlm-city-panel-empty">BlindSpot doesn&apos;t score neighbourhoods here yet &mdash; currently live in {COVERED_CITY_NAMES}.</p>
              ) : cityPanel.loading ? (
                <p className="hlm-city-panel-empty">Loading neighbourhoods&hellip;</p>
              ) : cityPanel.error ? (
                <p className="hlm-city-panel-empty">Couldn&apos;t load neighbourhoods just now &mdash; try again in a moment.</p>
              ) : (
                <>
                  <input
                    type="search"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder={`Filter ${cityPanel.neighbourhoods.length} neighbourhoods…`}
                    className="hlm-city-panel-filter"
                    aria-label={`Filter neighbourhoods in ${cityPanel.city}`}
                  />
                  {filteredCityNeighbourhoods.length === 0 ? (
                    <p className="hlm-city-panel-empty">No neighbourhoods match &ldquo;{cityFilter}&rdquo;.</p>
                  ) : (
                    <ul className="hlm-city-panel-list">
                      {filteredCityNeighbourhoods.map((n) => (
                        <li key={`${n.pin_code}-${n.sectorNum ?? ''}`}>
                          <button type="button" onClick={() => pickCityNeighbourhood(n)}>
                            <span className="hlm-city-row-dot" style={{ background: scoreColor(n.nqi_composite) }} aria-hidden="true" />
                            <span className="hlm-city-row-name">
                              {n.name}{n.area && n.area !== n.name ? ` · ${n.area}` : ''}
                            </span>
                            <span className="hlm-city-row-score">{n.nqi_composite}<span>/100</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          ) : open && results.length > 0 && (
            <ul className="hlm-suggestions" id="hlm-suggestions" role="listbox" aria-label="City, neighbourhood and address suggestions">
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
                  >
                    <span className="hlm-suggest-name">{r.displayName}</span>
                    <span className={`hlm-suggest-kind hlm-suggest-kind-${r.kind || 'address'}`}>{KIND_LABELS[r.kind] || 'Address'}</span>
                  </button>
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
