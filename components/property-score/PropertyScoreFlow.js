'use client';
// components/property-score/PropertyScoreFlow.js
// The Property Score tab's flow. Opens as a 3-screen scroll-snap sequence
// -- intro (Combined Verdict) -> persona dial (Pick your angle) -> entry
// mode (pick locality vs address) -- each filled to the viewport rather
// than a thin strip of content, so scrolling down feels like moving
// through a deliberate sequence, not past empty space. Everything after
// that (the actual locality/address picker, then the unit sun/shadow panel +
// verdict) is genuinely variable-height content, so it flows normally
// below the snap sequence instead of being forced into fixed screens.

import { useState, useCallback } from 'react';
import LocalityPicker from './LocalityPicker';
import AddressPicker from './AddressPicker';
import UnitVerdict from './UnitVerdict';
import PersonaPicker from './PersonaPicker';

const SCREEN_H = 'calc(100vh - 66px)'; // 66px = the sticky header's own height

export default function PropertyScoreFlow() {
  const [mode, setMode] = useState(null); // 'locality' | 'address'
  const [personaId, setPersonaId] = useState(null);

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

  function scrollToNext(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      {/* ── snap sequence: 3 full screens ── */}
      <div style={{ scrollSnapType: 'y proximity' }}>

        {/* Screen 1 — intro */}
        <div style={{ minHeight: SCREEN_H, display: 'flex', alignItems: 'center', scrollSnapAlign: 'start' }}>
          <div className="wrap" style={{ width: '100%' }}>
            <div className="hero-grid" style={{ alignItems: 'center' }}>
              <div>
                <span className="hero-eyebrow">Combined Verdict</span>
                <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 'clamp(36px, 4.5vw, 52px)', lineHeight: 1.12, margin: '18px 0 18px', maxWidth: 600 }}>
                  One score for the neighbourhood. One score for the flat.
                </h1>
                <p style={{ fontSize: 16, color: 'var(--text-mute)', maxWidth: 540, lineHeight: 1.7 }}>
                  Start however you know the property — browse a scored locality, or search the exact
                  address. Either way you&apos;ll land on the same sun/shadow analysis and a combined
                  verdict you control the weighting of.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  ['Neighbourhood', 'Crime, air, power, water, schools, roads — scored for the area.'],
                  ['Unit', '3D sun & shadow analysis, per floor and facing.'],
                  ['BlindSpot', 'The two combined into one verdict, weighted your way.'],
                ].map(([label, desc], i) => (
                  <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--bg-2)' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => scrollToNext('ps-screen-persona')} className="mono"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 40, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer' }}>
              SCROLL TO PICK YOUR ANGLE <span style={{ fontSize: 14 }}>↓</span>
            </button>
          </div>
        </div>

        {/* Screen 2 — persona dial */}
        <div id="ps-screen-persona" style={{ minHeight: SCREEN_H, display: 'flex', alignItems: 'center', scrollSnapAlign: 'start' }}>
          <div className="wrap" style={{ width: '100%' }}>
            <PersonaPicker personaId={personaId} onSelect={setPersonaId} big />
            <button onClick={() => scrollToNext('ps-screen-location')} className="mono"
              style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '32px auto 0', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, letterSpacing: '.1em', cursor: 'pointer' }}>
              SCROLL TO PICK A LOCATION <span style={{ fontSize: 14 }}>↓</span>
            </button>
          </div>
        </div>

        {/* Screen 3 — entry mode. Only forces a full screen while nothing's
            picked yet; once a mode is chosen it shrinks to fit its own
            content so the picker/search bar right after it isn't left
            floating a screen's height below with a big empty gap. */}
        <div id="ps-screen-location" style={{
          minHeight: mode ? 0 : SCREEN_H, display: 'flex', alignItems: 'center',
          scrollSnapAlign: 'start', padding: mode ? '48px 0' : 0,
        }}>
          <div className="wrap" style={{ width: '100%' }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 20, textAlign: 'center' }}>HOW DO YOU WANT TO START?</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 900, margin: '0 auto' }}>
              <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 320px', maxWidth: 400, textAlign: 'left', background: mode === 'locality' ? 'rgba(175,47,64,0.14)' : 'var(--bg-2)',
                  border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`, borderRadius: 'var(--radius)', padding: '32px 28px', cursor: 'pointer',
                }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--slate)', letterSpacing: '.1em', marginBottom: 10 }}>OPTION A</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>City → Locality → Unit</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.6 }}>Browse scored neighbourhoods, then pick a floor/facing.</div>
              </button>
              <button onClick={() => chooseMode('address')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 320px', maxWidth: 400, textAlign: 'left', background: mode === 'address' ? 'rgba(224,123,0,0.12)' : 'var(--bg-2)',
                  border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`, borderRadius: 'var(--radius)', padding: '32px 28px', cursor: 'pointer',
                }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--sun)', letterSpacing: '.1em', marginBottom: 10 }}>OPTION B</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>I have the exact address</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.6 }}>Search it directly — we&apos;ll place the pin and detect the area for you.</div>
              </button>
            </div>
            {!mode && (
              <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-dim)', marginTop: 28 }}>Pick one to continue — the rest of the flow opens below.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── everything after this point is variable-height, normal scroll ── */}
      <div className="wrap section-inner" style={{ paddingTop: 0 }}>
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
            personaId={personaId}
          />
        )}
      </div>
    </section>
  );
}
