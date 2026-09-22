'use client';
// components/HeroLiveMapCanvas.js
// The hero -- a looping video backdrop (HERO_VIDEO_SRC below) with the
// address search sitting on top of it. This used to be a real, pannable
// Leaflet map that flew to the picked pin; that map was swapped for the
// video (one recorded clip instead of a WebGL scene + a solar fetch on
// every landing visit -- see the HERO_VIDEO_SRC comment), and every
// Leaflet-specific piece of this file (MapContainer/TileLayer/Marker/
// FlyTo/IntroFly/pinIcon) has been removed along with it, since none of
// it was actually being rendered any more -- it was just dead code
// quietly justifying stale timing (see AUTO_REPORT_HOLD_MS below, which
// is the bug that made this obvious).
//
// Layout is a single flex column (.hlm-content) instead of magic-number
// absolute positioning -- copy, search, and the insight row all sit in
// normal flow, so nothing can overlap regardless of how tall the
// headline wraps on a given screen.
//
// Picking an address doesn't show an intermediate insight strip any
// more -- it used to flash the neighbourhood score / live AQI for a
// beat before the report opened, but that read as one more thing in the
// way of a "straight to the report" flow. Picking a result holds
// briefly on the now-filled-in address, then the full-screen
// PinDropTransition takes over and opens the report; scoreColor() from
// AVDetailedReadout.js is still used for the city panel's neighbourhood
// list below, which is a real, standing list rather than a one-off
// glimpse.

import { useRouter } from 'next/navigation';
import { useState, useRef, useCallback, useEffect } from 'react';
import PinDropTransition from '@/components/PinDropTransition';
import { scoreColor } from '@/components/property-score/AVDetailedReadout';
import TypewriterCycle from '@/components/TypewriterCycle';

// The hero backdrop is a recorded clip of the real sun/shadow animation
// (Map3DShadow, same component the report page uses), not a live 3D
// scene -- one video, muted/looped, instead of a WebGL iframe + a solar
// fetch on every landing visit. Drop the file in public/ under this name
// to swap it; see the .hlm-map-video render below.
const HERO_VIDEO_SRC = '/hero-solar.mp4';

// Same default coordinates as the homepage's original rotating
// coordinate readout -- opens on the same place that readout used to cite.
const DEFAULT_CENTER = { lat: 12.9716, lon: 77.5946 };

// How long the picked address sits in the search box before the
// "acquiring site" transition (PinDropTransition) covers the screen and
// the report opens. This used to be tuned to cover a Leaflet fly-to
// animation (1.1s) that played on the hero's old live map -- that map
// is gone (see the file header comment), replaced by a static video
// backdrop that doesn't react to the pick at all, so there is nothing
// left for this hold to wait on. Long enough to register that the tap
// landed and read the filled-in address, short enough that it doesn't
// feel like a stall before the transition takes over.
const AUTO_REPORT_HOLD_MS = 220;

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
const SEARCH_PLACEHOLDER = 'Enter society name, landmark, or address...';
// One-click examples under the search box, one per covered city where it
// fits. A real building first, so the chips show that a specific address
// works as well as an area -- that is the more useful thing to learn from
// them.
//
// Hardcoded results (each field is exactly what pick() expects), not a
// query string re-resolved on every click, for two real reasons found
// while chasing a reported "lag" on these chips: (1) Photon + Nominatim
// are free public demo instances (see geocode-suggest/route.js's own
// comment) that can take well over a second to answer -- a real delay,
// not an animation-timing bug, for a click that should be instant since
// the place never changes. (2) naively taking the first search result for
// a plain neighbourhood query often lands on a random nearby street
// instead of the neighbourhood itself -- "Sector 7, Chandigarh" resolved
// to "Sukhna Path, 7, Chandigarh" (a different street entirely), and
// "Bandra West, Mumbai" resolved to "Gurunanak Marg", both confirmed live
// against /api/sunscout/geocode-suggest. Every value below is a real
// result from that same endpoint, picked out by hand instead of trusting
// index 0.
const TRY_PLACES = [
  { label: 'Prestige Park Grove', lat: 13.0157282, lon: 77.7539999, displayName: 'Prestige Park Grove (u/c), Doddabanahalli, Karnataka', postcode: null, kind: 'address' },
  { label: 'Hauz Khas', lat: 28.5536023, lon: 77.1948144, displayName: 'Hauz Khas, South Delhi, Delhi', postcode: '110016', kind: 'neighbourhood' },
  { label: 'Sector 7', lat: 30.7358664, lon: 76.8042826, displayName: 'Sector 7, Chandigarh', postcode: '160007', kind: 'neighbourhood' },
  { label: 'Bandra West', lat: 19.0583358, lon: 72.8302669, displayName: 'Bandra West, Mumbai, Maharashtra', postcode: null, kind: 'neighbourhood' },
];
const KIND_LABELS = { city: 'City', neighbourhood: 'Neighbourhood', address: 'Address' };
// The 5 cities BlindSpot actually has neighbourhood-score coverage for --
// named here once, for the "not covered yet" message the city panel
// shows when someone searches a city outside that set.
const COVERED_CITY_NAMES = 'Bangalore, Delhi NCR, Mumbai, Hyderabad, Chandigarh and Chennai';

export default function HeroLiveMapCanvas() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState(null);
  const [autoGo, setAutoGo] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);
  // The suggestions dropdown and the city-panel neighbourhood list are
  // both capped at a fixed height in CSS (280px / 290px) -- fine on a
  // tall screen, but .hlm-root is a fixed 100vh box with overflow:hidden,
  // so on a shorter viewport (or with more copy above the search box
  // than there used to be) that fixed cap can be taller than the real
  // room left below the search box. The excess doesn't scroll into view,
  // it just gets clipped away in silence -- rows are there in the DOM
  // but never paintable. These refs let the effect below measure the
  // real remaining space and clamp to that instead.
  const suggestionsRef = useRef(null);
  const cityListRef = useRef(null);
  const heroVideoRef = useRef(null);
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
  // Set when an explicit search (the button, Enter, a chip) comes back
  // empty. Without it that case was silent -- the click did nothing at all,
  // which reads as a broken button rather than "we couldn't find that".
  const [noMatch, setNoMatch] = useState('');

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
    setNoMatch('');
    // Typing again backs out of a just-opened city panel -- the box goes
    // back to being a plain search the moment someone edits the query,
    // rather than leaving a stale neighbourhood list sitting there under
    // new, unrelated suggestions.
    setCityPanel(null);
    runSearch(v);
  };

  // Go from whatever is in the box to a picked place, in one action. The
  // search box used to have no way to submit at all -- Enter did nothing
  // unless a suggestion was already highlighted with the arrow keys, and
  // there was no button -- so the only path forward was noticing the
  // dropdown and clicking a row in it. Now: if suggestions for the current
  // text are already showing, take the highlighted one (or the first);
  // otherwise search right away, skipping the typing debounce, and take
  // the top result. The try-chips call this with their own query.
  const searchAndPick = async (q) => {
    if (q == null && results.length > 0) { pick(results[active >= 0 ? active : 0]); return; }
    const text = (q ?? query).trim();
    if (text.length < 2) { document.getElementById('hlm-address')?.focus(); return; }
    if (q != null) setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: text, lat: String(center.lat), lon: String(center.lon) });
      const res = await fetch(`/api/sunscout/geocode-suggest?${params.toString()}`);
      const data = await res.json();
      if (reqId !== requestIdRef.current) return;
      const list = Array.isArray(data?.results) ? data.results : [];
      setResults(list);
      setActive(-1);
      if (list.length > 0) { setNoMatch(''); pick(list[0]); }
      else { setNoMatch(text); setOpen(true); }
    } catch {
      if (reqId === requestIdRef.current) setResults([]);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  // Arrow keys, Enter and Escape on the suggestions.
  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); setCityPanel(null); return; }
    if (e.key === 'Enter' && active < 0) { e.preventDefault(); searchAndPick(); return; }
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
    setAutoGo(false);

    router.prefetch?.(
      `/report/locate?lat=${r.lat}&lon=${r.lon}` +
      `&pin_code=${encodeURIComponent(r.postcode || '')}` +
      `&address=${encodeURIComponent(r.displayName || '')}`
    );

    // Guards against a fast second pick's response landing after an
    // even-faster third pick -- same idiom lib/aslivastu/useLiveAqi.js
    // already uses for exactly this race.
    const reqId = ++requestIdRef.current;

    // Straight to the report from here -- no extra click, no strip to
    // read first. Just enough of a hold that the pin-drop + fly-to have
    // time to register before the full-screen transition covers them.
    setTimeout(() => {
      if (reqId === requestIdRef.current) setAutoGo(true);
    }, AUTO_REPORT_HOLD_MS);
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

  const filteredCityNeighbourhoods = (() => {
    if (!cityPanel?.neighbourhoods) return [];
    const q = cityFilter.trim().toLowerCase();
    if (!q) return cityPanel.neighbourhoods;
    return cityPanel.neighbourhoods.filter(
      (n) => n.name.toLowerCase().includes(q) || (n.area || '').toLowerCase().includes(q)
    );
  })();

  // Clamp both lists to whatever room is actually left inside the hero,
  // instead of trusting the CSS's fixed max-height -- see the refs'
  // comment above. Re-measures whenever either list could newly be on
  // screen (or its content changes height) and on resize; a floor keeps
  // either list from being clamped down to something unusably short.
  useEffect(() => {
    const clamp = (el, floor) => {
      if (!el) return;
      const root = el.closest('.hlm-root');
      if (!root) return;
      const available = root.getBoundingClientRect().bottom - el.getBoundingClientRect().top - 16;
      el.style.maxHeight = `${Math.max(floor, Math.floor(available))}px`;
    };
    const run = () => {
      clamp(suggestionsRef.current, 120);
      clamp(cityListRef.current, 160);
    };
    run();
    window.addEventListener('resize', run);
    return () => window.removeEventListener('resize', run);
  }, [open, results.length, cityPanel, cityPanelOpen, filteredCityNeighbourhoods.length]);

  // Belt-and-braces autoplay for the hero video (see the comment on the
  // <video> element below for why the JSX attribute alone isn't always
  // enough on phones). Setting `muted` as a real property before calling
  // play() is what mobile autoplay policies actually check; `loadeddata`
  // covers the case where the browser hadn't buffered enough to allow
  // play() on the very first attempt.
  useEffect(() => {
    const v = heroVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const tryPlay = () => { v.play().catch(() => {}); };
    tryPlay();
    v.addEventListener('loadeddata', tryPlay);
    return () => v.removeEventListener('loadeddata', tryPlay);
  }, []);

  return (
    <div className="hlm-root" id="find">
      {/* The hero's backdrop: a recorded loop of the real sun/shadow
          animation, muted/autoplay/loop like any decorative background
          video -- no live map, no per-visitor solar fetch. Picking a
          search result still opens the report exactly as before (see
          `pick()` / PinDropTransition below); this is just chrome behind
          the search box, same as the map it replaces.

          autoPlay/muted/loop/playsInline are set as JSX attributes below,
          but on some mobile browsers React's SSR-rendered `muted`
          attribute doesn't reliably carry over to the actual DOM
          property once the page hydrates -- and a video that isn't
          *really* muted at that point fails the browser's autoplay
          policy and falls back to a native "tap to play" button instead
          of just looping. The ref + effect below force `muted` as a real
          property and retry play() ourselves, which is what actually
          fixes that on phones. */}
      <div className="hlm-map hlm-map-video">
        <video
          ref={heroVideoRef}
          className="hlm-video"
          src={HERO_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>

      <div className="hlm-glow" aria-hidden="true" />
      <div className="hlm-scrim" aria-hidden="true" />
      <div className="hlm-grain" aria-hidden="true" />

      <div className="hlm-content">
        <div className="hlm-copy">
          <span className="hlm-eyebrow">Property Intelligence</span>
          <h1 className="hlm-h1">Every property has a <span className="hlm-h1-accent" data-text="blindspot.">blindspot.</span></h1>
          {/* Per feedback that the hero was headline-only with no plain
              statement of what the tool actually does -- the typed-line
              pill below is proof (real cycling examples), not an
              explanation, so it doesn't substitute for one. One flat
              sentence, no animation of its own. */}
          <p className="hlm-sub">Get honest, hidden details on any flat, verified against public records, before you pay a token.</p>
          <p className="hlm-typed-line">
            <TypewriterCycle
              items={BLINDSPOT_EXAMPLES}
              className="hlm-typed-text"
              cursorClassName="hlm-typed-cursor"
            />
            <span className="sr-only">
              We measure what a listing leaves out: how much real sunlight this flat gets through the year, how much of it sits in shade, and what government records say about safety, water, power, schools, roads and air in the neighbourhood around it.
            </span>
          </p>
        </div>

        <div className="hlm-searchwrap" ref={boxRef}>
          {/* One shape, not a search bar with a separate card floating
              under it -- the pill IS the panel, it just grows into it.
              hlm-shell-city-open only relaxes the corner radius from a
              full pill to a rounded rect; the actual grow/reveal motion
              is hlm-city-panel-inner's grid-row transition below (see
              its own comment there for why it's a grid row and not
              max-height). Both are gated on the same cityPanelOpen flag
              so the radius and the grow move on the same frame, and this
              shell's overflow:hidden keeps the corners clean at every
              size in between. */}
          <div className={`hlm-search-shell${cityPanelOpen ? ' hlm-shell-city-open' : ''}`}>
            <div className="hlm-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              {/* A placeholder is not an accessible name -- it disappears
                  the moment you type and is not reliably announced.
                  Without a label, the only interactive control on the
                  homepage read as "edit, blank" to a screen reader. */}
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

            {cityPanel && (
              // Grid-row collapse (grid-template-rows: 0fr -> 1fr), not
              // max-height. A max-height transition to a fixed cap looked
              // fine in theory but was actually the bug: with real content
              // much shorter than the cap, an ease-out curve covers that
              // (short) real distance in the first sliver of its duration,
              // so it LOOKED like an instant snap with the rest of the
              // "transition" invisible -- confirmed frame-by-frame from a
              // recording. grid-template-rows interpolates against the
              // content's actual size every frame, so the eased curve is
              // visible across its full duration regardless of how tall
              // the content is. The inner .hlm-city-panel-body is what
              // clips (overflow+min-height:0 -- required for a grid row to
              // collapse below its content's natural height).
              <div
                id="hlm-city-panel"
                className={`hlm-city-panel-inner${cityPanelOpen ? ' is-open' : ''}`}
                role="region"
                aria-label={`Neighbourhoods in ${cityPanel.city}`}
              >
                <div className="hlm-city-panel-body">
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
                        <ul className="hlm-city-panel-list" ref={cityListRef}>
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
              </div>
            )}
          </div>

          {noMatch && !cityPanel && (
            <p className="hlm-nomatch" role="status">
              We couldn&apos;t find &ldquo;{noMatch}&rdquo;. Try adding the neighbourhood or city.
            </p>
          )}

          {/* One tap to a real result, for anyone who'd rather see what
              this does before typing their own address. Hidden while the
              city panel is open -- it grows downward into this space. */}
          {!cityPanel && (
            <div className="hlm-try" aria-label="Example places">
              <span className="hlm-try-label">Try</span>
              {TRY_PLACES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="hlm-try-chip"
                  onClick={() => pick(t)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {!cityPanel && open && results.length > 0 && (
            <ul className="hlm-suggestions" id="hlm-suggestions" role="listbox" aria-label="City, neighbourhood and address suggestions" ref={suggestionsRef}>
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

        {/* The actual navigation, invisible -- see PinDropTransition's own
            `hidden` prop. Picking an address no longer shows anything on
            screen before the report opens -- it just flies to the pin
            and opens. */}
        {pin && (
          <PinDropTransition
            href={`/report/locate?lat=${pin.lat}&lon=${pin.lon}` +
                  `&pin_code=${encodeURIComponent(pin.postcode || '')}` +
                  `&address=${encodeURIComponent(pin.label || query || '')}`}
            autoStart={autoGo}
            hidden
          >
            Open report
          </PinDropTransition>
        )}
      </div>

      {!cityPanel && !(open && (results.length > 0 || noMatch)) && (
        <span className="hlm-scroll-cue mono">Scroll<span className="hlm-scroll-cue-arrow">↓</span></span>
      )}
    </div>
  );
}
