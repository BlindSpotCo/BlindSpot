'use client';
// lib/trends/useTrends.js
//
// One fetch of /api/trends per ~1 km spot per tab, shared by every caller
// (each score row, the report modal). Returns null until it arrives, and
// stays null if it fails -- the rows just show no trend.

import { useEffect, useState } from 'react';

const cache = new Map(); // key -> Promise<result|null>

function keyOf(lat, lon) {
  return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

export function loadTrends(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return Promise.resolve(null);
  const k = keyOf(lat, lon);
  if (!cache.has(k)) {
    const p = fetch(`/api/trends?lat=${Number(lat).toFixed(4)}&lon=${Number(lon).toFixed(4)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.series && Object.keys(j.series).length ? j : null))
      .catch(() => null);
    // A failed load is forgotten, so the next view can try again.
    p.then((v) => { if (!v) cache.delete(k); });
    cache.set(k, p);
  }
  return cache.get(k);
}

export function useTrends(lat, lon) {
  const k = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? keyOf(lat, lon) : null;
  const [state, setState] = useState({ key: null, data: null });
  useEffect(() => {
    if (!k) return undefined;
    let live = true;
    loadTrends(lat, lon).then((data) => { if (live) setState({ key: k, data }); });
    return () => { live = false; };
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  // Never hand back the previous address's trends while the new ones load.
  return state.key === k ? state.data : null;
}
