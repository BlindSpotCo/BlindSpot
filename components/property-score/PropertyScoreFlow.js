'use client';
// components/property-score/PropertyScoreFlow.js
// The Property Score tab's flow: 4 single-screen tabs -- Your Angle,
// Location, Unit, Verdict -- matching PropertyScoreProgress's own 4
// stages exactly, which is now the flow's real navigation (click any
// stage you've already reached to jump back to it) rather than just a
// status readout above one long continuous scroll. Only the active
// tab's content is on screen at a time.
//
// Used to be a 3-screen scroll-snap sequence (threshold -> persona ->
// entry mode) followed by the picker and the unit/verdict panel flowing
// normally below it -- all of it stacked in one scroll, all four stages
// visible/scrollable at once regardless of how far you'd actually got.
// That's exactly the "too much scrolling" complaint this replaces. The
// old threshold screen's own job -- "here's what's about to happen, four
// steps" -- is now redundant with the tab bar itself, which already
// names and orders the same four steps, so it's gone rather than ported.
//
// Unit and Verdict are two views over the *same* mounted UnitVerdict
// instance rather than two separate components -- SunScoutPanel's 3D map
// and the floor/facing/combined-score state it holds all need to survive
// switching between those two tabs (and back to Location to change area,
// and back again), not reset every time. UnitVerdict decides which of
// its two halves to show via the `viewStage` prop passed straight
// through; see the comment there for the split.

import { useState, useCallback, useEffect, useRef } from 'react';
import LocalityPicker from './LocalityPicker';
import AddressPicker from './AddressPicker';
import UnitVerdict from './UnitVerdict';
import PersonaPicker from './PersonaPicker';
import PropertyScoreProgress from './PropertyScoreProgress';
import SideDataStrip from './SideDataStrip';

// `initialUnit` -- { record, city } | null -- is the server-resolved pin
// from a "Continue to Sun Score" hand-off (see app/property-score/page.js
// and NeighbourhoodReport.js). When present, Locality mode and the
// matching area are already picked on the very first render, so the flow
// opens straight on the Unit tab instead of Your Angle.
export default function PropertyScoreFlow({ initialUnit }) {
  const [mode, setMode] = useState(initialUnit ? 'locality' : null); // 'locality' | 'address'
  const [personaId, setPersonaId] = useState(null);

  const [areaRecord, setAreaRecord] = useState(initialUnit?.record ?? null);
  const [pinCode, setPinCode] = useState(initialUnit?.record?.pin_code ?? null);
  const [city, setCity] = useState(initialUnit?.city ?? null);
  const [addressLabel, setAddressLabel] = useState(initialUnit?.record?.name ?? '');
  const [lat, setLat] = useState(initialUnit?.record?.lat ? String(initialUnit.record.lat) : '');
  const [lon, setLon] = useState(initialUnit?.record?.lon ? String(initialUnit.record.lon) : '');
  // "Unit" ticks when Get Combined/Home Comfort Score is clicked;
  // "Verdict" ticks when the full AI report is generated.
  const [unitSeen, setUnitSeen] = useState(false);
  const [verdictStarted, setVerdictStarted] = useState(false);

  // Which tab is actually on screen. Can sit behind what's actually
  // reachable (reachableStages below) when you've clicked back to review
  // or change an earlier one -- that's the whole point of the tabs being
  // independently clickable.
  const [viewStage, setViewStage] = useState(initialUnit ? 'unit' : 'angle');

  const panelRef = useRef(null);

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon(''); setUnitSeen(false); setVerdictStarted(false);
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

  // Hand-off target for "Continue to Sun Score →" on the standalone
  // neighbourhood report, for the one path that can't be resolved
  // server-side: the report tab is still open (window.opener set) and
  // posts a message straight to this live tab instead of navigating.
  // (The no-opener fallback navigates to /property-score?continue=unit&...
  // and is resolved server-side in app/property-score/page.js, landing
  // straight on the Unit tab via initialUnit above -- no client fetch,
  // no listener needed for that path.)
  const jumpToUnit = useCallback(async (pin, cityName, sector) => {
    try {
      const res = await fetch('/api/av-localities');
      if (!res.ok) return;
      const { cities } = await res.json();
      const list = cityName ? cities?.[cityName] : Object.values(cities || {}).flat();
      if (!list) return;
      const record = (sector != null && list.find(r => r.pin_code === pin && r.sectorNum === sector))
        || list.find(r => r.pin_code === pin);
      if (!record) return;
      setMode('locality');
      handleAreaSelected(record, cityName || record.city);
      setViewStage('unit');
    } catch { /* best-effort -- the flow still works, just not pre-filled */ }
  }, [handleAreaSelected]);

  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'blindspot:continue-to-unit') return;
      jumpToUnit(data.pin, data.city, data.sector ?? null);
    }
    window.addEventListener('message', onMessage);

    // Strip a leftover ?continue=... query string post-hydration (already
    // consumed server-side into initialUnit) so the URL doesn't keep
    // advertising a one-time hand-off after it's been applied.
    const params = new URLSearchParams(window.location.search);
    if (params.has('continue')) {
      params.delete('continue'); params.delete('pin'); params.delete('city'); params.delete('sector');
      const rest = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }

    return () => window.removeEventListener('message', onMessage);
    // Mount-only -- jumpToUnit is stable enough for a one-time hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Land on the top of whichever tab just became active -- otherwise a
  // switch from a long tab (Unit, with the sun/shadow panel) to a short
  // one (Your Angle) can leave you scrolled to a blank stretch below its
  // actual content, or vice versa.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [viewStage]);

  const unitReady = Boolean(lat && lon);

  // Coarse but reliable -- derived straight from state this component
  // already owns. "Unit" and "Verdict" tick (done) independently of which
  // tab is currently in view -- see PropertyScoreProgress's `done` prop.
  const progressDone = [
    ...(personaId ? ['angle'] : []),
    ...(unitReady ? ['location'] : []),
    ...(unitSeen ? ['unit'] : []),
    ...(verdictStarted ? ['verdict'] : []),
  ];
  // All four stepper tabs are always clickable -- these are tabs, not a
  // wizard with locked steps. Tapping ahead to Unit or Verdict before
  // there's a location/score yet doesn't dead-end: both render their own
  // "nothing here yet, here's where to go" prompt (see the !unitReady
  // block below, and UnitVerdict's own combined-less branch) rather than
  // relying on the stepper to prevent getting there. An earlier version
  // gated these behind progress and disabled the button entirely, which
  // on mobile just read as "these buttons don't work."
  const reachableStages = ['angle', 'location', 'unit', 'verdict'];

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      <PropertyScoreProgress current={viewStage} done={progressDone} reachable={reachableStages} onSelect={setViewStage} />
      <SideDataStrip />

      {/* .section-inner's 88px top padding + top border were sized for
          sitting below the old 3-screen intro sequence, as a breathing
          gap before the "real" content started -- now every tab sits
          directly under the sticky stepper instead, which already has
          its own bottom border as the divider, so that combination read
          as a large empty gap under it. .ps-tab-panel (globals.css) is
          smaller, has no border, and is tuned for being the first thing
          under the stepper on every tab. */}
      <div ref={panelRef} className="wrap ps-tab-panel" style={{ scrollMarginTop: 130 }}>

        {viewStage === 'angle' && (
          <div className="ps-flow-wrap" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '.12em' }}>STEP 1 OF 4</span>
            </div>
            <PersonaPicker personaId={personaId} onSelect={setPersonaId} big />
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button
                onClick={() => personaId && setViewStage('location')}
                disabled={!personaId}
                className="btn btn-lg btn-cta ps-btn ps-cta-btn"
                style={{ opacity: personaId ? 1 : .45, cursor: personaId ? 'pointer' : 'default' }}
              >
                Continue — Pick a Location <span className="btn-cta-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'location' ? 'block' : 'none' }}>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-mute)', letterSpacing: '.12em', marginBottom: 28, textAlign: 'center' }}>HOW DO YOU WANT TO START?</div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1080, margin: '0 auto' }}>
              <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 380px', maxWidth: 460, minHeight: 320, textAlign: 'left',
                  background: mode === 'locality' ? 'color-mix(in srgb, var(--slate) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--slate) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--slate)`,
                  borderRadius: 'var(--radius)', padding: '40px 34px 40px 30px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--slate)', letterSpacing: '.1em', marginBottom: 14 }}>OPTION A</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>City → Locality → Unit</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 14.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 26 }}>Browse scored neighbourhoods, then pick a floor/facing.</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                  {['City', 'Locality', 'Unit'].map((step, i) => (
                    <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11.5, padding: '7px 13px', borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--slate) 8%, var(--paper))', border: '1px solid color-mix(in srgb, var(--slate) 30%, var(--line))', color: 'var(--text)' }}>{step}</span>
                      {i < 2 && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→</span>}
                    </span>
                  ))}
                </div>

                <ul style={{ margin: '0 0 0 0', padding: 0, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.9, listStyle: 'none', marginTop: 'auto' }}>
                  {[
                    'Compare against a full scored shortlist first',
                    'See all 8 Neighbourhood Score metrics before committing to one address',
                    'Best if you’re still deciding between areas',
                  ].map(line => (
                    <li key={line} style={{ position: 'relative', paddingLeft: 16 }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--slate)' }}>—</span>{line}
                    </li>
                  ))}
                </ul>
              </button>
              <button onClick={() => chooseMode('address')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 380px', maxWidth: 460, minHeight: 320, textAlign: 'left',
                  background: mode === 'address' ? 'color-mix(in srgb, var(--sun) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--sun) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--sun)`,
                  borderRadius: 'var(--radius)', padding: '40px 34px 40px 30px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--sun)', letterSpacing: '.1em', marginBottom: 14 }}>OPTION B</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>I have the exact address</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 14.5, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 26 }}>Search it directly — we&apos;ll place the pin and detect the area for you.</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
                  {['Address', 'Auto-detect area', 'Unit'].map((step, i) => (
                    <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11.5, padding: '7px 13px', borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--sun) 8%, var(--paper))', border: '1px solid color-mix(in srgb, var(--sun) 30%, var(--line))', color: 'var(--text)' }}>{step}</span>
                      {i < 2 && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→</span>}
                    </span>
                  ))}
                </div>

                <ul style={{ margin: '0 0 0 0', padding: 0, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.9, listStyle: 'none', marginTop: 'auto' }}>
                  {[
                    'Fastest if you already have one building in mind',
                    'We match it to the nearest scored locality automatically',
                    'No need to browse a list first',
                  ].map(line => (
                    <li key={line} style={{ position: 'relative', paddingLeft: 16 }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--sun)' }}>—</span>{line}
                    </li>
                  ))}
                </ul>
              </button>
            </div>
            {!mode && (
              <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-dim)', marginTop: 32 }}>Pick one to continue.</p>
            )}

            {mode === 'locality' && (
              <div style={{ marginTop: 40 }}>
                <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />
              </div>
            )}
            {mode === 'address' && (
              <div style={{ marginTop: 40 }}>
                <AddressPicker onConfirmed={handleAddressConfirmed} />
              </div>
            )}

            {unitReady && (
              <div style={{ textAlign: 'center', marginTop: 36 }}>
                <button onClick={() => setViewStage('unit')} className="btn btn-lg btn-cta ps-btn ps-cta-btn">
                  Continue — Configure Your Unit <span className="btn-cta-arrow">→</span>
                </button>
              </div>
            )}
        </div>

        {/* Unit + Verdict share one mounted UnitVerdict instance (see the
            file-level comment above) so SunScoutPanel's map and the
            floor/facing/combined-score state it holds survive switching
            tabs, instead of resetting every time. Hidden via display:none
            rather than unmounted when neither tab is active. */}
        {unitReady && (
          <div className="ps-flow-wrap" style={{ width: '100%', display: (viewStage === 'unit' || viewStage === 'verdict') ? 'block' : 'none' }}>
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
              onUnitSeen={setUnitSeen}
              onVerdictStart={setVerdictStarted}
              viewStage={viewStage}
              onScoreComputed={() => setViewStage('verdict')}
              onBackToUnit={() => setViewStage('unit')}
            />
          </div>
        )}

        {(viewStage === 'unit' || viewStage === 'verdict') && !unitReady && (
          <div className="ps-flow-wrap" style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 14.5, color: 'var(--text-mute)', marginBottom: 20 }}>Pick a location first — there&apos;s nothing to configure yet.</p>
            <button onClick={() => setViewStage('location')} className="btn btn-lg btn-cta ps-btn ps-cta-btn">
              ← Back to Location
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
