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

// `initial` -- { stage, personaId, mode, areaRecord, city, lat, lon,
// addressLabel, floor, facing } | null -- is resolved from the URL by
// app/property-score/page.js (a locality `pin` is looked up server-side
// into its full record there; everything else is read straight off the
// query string). Every tab writes its own selections back into the URL
// as they're made (see the sync effect below), so this is also what
// restores a reloaded or reopened tab to where it was, not just the
// original "Continue to Sun Score" hand-off this used to be for.
export default function PropertyScoreFlow({ initial }) {
  const [mode, setMode] = useState(initial?.mode ?? null); // 'locality' | 'address'
  const [personaId, setPersonaId] = useState(initial?.personaId ?? null);

  const [areaRecord, setAreaRecord] = useState(initial?.areaRecord ?? null);
  const [pinCode, setPinCode] = useState(initial?.areaRecord?.pin_code ?? null);
  const [city, setCity] = useState(initial?.city ?? null);
  const [addressLabel, setAddressLabel] = useState(initial?.addressLabel ?? '');
  const [lat, setLat] = useState(initial?.lat ?? '');
  const [lon, setLon] = useState(initial?.lon ?? '');
  // "Unit" ticks when Get Combined/Home Comfort Score is clicked;
  // "Verdict" ticks when the full AI report is generated.
  const [unitSeen, setUnitSeen] = useState(false);
  const [verdictStarted, setVerdictStarted] = useState(false);

  // Mirrors UnitVerdict's own floor/facing state purely so the URL sync
  // effect below has something to write -- UnitVerdict remains the real
  // owner (see onUnitPicked), this is not re-fed down except as the
  // *initial* value on first mount.
  const [floor, setFloor] = useState(initial?.floor ?? null);
  const [facing, setFacing] = useState(initial?.facing ?? null);

  // Which tab is actually on screen. Can sit behind what's actually
  // reachable (reachableStages below) when you've clicked back to review
  // or change an earlier one -- that's the whole point of the tabs being
  // independently clickable.
  const [viewStage, setViewStage] = useState(initial?.stage || (initial?.areaRecord || initial?.lat ? 'unit' : 'location'));

  const panelRef = useRef(null);

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon(''); setUnitSeen(false); setVerdictStarted(false);
    setFloor(null); setFacing(null);
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

  // UnitVerdict calls this whenever the floor/facing it owns changes --
  // purely so this component has a current value to serialise into the
  // URL; see the sync effect below.
  const handleUnitPicked = useCallback((f, d) => {
    setFloor(f); setFacing(d ?? null);
  }, []);

  // Hand-off target for "Continue to Sun Score →" on the standalone
  // neighbourhood report, for the one path that can't be resolved
  // server-side: the report tab is still open (window.opener set) and
  // posts a message straight to this live tab instead of navigating.
  // (The no-opener fallback navigates to /property-score?stage=unit&...
  // and is resolved server-side in app/property-score/page.js, landing
  // straight on the Unit tab via `initial` above -- no client fetch, no
  // listener needed for that path.)
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
    return () => window.removeEventListener('message', onMessage);
    // Mount-only -- jumpToUnit is stable enough for a one-time hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with every selection as it's made -- persona,
  // mode, location (either a locality's pin/city or a raw address'
  // lat/lon), floor/facing once picked, and whichever tab is on screen.
  // This is what makes a reload (or a bookmarked/shared link) land back
  // on the same tab with everything already filled in, instead of
  // starting over from Your Angle. Plain history.replaceState rather
  // than a Next.js router push -- this should never itself trigger a
  // navigation or a server round-trip, only rewrite the address bar.
  // Skipped entirely on the very first render (the effect's own
  // dependencies already equal what page.js put in the URL then).
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) { firstSync.current = false; return; }
    const params = new URLSearchParams();
    if (viewStage) params.set('stage', viewStage);
    if (personaId) params.set('persona', personaId);
    if (mode) params.set('mode', mode);
    if (pinCode) params.set('pin', pinCode);
    if (city) params.set('city', city);
    if (areaRecord?.sectorNum != null) params.set('sector', String(areaRecord.sectorNum));
    if (lat) params.set('lat', lat);
    if (lon) params.set('lon', lon);
    if (addressLabel) params.set('addr', addressLabel);
    if (floor != null) params.set('floor', String(floor));
    if (facing) params.set('facing', facing);
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [viewStage, personaId, mode, pinCode, city, areaRecord, lat, lon, addressLabel, floor, facing]);

  // Land on the top of whichever tab just became active -- otherwise a
  // switch from a long tab (Unit, with the sun/shadow panel) to a short
  // one (Your Angle) can leave you scrolled to a blank stretch below its
  // actual content, or vice versa.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [viewStage]);

  const unitReady = Boolean(lat && lon);

  // Coarse but reliable -- derived straight from state this component
  // already owns. "Priorities" and "Location" tick independently even
  // though they're one screen (see PropertyScoreProgress) -- picking a
  // persona checks off Priorities without needing a location yet, and
  // vice versa.
  const progressDone = [
    ...(personaId ? ['priorities'] : []),
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
  const reachableStages = ['priorities', 'location', 'unit', 'verdict'];

  // 'priorities' and 'location' are two stepper labels over the same
  // screen (see PropertyScoreProgress) -- clicking either one just opens
  // that one screen.
  const handleStageSelect = (key) => setViewStage(key === 'priorities' ? 'location' : key);

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      <PropertyScoreProgress current={viewStage} done={progressDone} reachable={reachableStages} onSelect={handleStageSelect} />
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

        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'location' ? 'block' : 'none' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* One heading for this whole screen -- PersonaPicker's own
                "Pick your priorities." intro. Location used to have a
                second "How do you want to start?" heading of its own
                sitting beside it in a two-column layout; that's gone,
                Option A/B now just follow straight on below, stacked
                vertically like the persona list right above them instead
                of two side-by-side cards -- one continuous flow, not two
                separately-headed halves. */}
            <PersonaPicker personaId={personaId} onSelect={setPersonaId} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
              <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                style={{
                  textAlign: 'left',
                  background: mode === 'locality' ? 'color-mix(in srgb, var(--slate) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--slate) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--slate)`,
                  borderRadius: 'var(--radius)', padding: '18px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--slate)', letterSpacing: '.1em', flexShrink: 0, width: 60 }}>OPTION A</div>
                <div>
                  <div className="ps-mode-btn-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>City → Locality → Unit</div>
                  <div className="ps-mode-btn-sub" style={{ fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.5 }}>Browse scored neighbourhoods, then pick a floor/facing. Best if you're still deciding between areas.</div>
                </div>
              </button>
              <button onClick={() => chooseMode('address')} className="ps-mode-btn ps-btn"
                style={{
                  textAlign: 'left',
                  background: mode === 'address' ? 'color-mix(in srgb, var(--sun) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--sun) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--sun)`,
                  borderRadius: 'var(--radius)', padding: '18px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.1em', flexShrink: 0, width: 60 }}>OPTION B</div>
                <div>
                  <div className="ps-mode-btn-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>I have the exact address</div>
                  <div className="ps-mode-btn-sub" style={{ fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.5 }}>Search it directly — we&apos;ll place the pin and match it to the nearest scored locality automatically.</div>
                </div>
              </button>
            </div>
            {!mode && (
              <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 16 }}>Pick one to continue.</p>
            )}

            {mode === 'locality' && (
              <div style={{ marginTop: 28 }}>
                <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />
              </div>
            )}
            {mode === 'address' && (
              <div style={{ marginTop: 28 }}>
                <AddressPicker onConfirmed={handleAddressConfirmed} />
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <button
              onClick={() => personaId && unitReady && setViewStage('unit')}
              disabled={!personaId || !unitReady}
              className="btn btn-lg btn-cta ps-btn ps-cta-btn"
              style={{ opacity: (personaId && unitReady) ? 1 : .45, cursor: (personaId && unitReady) ? 'pointer' : 'default' }}
            >
              Continue — Configure Your Unit <span className="btn-cta-arrow">→</span>
            </button>
            {!(personaId && unitReady) && (
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10 }}>
                {!personaId && !unitReady ? 'Pick a priority and a location to continue.' : !personaId ? 'Pick a priority above to continue.' : 'Pick a location to continue.'}
              </p>
            )}
          </div>
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
              initialFloor={floor}
              initialFacing={facing}
              onUnitPicked={handleUnitPicked}
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
