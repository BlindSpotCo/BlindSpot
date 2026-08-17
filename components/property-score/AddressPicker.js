'use client';
// components/property-score/AddressPicker.js
// Mode B of the Property Score tab: type an address (with live autocomplete
// suggestions as you type), geocode it, drop it on a Leaflet map to
// fine-tune the exact pin, confirm the location, then see the FULL
// AsliVastu detail card for whatever pincode that pin falls in (same card
// as the city/locality flow) -- and only after that, continue on to the
// SunScout 3D panel. Calls onConfirmed(lat, lon, areaRecord|null,
// city|null, label) once the user clicks through to the SunScout step.

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import AVAreaCard from './AVAreaCard';

const AddressConfirmMap = dynamic(() => import('./AddressConfirmMap'), { ssr: false });

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

  const [pin, setPin] = useState(null); // { lat, lon }
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null); // { postcode, displayName, locality, city }
  const [matchedArea, setMatchedArea] = useState(null); // AsliVastu record, or null if uncovered
  const [matchCity, setMatchCity] = useState(null);

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

    if (query.trim().length < 3) {
      setSuggestions([]); setSuggestOpen(false); setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/sunscout/geocode-suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setSuggestions(data?.results || []);
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
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

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
    setLocationConfirmed(false);
    resolveCoverage(lat, lon);
  };

  const pickSuggestion = (s) => {
    suppressNextFetch.current = true;
    setQuery(s.displayName);
    setSuggestOpen(false);
    setSuggestions([]);
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
    setPin({ lat, lon });
    setLocationConfirmed(false);
    resolveCoverage(lat, lon);
  }, [resolveCoverage]);

  const confirmLocation = () => setLocationConfirmed(true);

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
            onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
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
                  {s.displayName}
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
        Pick a suggestion as you type, or press Search / Enter for the best match.
      </div>
      {searchError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{searchError}</div>}

      {pin && (
        <>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10, marginTop: 22 }}>
            CONFIRM THE EXACT PIN
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 10 }}>
            Drag the pin or click the map to fine-tune the exact building, then confirm.
          </div>
          <div style={{ height: 360, border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
            <AddressConfirmMap lat={pin.lat} lon={pin.lon} onMove={handleMove} />
          </div>

          {resolving && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 16 }}>Looking up this location…</div>
          )}

          {/* Moved above the Confirm button -- it used to render AFTER it,
              so the pincode-correction control sat below the button that
              visually reads as "the next step," easy to skip right past
              even though wrong-pincode is exactly the case you'd want to
              catch BEFORE confirming. Same reason the "correct it" trigger
              is now a bordered button instead of small underlined text --
              it used to be easy to miss entirely next to the bold detected
              value. */}
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

          {!resolving && !locationConfirmed && (
            <button onClick={confirmLocation} className="ps-btn ps-cta-btn"
              style={{
                background: 'var(--slate)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
                padding: '13px 22px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
                marginBottom: 20,
              }}>
              Confirm This Pin →
            </button>
          )}

          {locationConfirmed && (
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
