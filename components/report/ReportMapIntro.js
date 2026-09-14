'use client';

// components/report/ReportMapIntro.js
//
// Split out from ReportScreen.js on its own -- leaflet touches `window`
// at module-load time, so importing it directly in ReportScreen (which
// /report prerenders statically) breaks the build with
// "ReferenceError: window is not defined". This file is instead loaded
// with next/dynamic({ ssr:false }) from ReportScreen, same fix
// HeroLiveMap.js already applies for the homepage's own Leaflet map.
//
// This is just the <MapContainer> itself -- the fixed-height card around
// it (.bsr-map-intro) stays in ReportScreen.js and always renders, so the
// layout doesn't jump once this chunk finishes loading and pops in.

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Same pin dot/ring as the homepage hero's map (.hlm-pin-* lives in
// globals.css, loaded app-wide) -- one visual language for "here's the
// pin" everywhere this app shows a map, not a second one invented here.
const reportPinIcon = L.divIcon({
  className: 'hlm-pin-icon',
  html: '<span class="hlm-pin-ring"></span><span class="hlm-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Mirrors the hero's own IntroFly -- mounts a little wide, then glides in
// to the resting zoom once, on mount only. Kept separate from the actual
// verdict/score fetching in ReportScreen: this is purely the "you're
// looking at the right spot" moment before any numbers show.
function ReportMapFly({ lat, lon }) {
  const map = useMap();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { map.setView([lat, lon], 15); return; }
    const t = setTimeout(() => {
      map.flyTo([lat, lon], 15, { duration: 1.6, easeLinearity: 0.2 });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// The map, on top, before any score -- the report used to open straight
// on the verdict number with no sense of place at all. Non-interactive
// (this is a "here's where", not a second address-picker) and it never
// blocks the verdict below it -- no hold, no gate, just the same address
// the header line above it already names, now shown rather than only said.
export default function ReportMapIntro({ lat, lon }) {
  return (
    <MapContainer
      center={[lat, lon]}
      zoom={11}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl={false}
      className="bsr-map-intro-map"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        detectRetina
      />
      <Marker position={[lat, lon]} icon={reportPinIcon} />
      <ReportMapFly lat={lat} lon={lon} />
    </MapContainer>
  );
}
