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
  const suppressNextFetch = useRef(false); // don't re-suggest right after picking one
  const wrapRef = useRef(null);

  const [pin, setPin] = useState(null); // { lat, lon }
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null); // { postcode, displayName, locality, city }
  const [matchedArea, setMatchedArea] = useState(null); // AsliVastu record, or null if uncovered
  const [matchCity, setMatchCity] = useState(null);

  const citiesDataRef = useRef(null);

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => { citiesDataRef.current = data.cities; })
      .catch(() => {}); // coverage check is best-effort; search still works without it
  }, []);

  // Debounced live suggestions as the user types.
  useEffect(() => {
    if (suppressNextFetch.current) { suppressNextFetch.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setSuggestions([]); setSuggestOpen(false); setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sunscout/geocode-suggest?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data?.results || []);
        setSuggestOpen(true);
        setHighlightIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
    try {
      const res = await fetch(`/api/sunscout/reverse-geocode?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data?.result) {
        setResolved(data.result);
        const postcode = data.result.postcode;
        const cities = citiesDataRef.current;
        if (postcode && cities) {
          for (const city of Object.keys(cities)) {
            const rec = cities[city].find(r => r.pin_code === postcode);
            if (rec) { setMatchedArea(rec); setMatchCity(city); break; }
          }
        }
      }
    } catch {
      // Non-fatal -- the user can still continue with a SunScout-only score.
    } finally {
      setResolving(false);
    }
  }, []);

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
      <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>STEP 1 — ENTER YOUR ADDRESS</div>
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
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '12px 14px', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
          />

          {suggestOpen && (suggestLoading || suggestions.length > 0) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20,
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 3,
              maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
            }}>
              {suggestLoading && suggestions.length === 0 && (
                <div className="mono" style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--text-dim)' }}>Searching…</div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.lat}-${s.lon}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: i === highlightIndex ? 'rgba(224,123,0,0.12)' : 'transparent',
                    border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    padding: '10px 14px', cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.4,
                  }}>
                  {s.displayName}
                  {s.postcode && <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10.5 }}> · {s.postcode}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSearch} disabled={searching || !query.trim()}
          style={{
            background: 'var(--sun)', color: '#fff', border: 'none', borderRadius: 3,
            padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: searching ? 'default' : 'pointer',
            opacity: searching ? .6 : 1,
          }}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
        Pick a suggestion as you type, or press Search / Enter for the best match.
      </div>
      {searchError && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{searchError}</div>}

      {pin && (
        <>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10, marginTop: 22 }}>
            STEP 2 — CONFIRM THE EXACT PIN
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
            Drag the pin or click the map to fine-tune the exact building, then confirm.
          </div>
          <div style={{ height: 360, border: '1px solid var(--line)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <AddressConfirmMap lat={pin.lat} lon={pin.lon} onMove={handleMove} />
          </div>

          {resolving && (
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 16 }}>Looking up this location…</div>
          )}

          {!resolving && !locationConfirmed && (
            <button onClick={confirmLocation}
              style={{
                background: 'var(--slate)', color: '#fff', border: 'none', borderRadius: 3,
                padding: '13px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
                marginBottom: 20,
              }}>
              Confirm This Pin →
            </button>
          )}

          {resolved && (
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-mute)', marginBottom: locationConfirmed ? 20 : 0 }}>
              {resolved.displayName || `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}`}
            </div>
          )}

          {locationConfirmed && (
            <>
              <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12, marginTop: 8 }}>
                STEP 3 — ASLIVASTU AREA SCORE
              </div>

              {matchedArea ? (
                <AVAreaCard record={matchedArea} city={matchCity} citiesData={citiesDataRef.current} />
              ) : (
                <div style={{ marginBottom: 24, border: '1px solid var(--line)', borderLeft: '4px solid var(--line)', borderRadius: 3, padding: '18px 20px' }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', lineHeight: 1.6 }}>
                    No AsliVastu coverage for pincode {resolved?.postcode || 'this location'} yet — you&apos;ll still get SunScout&apos;s Home Comfort Score for the unit, just without an area score to combine it with.
                  </div>
                </div>
              )}

              <button onClick={continueToSunScout}
                style={{
                  background: 'linear-gradient(90deg, var(--sun), var(--slate))', color: '#fff', border: 'none', borderRadius: 3,
                  padding: '14px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
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
