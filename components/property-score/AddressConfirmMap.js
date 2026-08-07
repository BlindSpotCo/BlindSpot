'use client';
// components/property-score/AddressConfirmMap.js
// Small Leaflet + OpenStreetMap map with a single draggable marker, used to
// let the user fine-tune a geocoded address before handing lat/lon off to
// the SunScout 3D panel. Dynamically imported with ssr:false from
// AddressPicker, since Leaflet needs `window`.

import { useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

export default function AddressConfirmMap({ lat, lon, onMove }) {
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
    </MapContainer>
  );
}
