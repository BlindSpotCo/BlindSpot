'use client';
// components/property-score/PropertyScoreFlow.js
// The Property Score tab's flow: pick an entry mode (city -> locality ->
// unit drilldown, or type an address directly), then share the same
// SunScout 3D panel + verdict step regardless of which mode got you there.

import { useState, useCallback } from 'react';
import LocalityPicker from './LocalityPicker';
import AddressPicker from './AddressPicker';
import UnitVerdict from './UnitVerdict';

export default function PropertyScoreFlow() {
  const [mode, setMode] = useState(null); // 'locality' | 'address'

  const [areaRecord, setAreaRecord] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [city, setCity] = useState(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon('');
  };

  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    resetLocation();
  };

  const handleAreaSelected = useCallback((record, cityName) => {
    setAreaRecord(record);
    setPinCode(record.pin_code);
    setCity(cityName);
    setAddressLabel(record.name);
    if (record.lat && record.lon) {
      setLat(String(record.lat));
      setLon(String(record.lon));
    }
  }, []);

  const handleAddressConfirmed = useCallback((newLat, newLon, matchedArea, matchCity, label) => {
    setLat(String(newLat));
    setLon(String(newLon));
    setAreaRecord(matchedArea);
    setPinCode(matchedArea?.pin_code ?? null);
    setCity(matchCity);
    setAddressLabel(label || '');
  }, []);

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      <div className="wrap section-inner" style={{ paddingTop: 0 }}>
        {/* MODE TOGGLE */}
        <div style={{ marginBottom: 36 }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 12 }}>HOW DO YOU WANT TO START?</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => chooseMode('locality')}
              style={{
                flex: '1 1 240px', textAlign: 'left', background: mode === 'locality' ? 'rgba(175,47,64,0.14)' : 'transparent',
                border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`, borderRadius: 3, padding: '16px 18px', cursor: 'pointer',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>City → Locality → Unit</div>
              <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>Browse AsliVastu-scored neighbourhoods, then pick a floor/facing.</div>
            </button>
            <button onClick={() => chooseMode('address')}
              style={{
                flex: '1 1 240px', textAlign: 'left', background: mode === 'address' ? 'rgba(224,123,0,0.12)' : 'transparent',
                border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`, borderRadius: 3, padding: '16px 18px', cursor: 'pointer',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>I have the exact address</div>
              <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>Search it directly — we&apos;ll place the pin and detect the area for you.</div>
            </button>
          </div>
        </div>

        {mode === 'locality' && (
          <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />
        )}

        {mode === 'address' && (
          <AddressPicker onConfirmed={handleAddressConfirmed} />
        )}

        {lat && lon && (
          <UnitVerdict
            areaRecord={areaRecord}
            pinCode={pinCode}
            city={city}
            lat={lat}
            lon={lon}
            setLat={setLat}
            setLon={setLon}
            addressLabel={addressLabel}
          />
        )}
      </div>
    </section>
  );
}
