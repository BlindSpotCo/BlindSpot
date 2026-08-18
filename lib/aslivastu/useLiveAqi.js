'use client';
// lib/aslivastu/useLiveAqi.js
// Fetches the live nearest-station AQI for a record's coordinates and
// folds it into a copy of that record (air score + recomputed composite
// + grade). Shared by both surfaces that render the area spec sheet, so
// the live merge can't drift between them the way the styling did.
//
// Returns the record UNCHANGED until a live reading actually arrives, and
// leaves it unchanged permanently if none ever does (no token, upstream
// down, no station in range). That means the page always has a complete
// record to render immediately -- there's no loading state where the
// score is blank or zero, and no error state to design for. The only
// visible difference between "live" and "fallback" is the aqi_is_live
// flag the UI uses for its badge.

import { useState, useEffect } from 'react';
import { withLiveAqi } from './aqi';

export default function useLiveAqi(record) {
  const [live, setLive] = useState(null);

  const lat = record?.lat;
  const lon = record?.lon;

  useEffect(() => {
    if (lat == null || lon == null) return;
    // Guards against a late response from a previous area overwriting the
    // current one -- switching localities quickly would otherwise show
    // the wrong pin's air reading, and because it feeds the composite,
    // the wrong headline score with it.
    let cancelled = false;
    setLive(null);

    fetch(`/api/aqi?lat=${lat}&lon=${lon}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && d.aqi != null) setLive(d); })
      .catch(() => { /* stored snapshot stands */ });

    return () => { cancelled = true; };
  }, [lat, lon]);

  return live ? withLiveAqi(record, live) : record;
}
