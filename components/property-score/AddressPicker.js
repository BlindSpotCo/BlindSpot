'use client';
// components/property-score/AddressPicker.js
// The "I know the address" half of the Location tab: search (or auto-GPS)
// a spot, fine-tune the pin on a map, and see the neighbourhood card for
// whatever pincode it lands in.
//
// This used to be a three-button staircase -- Search, then "Confirm This
// Pin →", then "Continue to Sun & Shadow →", and THEN the Location tab's
// own "Continue — Configure Your Unit →" underneath it. Three buttons for
// one decision, two of which said the same thing. The pin is now reported
// upward the moment it resolves (onConfirmed fires from an effect), so
// the area card just appears and the tab's single Continue is the only
// button left. Moving the pin simply re-reports it.

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import AVAreaCard from './AVAreaCard';
import AddressSearchBar from './AddressSearchBar';

const AddressConfirmMap = dynamic(() => import('./AddressConfirmMap'), { ssr: false });

export default function AddressPicker({ onConfirmed, initialLat, initialLon }) {
  const [pin, setPin] = useState(
    initialLat && initialLon ? { lat: Number(initialLat), lon: Number(initialLon) } : null
  );
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(null); // { postcode, displayName, locality, city }
  const [matchedArea, setMatchedArea] = useState(null);
  const [matchCity, setMatchCity] = useState(null);
  const [autoLocated, setAutoLocated] = useState(false);
  const [geoState, setGeoState] = useState('idle'); // idle | locating | granted | denied | unavailable
  const [typedLabel, setTypedLabel] = useState('');

  // Bumped only on search/suggestion/GPS pins, never on drag/click --
  // tells AddressConfirmMap when to fly the viewport somewhere new vs.
  // leave it where the user just put it themselves.
  const [recenterTick, setRecenterTick] = useState(0);

  // Nominatim's postcode tagging for India is unreliable at building
  // level -- a named society can resolve to the right lat/lon but a
  // stale district-level postcode. Rather than silently trust it into a
  // neighbourhood match, surface it editable.
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
    setEditingPincode(false);
    matchPincode(pincodeOverride.trim());
  };

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => { citiesDataRef.current = data.cities; })
      .catch(() => {}); // coverage check is best-effort
  }, []);

  const resolveCoverage = useCallback(async (lat, lon) => {
    setResolving(true);
    setResolved(null); setMatchedArea(null); setMatchCity(null);
    setPincodeOverride(''); setEditingPincode(false);
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
      // Non-fatal -- a unit-only Home Comfort Score still works.
    } finally {
      setResolving(false);
    }
  }, [matchPincode]);

  const setPinFromSearch = (lat, lon, label) => {
    setAutoLocated(false);
    setTypedLabel(label || '');
    setPin({ lat, lon });
    setRecenterTick(t => t + 1);
    resolveCoverage(lat, lon);
  };

  const handleMove = useCallback((lat, lon) => {
    setAutoLocated(false);
    setTypedLabel('');
    setPin({ lat, lon });
    resolveCoverage(lat, lon);
  }, [resolveCoverage]);

  // Auto-locate on mount unless the parent already handed us a pin --
  // opening straight at the user's own spot beats a blank map waiting to
  // be typed into. The search bar above stays fully usable throughout.
  const didAutoLocate = useRef(false);
  useEffect(() => {
    if (didAutoLocate.current) return;
    didAutoLocate.current = true;
    if (pin) { resolveCoverage(pin.lat, pin.lon); return; }
    if (!('geolocation' in navigator)) { setGeoState('unavailable'); return; }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState('granted');
        setAutoLocated(true);
        setPin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setRecenterTick(t => t + 1);
        resolveCoverage(pos.coords.latitude, pos.coords.longitude);
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report every settled pin straight upward instead of behind a
  // "Confirm" button -- see the file header. Runs after the reverse
  // lookup so the label and area match are already the current ones.
  useEffect(() => {
    if (!pin || resolving) return;
    const label = resolved?.displayName || typedLabel || `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}`;
    onConfirmed(pin.lat, pin.lon, matchedArea, matchCity, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, resolving, matchedArea, matchCity, resolved]);

  const searchValue = resolved?.displayName || typedLabel || '';

  return (
    <div style={{ marginBottom: 36 }}>
      <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>
        WHERE IS THE PLACE?
      </div>

      <AddressSearchBar
        onPicked={setPinFromSearch}
        value={searchValue}
        biasLat={pin?.lat ?? null}
        biasLon={pin?.lon ?? null}
        showMyLocation
        placeholder="Type an address, building or landmark…"
      />

      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 10 }}>
        {geoState === 'locating' && !pin
          ? 'Opening the map at your current location — search above any time to change it.'
          : 'Pick a suggestion as you type, or drag the pin on the map to the exact building.'}
      </div>

      {pin && (
        <>
          <div style={{ height: 360, border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', margin: '18px 0 16px' }}>
            <AddressConfirmMap lat={pin.lat} lon={pin.lon} onMove={handleMove} recenterKey={recenterTick} />
          </div>

          {resolving && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 16 }}>Looking up this location…</div>
          )}

          {resolved && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 16, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8 }}>
                {autoLocated ? '📍 Your current location — ' : '📍 '}
                {resolved.displayName || `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-dim)' }}>Detected pincode:</span>
                {!editingPincode ? (
                  <>
                    <strong style={{ color: 'var(--text)', fontSize: 14 }}>{pincodeOverride || 'none found'}</strong>
                    <button type="button" onClick={() => setEditingPincode(true)} className="ps-btn"
                      style={{
                        background: 'var(--bg-2)', border: '1px solid var(--ss)', color: 'var(--ss)',
                        borderRadius: 'var(--radius)', padding: '6px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
                    No Neighbourhood Score coverage for pincode {pincodeOverride || resolved?.postcode || 'this location'} yet — you&apos;ll still get a Home Comfort Score for the unit, just without an area score to combine it with. If that pincode looks wrong, correct it above.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
