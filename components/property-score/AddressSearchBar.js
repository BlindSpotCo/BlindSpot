'use client';
// components/property-score/AddressSearchBar.js
// One address search bar, used everywhere a location can be set: the
// Location tab (AddressPicker) and the Unit tab (UnitVerdict, above the
// 3D map). It used to exist only inside AddressPicker, which is why
// landing anywhere else in the flow left you with raw lat/lon boxes or
// nothing at all -- the whole point of pulling it out here is that
// "type where you live" works on any tab, on its own, without having
// come through the tab before it.
//
// Owns: the text query, debounced autocomplete, the abort/race handling
// and the response cache. Does NOT own the pin -- it just calls
// onPicked(lat, lon, label) and lets the parent decide what that means.
//
// `useMyLocation` renders the GPS button inline (the Unit tab wants it;
// AddressPicker auto-locates on mount instead and doesn't).

import { useState, useEffect, useRef } from 'react';

// Bolds the part of a suggestion's label that matches what was actually
// typed, so scanning 8 similar-looking addresses is faster. Falls back to
// plain text when the query isn't a contiguous substring (Photon can
// match on reordered/abbreviated tokens) -- never a crash or a mangled
// label.
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

export default function AddressSearchBar({
  onPicked,
  placeholder = 'Search any address, building or landmark…',
  value = '',
  biasLat = null,
  biasLon = null,
  showMyLocation = false,
  onGpsError,
  compact = false,
  autoFocus = false,
}) {
  const [query, setQuery] = useState(value);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const debounceRef = useRef(null);
  const abortRef = useRef(null);       // cancels the previous keystroke's in-flight fetch
  const suppressRef = useRef(false);   // don't re-suggest right after picking one
  const wrapRef = useRef(null);
  const cacheRef = useRef(new Map());
  const biasRef = useRef({ lat: biasLat, lon: biasLon });

  useEffect(() => { biasRef.current = { lat: biasLat, lon: biasLon }; }, [biasLat, biasLon]);

  // Keep the box showing whatever the parent last resolved (e.g. the
  // reverse-geocoded name of a GPS pin, or a locality picked elsewhere)
  // without that echo counting as a keystroke.
  useEffect(() => {
    if (value && value !== query) { suppressRef.current = true; setQuery(value); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced live suggestions.
  //
  // The debounce alone only stops a NEW timer from firing while you keep
  // typing -- it doesn't stop a fetch already in flight, and responses
  // aren't guaranteed to come back in send order. A short query's
  // broader results landing after a more specific one is what made the
  // dropdown appear to flicker and mix cities. Aborting the previous
  // request whenever a new one starts means a stale response never lands.
  useEffect(() => {
    if (suppressRef.current) { suppressRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.trim().length < 2) {
      setSuggestions([]); setOpen(false); setLoadingSuggest(false);
      return;
    }
    setLoadingSuggest(true);
    const { lat: bLat, lon: bLon } = biasRef.current;
    const cacheKey = `${query.trim().toLowerCase()}|${bLat ? `${Number(bLat).toFixed(2)},${Number(bLon).toFixed(2)}` : ''}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached); setOpen(true); setHighlightIndex(-1); setLoadingSuggest(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const biasQS = bLat && bLon ? `&lat=${bLat}&lon=${bLon}` : '';
        const res = await fetch(`/api/sunscout/geocode-suggest?q=${encodeURIComponent(query)}${biasQS}`, { signal: controller.signal });
        const data = await res.json();
        const results = data?.results || [];
        if (cacheRef.current.size >= 100) cacheRef.current.delete(cacheRef.current.keys().next().value);
        cacheRef.current.set(cacheKey, results);
        setSuggestions(results); setOpen(true); setHighlightIndex(-1); setLoadingSuggest(false);
      } catch (err) {
        // Superseded by a newer keystroke -- leave what's on screen alone
        // rather than flashing it empty.
        if (err?.name === 'AbortError') return;
        setSuggestions([]); setLoadingSuggest(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (s) => {
    suppressRef.current = true;
    setQuery(s.displayName);
    setOpen(false); setSuggestions([]); setError('');
    onPicked(s.lat, s.lon, s.displayName);
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setOpen(false); setSearching(true); setError('');
    try {
      const res = await fetch(`/api/sunscout/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.result) {
        onPicked(data.result[0], data.result[1], query);
      } else {
        setError("Couldn't find that — try adding the city or area, or a nearby landmark.");
      }
    } catch {
      setError('Search failed — please try again.');
    } finally {
      setSearching(false);
    }
  };

  const locateMe = () => {
    setError('');
    if (!('geolocation' in navigator)) { const m = 'This browser cannot share your location.'; setError(m); onGpsError?.(m); return; }
    navigator.geolocation.getCurrentPosition(
      pos => onPicked(pos.coords.latitude, pos.coords.longitude, null),
      err => {
        const m = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — search for your address instead.'
          : 'Could not get your location right now — search for your address instead.';
        setError(m); onGpsError?.(m);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const onKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0) { pick(suggestions[highlightIndex]); return; }
        runSearch(); return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault(); runSearch();
    }
  };

  const pad = compact ? '9px 12px' : '12px 14px';
  const fs = compact ? 13.5 : 14;

  return (
    <div>
      <div ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative', minWidth: 0 }}>
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            autoFocus={autoFocus}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            autoComplete="off"
            aria-label="Search for a location"
            style={{
              width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', padding: pad, color: 'var(--text)', fontSize: fs, boxSizing: 'border-box',
            }}
          />
          {open && (loadingSuggest || suggestions.length > 0) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 400,
              background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
              maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
            }}>
              {loadingSuggest && suggestions.length === 0 && (
                <div className="mono" style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-dim)' }}>Searching…</div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.lat}-${s.lon}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className="ps-row-btn"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: i === highlightIndex ? 'rgba(224,123,0,0.12)' : 'transparent',
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

        {showMyLocation && (
          <button type="button" onClick={locateMe} className="ps-btn" title="Use my current location"
            style={{
              background: 'transparent', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
              padding: compact ? '9px 14px' : '12px 16px', color: 'var(--text)', fontSize: 13, cursor: 'pointer', flexShrink: 0,
            }}>
            ◎ My location
          </button>
        )}

        <button type="button" onClick={runSearch} disabled={searching || !query.trim()} className="ps-btn ps-cta-btn"
          style={{
            background: 'var(--sun)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
            padding: compact ? '9px 18px' : '12px 22px', fontSize: 13.5, fontWeight: 700,
            cursor: searching || !query.trim() ? 'default' : 'pointer', opacity: searching || !query.trim() ? .55 : 1, flexShrink: 0,
          }}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: 12.5, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
