'use client';
// components/property-score/AddressConfirmMap.js
// Small Leaflet + OpenStreetMap map with a single draggable marker, used to
// let the user fine-tune a geocoded address before handing lat/lon off to
// the SunScout 3D panel. Dynamically imported with ssr:false from
// AddressPicker, since Leaflet needs `window`.

import { useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon points at bundled image paths that don't
// survive a webpack build -- point it at the CDN copies instead of
// wrestling with asset imports for three tiny PNGs.
const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickToMove({ onMove }) {
  useMapEvents({
    click(e) { onMove(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

// MapContainer's `center`/`zoom` props are only read once, on mount --
// react-leaflet does NOT pan the view just because those props change
// later. So when a new search result comes in and this component gets a
// new lat/lon, the Marker (which is controlled by `position`) jumps to
// the right spot, but the map viewport itself never moves -- looking
// exactly like "nothing happened" if the new pin is off-screen, or like a
// silent no-op if it's nearby. This flies the view there explicitly.
//
// `recenterKey` is bumped by the parent only for search/suggestion/geolocate
// results -- NOT for drag/click, which already put the view exactly where
// the user wanted it and shouldn't be yanked away right after.
function Recenter({ lat, lon, recenterKey }) {
  const map = useMap();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; } // MapContainer's own `center` already handled this
    map.flyTo([lat, lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
}

export default function AddressConfirmMap({ lat, lon, onMove, recenterKey }) {
  const markerRef = useRef(null);
  const center = useMemo(() => [lat, lon], [lat, lon]);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onMove(pos.lat, pos.lng);
      }
    },
  }), [onMove]);

  return (
    <MapContainer center={center} zoom={16} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={center}
        icon={pinIcon}
        draggable
        eventHandlers={eventHandlers}
        ref={markerRef}
      />
      <ClickToMove onMove={onMove} />
      <Recenter lat={lat} lon={lon} recenterKey={recenterKey} />
    </MapContainer>
  );
}
