'use client';
// components/property-score/AddressPicker.js
// Mode B of the Property Score tab: type an address (with live autocomplete
// suggestions as you type), geocode it, drop it on a Leaflet map to
// fine-tune the exact pin -- with the AsliVastu neighbourhood card for
// whatever pincode that pin falls in updating live underneath as you drag
// it, no separate "confirm" click -- then continue on to the SunScout 3D
// panel. Calls onConfirmed(lat, lon, areaRecord|null, city|null, label)
// once the user clicks through to the SunScout step.

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import AVAreaCard from './AVAreaCard';

const AddressConfirmMap = dynamic(() => import('./AddressConfirmMap'), { ssr: false });

// Bolds the part of a suggestion's label that matches what was actually
// typed, so scanning a list of 8 similar-looking addresses is faster --
// the eye goes straight to why each one matched instead of re-reading
// the whole line. Matches case-insensitively on the whole typed string
// (not word-by-word); if it doesn't appear as a contiguous substring
// (Photon can match on reordered/abbreviated tokens) it just renders
// plain, never a crash or a mangled label.
function highlightMatch(text, query) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: 'var(--text)' }}>{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function AddressPicker({ onConfirmed }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Live autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef(null);
  const abortRef = useRef(null); // cancels the previous keystroke's in-flight fetch
  const suppressNextFetch = useRef(false); // don't re-suggest right after picking one
  const wrapRef = useRef(null);
  // Caches suggestion responses per (query + rough bias location) so
  // retyping something you already typed a moment ago (a very normal
  // part of typing -- backspace, correct a letter, retype) shows results
  // instantly instead of refetching. Cleared implicitly on unmount since
  // it's just a ref.
  const suggestCacheRef = useRef(new Map());

  const [pin, setPin] = useState(null); // { lat, lon }
  const pinRef = useRef(null); // mirrors `pin`, read inside the suggestion-fetch effect so bias location is always current without retriggering that effect on every pin change
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null); // { postcode, displayName, locality, city }
  const [matchedArea, setMatchedArea] = useState(null); // AsliVastu record, or null if uncovered
  const [matchCity, setMatchCity] = useState(null);

  // Auto-locate on mount: drop the pin at the browser's reported location
  // right away instead of making the user type/search first. The search
  // bar above stays fully usable the whole time -- picking a suggestion or
  // hitting Search just overwrites this pin like normal, via lockInLocation.
  const [geoState, setGeoState] = useState('idle'); // idle | locating | granted | denied | unavailable
  const [autoLocated, setAutoLocated] = useState(false);
  // Bumped only on search/suggestion/geolocate pins (via lockInLocation),
  // never on drag/click (handleMove) -- tells AddressConfirmMap when to
  // actually fly the viewport to a new spot vs. leave it where the user
  // just placed it themselves.
  const [recenterTick, setRecenterTick] = useState(0);

  // Nominatim's postcode tagging for India is genuinely unreliable at the
  // building level -- a named society can resolve to the right lat/lon but
  // a stale/wrong district-level postcode (confirmed case: "ATS Advantage"
  // in Indirapuram, pin lands correctly, Nominatim's reverse lookup returns
  // locality:null and postcode:201001 -- central Ghaziabad, 47/C -- instead
  // of the correct 201014 Indirapuram, 78/B+). Rather than silently trust
  // that postcode into an AsliVastu match, surface it and let the user
  // correct it -- pincodeOverride starts seeded from Nominatim's answer but
  // is editable, and re-running the match against it is the actual fix.
  const [pincodeOverride, setPincodeOverride] = useState('');
  const [editingPincode, setEditingPincode] = useState(false);

  const citiesDataRef = useRef(null);

  const matchPincode = useCallback((pc) => {
    const cities = citiesDataRef.current;
    if (pc && cities) {
      for (const city of Object.keys(cities)) {
        const rec = cities[city].find(r => r.pin_code === pc);
        if (rec) { setMatchedArea(rec); setMatchCity(city); return; }
      }
    }
    setMatchedArea(null);
    setMatchCity(null);
  }, []);

  const applyPincodeOverride = () => {
    const trimmed = pincodeOverride.trim();
    setEditingPincode(false);
    matchPincode(trimmed);
  };

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => { citiesDataRef.current = data.cities; })
      .catch(() => {}); // coverage check is best-effort; search still works without it
  }, []);

  useEffect(() => { pinRef.current = pin; }, [pin]);

  // Debounced live suggestions as the user types.
  //
  // The debounce alone only stops a NEW timer from firing while you keep
  // typing -- it doesn't stop a fetch that had already gone out. Network
  // responses aren't guaranteed to come back in the order they were sent,
  // so typing fast enough that two requests are ever in flight together
  // (e.g. one for "S", triggered right before you typed the rest, and one
  // for "Sec") can land the SHORTER query's broader, less relevant
  // results AFTER the more specific ones, silently overwriting them. That
  // was the actual cause of the dropdown "appearing, disappearing,
  // glitching, mixing places from different cities" -- not a rendering
  // bug, a stale response winning the race. Aborting the previous
  // request whenever a new one starts means a stale response never has
  // the chance to land at all.
  useEffect(() => {
    if (suppressNextFetch.current) { suppressNextFetch.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.trim().length < 2) {
      setSuggestions([]); setSuggestOpen(false); setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    // Bias suggestions toward wherever the map is already sitting (current
    // pin) instead of a fixed point -- this is what actually disambiguates
    // a street name that exists in multiple covered cities.
    const biasLat = pinRef.current?.lat;
    const biasLon = pinRef.current?.lon;
    const cacheKey = `${query.trim().toLowerCase()}|${biasLat ? `${biasLat.toFixed(2)},${biasLon.toFixed(2)}` : ''}`;
    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setSuggestOpen(true);
      setHighlightIndex(-1);
      setSuggestLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const biasQS = biasLat && biasLon ? `&lat=${biasLat}&lon=${biasLon}` : '';
        const res = await fetch(`/api/sunscout/geocode-suggest?q=${encodeURIComponent(query)}${biasQS}`, { signal: controller.signal });
        const data = await res.json();
        const results = data?.results || [];
        // Small LRU-ish cap so this can't grow unbounded in a long session.
        if (suggestCacheRef.current.size >= 100) {
          suggestCacheRef.current.delete(suggestCacheRef.current.keys().next().value);
        }
        suggestCacheRef.current.set(cacheKey, results);
        setSuggestions(results);
        setSuggestOpen(true);
        setHighlightIndex(-1);
        setSuggestLoading(false);
      } catch (err) {
        // Aborted because a newer keystroke superseded this request --
        // leave whatever's currently on screen alone instead of flashing
        // it to empty (that flash-to-empty was the "disappears" part).
        if (err?.name === 'AbortError') return;
        setSuggestions([]);
        setSuggestLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  // Try the browser's geolocation the moment this step mounts, and drop
  // the pin there automatically if the user allows it -- no need to type
  // or search first. lockInLocation is defined further below in this
  // component, but that's fine: this effect only runs (and only calls it)
  // after the whole render has finished and lockInLocation is assigned.
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGeoState('unavailable'); return; }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState('granted');
        setAutoLocated(true);
        lockInLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => { setGeoState('denied'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const resolveCoverage = useCallback(async (lat, lon) => {
    setResolving(true);
    setResolved(null);
    setMatchedArea(null);
    setMatchCity(null);
    setPincodeOverride('');
    setEditingPincode(false);
    try {
      const res = await fetch(`/api/sunscout/reverse-geocode?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data?.result) {
        setResolved(data.result);
        const postcode = data.result.postcode || '';
        setPincodeOverride(postcode);
        matchPincode(postcode);
      }
    } catch {
      // Non-fatal -- the user can still continue with a SunScout-only score.
    } finally {
      setResolving(false);
    }
  }, [matchPincode]);

  const lockInLocation = (lat, lon) => {
    setPin({ lat, lon });
    setRecenterTick(t => t + 1);
    resolveCoverage(lat, lon);
  };

  const pickSuggestion = (s) => {
    suppressNextFetch.current = true;
    setQuery(s.displayName);
    setSuggestOpen(false);
    setSuggestions([]);
    setAutoLocated(false);
    lockInLocation(s.lat, s.lon);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSuggestOpen(false);
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/sunscout/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.result) {
        setAutoLocated(false);
        lockInLocation(data.result[0], data.result[1]);
      } else {
        setSearchError("Couldn't find that address — try adding city/area, or a more specific landmark.");
      }
    } catch {
      setSearchError('Search failed — please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (suggestOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape') { setSuggestOpen(false); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0) { pickSuggestion(suggestions[highlightIndex]); return; }
        handleSearch();
        return;
      }
    } else if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleMove = useCallback((lat, lon) => {
    setAutoLocated(false);
    setPin({ lat, lon });
    resolveCoverage(lat, lon);
  }, [resolveCoverage]);

  // Once the auto-located pin resolves to an address, echo it into the
  // search box -- purely cosmetic (so the box isn't left blank next to a
  // filled-in map), doesn't refire the suggestion fetch since it's a
  // straight setQuery, not a keystroke.
  useEffect(() => {
    if (autoLocated && resolved?.displayName && !query) {
      suppressNextFetch.current = true;
      setQuery(resolved.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocated, resolved]);

  const continueToSunScout = () => {
    if (!pin) return;
    const label = resolved?.displayName || query;
    onConfirmed(pin.lat, pin.lon, matchedArea, matchCity, label);
  };

  return (
    <div style={{ marginBottom: 36 }}>
      <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>ENTER YOUR ADDRESS</div>
      <div ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Start typing an address, building, or landmark…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={e => { if (suggestions.length > 0) setSuggestOpen(true); e.target.select(); }}
            autoComplete="off"
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
          />

          {suggestOpen && (suggestLoading || suggestions.length > 0) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
              maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
            }}>
              {suggestLoading && suggestions.length === 0 && (
                <div className="mono" style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>Searching…</div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.lat}-${s.lon}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className="ps-row-btn"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: i === highlightIndex ? 'rgba(224,123,0,0.12)' : 'transparent',
                    border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    padding: '10px 14px', cursor: 'pointer', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4,
                  }}>
                  {highlightMatch(s.displayName, query)}
                  {s.postcode && <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11.5 }}> · {s.postcode}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSearch} disabled={searching || !query.trim()} className="ps-btn ps-cta-btn"
          style={{
            background: 'var(--sun)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
            padding: '12px 22px', fontSize: 13.5, fontWeight: 700, cursor: searching ? 'default' : 'pointer',
            opacity: searching ? .6 : 1,
          }}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10 }}>
        {geoState === 'locating' && !pin
          ? 'Locating you… the map will open at your current spot — search above any time to change it.'
          : 'Pick a suggestion as you type, or press Search / Enter for the best match.'}
      </div>
      {searchError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{searchError}</div>}

      {pin && (
        <>
          {/* No separate "confirm" click anymore -- the map's only job is
              letting you fine-tune the exact building (geocoding can land
              a street or two off), not gating progress behind an extra
              button. The neighbourhood score below updates live as you
              drag/click the pin (handleMove re-resolves on every move),
              so what you see is already final; Continue is right there
              the moment it settles. */}
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10, marginTop: 22 }}>
            EXACT PIN
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10 }}>
            {autoLocated
              ? "This is your current location — drag the pin, click the map, or search above if it's not right."
              : 'Drag the pin or click the map if it\u2019s not exactly on the building.'}
          </div>
          <div style={{ height: 360, border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
            <AddressConfirmMap lat={pin.lat} lon={pin.lon} onMove={handleMove} recenterKey={recenterTick} />
          </div>

          {resolving && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 16 }}>Looking up this location…</div>
          )}

          {resolved && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 16, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>{resolved.displayName || `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}`}</div>
              {/* Auto-detected postcode is Nominatim's best guess, not ground
                  truth -- it's wrong often enough for India (confirmed case:
                  a correctly-placed pin still returning a stale district-level
                  postcode instead of the actual local one) that we surface it
                  explicitly and editable here, rather than letting a silent
                  wrong match produce a misleading AsliVastu score below. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-dim)' }}>Detected pincode:</span>
                {!editingPincode ? (
                  <>
                    <strong style={{ color: 'var(--text)', fontSize: 14 }}>{pincodeOverride || 'none found'}</strong>
                    <button type="button" onClick={() => setEditingPincode(true)} className="ps-btn"
                      style={{
                        background: 'var(--bg-2)', border: '1px solid var(--ss)', color: 'var(--ss)',
                        borderRadius: 'var(--radius)', padding: '6px 13px', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', letterSpacing: '.02em',
                      }}>
                      Not right? Correct it
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text" inputMode="numeric" value={pincodeOverride} maxLength={6} autoFocus
                      onChange={e => setPincodeOverride(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') applyPincodeOverride(); if (e.key === 'Escape') setEditingPincode(false); }}
                      style={{ width: 90, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '5px 8px', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button type="button" onClick={applyPincodeOverride} className="ps-btn ps-cta-btn"
                      style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Apply
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!resolving && (
            <>
              <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12, marginTop: 8 }}>
                NEIGHBOURHOOD SCORE FOR THIS PIN
              </div>

              {matchedArea ? (
                <AVAreaCard record={matchedArea} city={matchCity} citiesData={citiesDataRef.current} />
              ) : (
                <div style={{ marginBottom: 24, border: '1px solid var(--line)', borderLeft: '4px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', lineHeight: 1.6 }}>
                    No Neighbourhood Score coverage for pincode {pincodeOverride || resolved?.postcode || 'this location'} yet — you&apos;ll still get a Home Comfort Score for the unit, just without an area score to combine it with. If that pincode looks wrong, scroll up and correct it above.
                  </div>
                </div>
              )}

              <button onClick={continueToSunScout} className="ps-btn ps-cta-btn"
                style={{
                  background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                  padding: '14px 24px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
                }}>
                Continue to Sun &amp; Shadow →
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
