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

import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PinDropTransition from '@/components/PinDropTransition';

// Same default coordinates as the homepage's original rotating
// coordinate readout -- opens on the same place that readout used to cite.
const DEFAULT_CENTER = { lat: 12.9716, lon: 77.5946 };
const DEFAULT_ZOOM = 12.4;
const FLY_ZOOM = 15;

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

const INSIGHTS = [
  { key: 'light', label: 'Bright most of the year', sub: 'Home Comfort preview', accent: 'sun' },
  { key: 'area', label: 'Safe, well-connected area', sub: 'Neighbourhood preview', accent: 'slate' },
  { key: 'watch', label: 'One thing worth checking', sub: 'Flagged in full report', accent: 'warn' },
];

export default function HeroLiveMapCanvas() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState(null);
  const [flyKey, setFlyKey] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

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
    setTimeout(() => setRevealed(true), 900);
  };

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="hlm-root">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={pin ? FLY_ZOOM : DEFAULT_ZOOM}
        zoomControl={false}
        scrollWheelZoom
        className="hlm-map"
      >
        <TileLayer
          className="hlm-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {pin && <Marker position={[pin.lat, pin.lon]} icon={pinIcon} />}
        <FlyTo lat={center.lat} lon={center.lon} zoom={pin ? FLY_ZOOM : DEFAULT_ZOOM} flyKey={flyKey} />
      </MapContainer>

      <div className="hlm-scrim" aria-hidden="true" />

      <div className="hlm-content">
        <div className="hlm-copy">
          <span className="hlm-eyebrow">Property Intelligence</span>
          <h1 className="hlm-h1">What do you want to know about this place?</h1>
          <p className="hlm-sub">See beyond the listing. BlindSpot reveals what you can&apos;t see from the map alone.</p>
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
          <div className={`hlm-insights${revealed ? ' is-visible' : ''}`}>
            {INSIGHTS.map((ins) => (
              <div className={`hlm-chip hlm-chip-${ins.accent}`} key={ins.key}>
                <span className="hlm-chip-label">{ins.label}</span>
                <span className="hlm-chip-sub">{ins.sub}</span>
              </div>
            ))}
            <PinDropTransition href="/property-score" className="hlm-cta">
              See the full breakdown <span>→</span>
            </PinDropTransition>
          </div>
        )}
      </div>

      <span className="hlm-scroll-cue mono">Scroll<span className="hlm-scroll-cue-arrow">↓</span></span>
    </div>
  );
}
