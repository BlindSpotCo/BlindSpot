'use client';
// components/property-score/PropertyScoreFlow.js
// The Property Score tab's flow: 4 tabs -- Priorities, Location, Unit,
// Verdict -- matching PropertyScoreProgress's own 4 stages exactly, which
// is the flow's real navigation (click any stage to jump to it) rather
// than a status readout above one long scroll.
//
// The governing rule now is that EVERY TAB WORKS ON ITS OWN. Nothing in
// here dead-ends into "go do the previous step first":
//
//   * Priorities is a genuine option, not a gate. It starts on a sensible
//     default persona, so skipping it straight to Location or Unit
//     produces a real score rather than a disabled Continue button.
//   * Location shows its own search bar the moment you land on it -- no
//     "pick how you want to start" screen in between. Typing an address
//     is the default; browsing scored neighbourhoods is a toggle next to
//     it, not a separate mode you had to have chosen on a previous tab.
//   * Unit, landed on with no location at all, asks the browser for GPS
//     and opens the 3D map right there. The same search bar sits above
//     the map to change it. (Denied or unavailable -> the search bar is
//     still there and still the whole answer.)
//
// Unit and Verdict are two views over the *same* mounted UnitVerdict
// instance rather than two components -- SunScoutPanel's 3D map and the
// floor/facing/combined-score state it holds all need to survive
// switching between those two tabs (and back to Location, and back
// again), not reset every time. UnitVerdict decides which of its two
// halves to show via the `viewStage` prop passed straight through.

import { useState, useCallback, useEffect, useRef } from 'react';
import LocalityPicker from './LocalityPicker';
import AddressPicker from './AddressPicker';
import AddressSearchBar from './AddressSearchBar';
import UnitVerdict from './UnitVerdict';
import PersonaPicker from './PersonaPicker';
import PropertyScoreProgress from './PropertyScoreProgress';
import SideDataStrip from './SideDataStrip';
import { PERSONA_ORDER } from '@/lib/personas';

// Priorities tunes the score; it does not unlock it. Starting from a
// default persona (rather than null) is what lets someone jump straight
// to Location or Unit and still get a real, explainable number -- the
// Priorities tab then reads as "change how this is weighted", which is
// what it actually is.
const DEFAULT_PERSONA = PERSONA_ORDER[0];

// `initial` -- { stage, personaId, mode, areaRecord, city, lat, lon,
// addressLabel, floor, facing } | null -- is resolved from the URL by
// app/property-score/page.js. Every tab writes its selections back into
// the URL as they're made (see the sync effect below), so this also
// restores a reloaded or shared link to where it was.
export default function PropertyScoreFlow({ initial }) {
  // 'address' | 'locality' -- which half of the Location tab is showing.
  // Defaults to 'address' so the very first thing on that tab is a
  // search bar you can type into, whether or not Priorities was visited.
  const [mode, setMode] = useState(initial?.mode ?? 'address');
  const [personaId, setPersonaId] = useState(initial?.personaId ?? DEFAULT_PERSONA);

  const [areaRecord, setAreaRecord] = useState(initial?.areaRecord ?? null);
  const [pinCode, setPinCode] = useState(initial?.areaRecord?.pin_code ?? null);
  const [city, setCity] = useState(initial?.city ?? null);
  const [addressLabel, setAddressLabel] = useState(initial?.addressLabel ?? '');
  const [lat, setLat] = useState(initial?.lat ?? '');
  const [lon, setLon] = useState(initial?.lon ?? '');
  // "Unit" ticks when the score is computed; "Verdict" ticks when the
  // full AI report is generated.
  const [unitSeen, setUnitSeen] = useState(false);
  const [verdictStarted, setVerdictStarted] = useState(false);

  // Mirrors UnitVerdict's own floor/facing state purely so the URL sync
  // effect has something to write -- UnitVerdict remains the real owner.
  const [floor, setFloor] = useState(initial?.floor ?? null);
  const [facing, setFacing] = useState(initial?.facing ?? null);

<<<<<<< ours
  // Which tab is actually on screen. Can sit behind what's actually
  // reachable (reachableStages below) when you've clicked back to review
  // or change an earlier one -- that's the whole point of the tabs being
  // independently clickable.
  const [viewStage, setViewStage] = useState(initial?.stage || (initial?.areaRecord || initial?.lat ? 'unit' : 'location'));
=======
  const [viewStage, setViewStage] = useState(
    initial?.stage || (initial?.areaRecord || initial?.lat ? 'unit' : 'priorities')
  );
>>>>>>> theirs

  // Only relevant on the Unit tab reached with nothing selected yet.
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | locating | failed

  // The Location tab's panel stays mounted once visited (so its picker
  // state survives tab switches) but isn't mounted before then. That
  // matters now that the address search is the tab's default: mounting
  // it eagerly would fire AddressPicker's auto-locate -- a browser
  // location permission prompt -- at someone still sitting on
  // Priorities, for a tab they haven't opened yet.
  const [locationVisited, setLocationVisited] = useState(
    (initial?.stage || 'priorities') === 'location'
  );
  useEffect(() => {
    if (viewStage === 'location') setLocationVisited(true);
  }, [viewStage]);

<<<<<<< ours
  const chooseMode = (m) => {
    if (m === mode) return;
    setMode(m);
    resetLocation();
  };
=======
  const panelRef = useRef(null);
>>>>>>> theirs

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

  // Set a location from raw coordinates that arrived without any of the
  // surrounding context the Location tab would normally have gathered --
  // the Unit tab's own search bar, or the GPS fallback below. Fills in
  // the address label and the neighbourhood match itself so a unit
  // configured this way still gets a combined score, not a unit-only one.
  const resolveAndSetLocation = useCallback(async (newLat, newLon, label) => {
    setLat(String(newLat));
    setLon(String(newLon));
    setAddressLabel(label || '');
    setAreaRecord(null); setPinCode(null); setCity(null);
    try {
      const [rg, av] = await Promise.all([
        fetch(`/api/sunscout/reverse-geocode?lat=${newLat}&lon=${newLon}`).then(r => r.json()).catch(() => null),
        fetch('/api/av-localities').then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!label && rg?.result?.displayName) setAddressLabel(rg.result.displayName);
      const postcode = rg?.result?.postcode || '';
      if (postcode && av?.cities) {
        for (const c of Object.keys(av.cities)) {
          const rec = av.cities[c].find(r => r.pin_code === postcode);
          if (rec) { setAreaRecord(rec); setPinCode(rec.pin_code); setCity(c); break; }
        }
      }
    } catch { /* best-effort — a unit-only Home Comfort Score still works */ }
  }, []);

  const unitReady = Boolean(lat && lon);

  // Landing on Unit (or Verdict) with no location at all: ask for GPS and
  // open the map wherever they are, instead of the old "pick a location
  // first ← Back to Location" dead end. If it's denied or unsupported,
  // UnitVerdict's own search bar is already on screen and is the answer.
  const triedGeo = useRef(false);
  useEffect(() => {
    if (viewStage !== 'unit' && viewStage !== 'verdict') return;
    if (unitReady || triedGeo.current) return;
    triedGeo.current = true;
    if (!('geolocation' in navigator)) { setGeoStatus('failed'); return; }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoStatus('idle'); resolveAndSetLocation(pos.coords.latitude, pos.coords.longitude, ''); },
      () => setGeoStatus('failed'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [viewStage, unitReady, resolveAndSetLocation]);

  // UnitVerdict calls this whenever the floor/facing it owns changes --
  // purely so this component has a current value to serialise into the URL.
  const handleUnitPicked = useCallback((f, d) => {
    setFloor(f); setFacing(d ?? null);
  }, []);

  // Hand-off target for "Continue to Sun Score →" on the standalone
  // neighbourhood report, for the one path that can't be resolved
  // server-side: the report tab is still open (window.opener set) and
  // posts a message straight to this live tab instead of navigating.
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

  // Keep the URL in sync with every selection as it's made, so a reload
  // (or a shared link) lands back on the same tab with everything filled
  // in. Plain history.replaceState rather than a router push -- this
  // should never trigger a navigation, only rewrite the address bar.
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

  // Land on the top of whichever tab just became active.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [viewStage]);

  // Coarse but reliable -- derived straight from state this component
  // already owns, and independent of which tab is currently in view.
  const progressDone = [
    ...(personaId && unitReady ? ['location'] : []),
    ...(unitSeen ? ['unit'] : []),
    ...(verdictStarted ? ['verdict'] : []),
  ];
<<<<<<< ours
  // All three stepper tabs are always clickable -- these are tabs, not a
  // wizard with locked steps. Tapping ahead to Unit or Verdict before
  // there's a location/score yet doesn't dead-end: both render their own
  // "nothing here yet, here's where to go" prompt (see the !unitReady
  // block below, and UnitVerdict's own combined-less branch) rather than
  // relying on the stepper to prevent getting there. An earlier version
  // gated these behind progress and disabled the button entirely, which
  // on mobile just read as "these buttons don't work."
  const reachableStages = ['location', 'unit', 'verdict'];
=======
  // All four tabs are always clickable. These are tabs, not a wizard with
  // locked steps -- an earlier version disabled them until you'd "earned"
  // them, which on mobile just read as "these buttons don't work."
  const reachableStages = ['priorities', 'location', 'unit', 'verdict'];
>>>>>>> theirs

  const modeTab = (key, label) => (
    <button key={key} onClick={() => setMode(key)} className="ps-btn"
      style={{
        background: mode === key ? 'var(--brand)' : 'transparent',
        color: mode === key ? '#fff' : 'var(--text)',
        border: `1px solid ${mode === key ? 'var(--brand)' : 'var(--line)'}`,
        borderRadius: 'var(--radius)', padding: '9px 18px', fontSize: 13.5,
        fontWeight: mode === key ? 700 : 600, cursor: 'pointer',
      }}>
      {label}
    </button>
  );

  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      <PropertyScoreProgress current={viewStage} done={progressDone} reachable={reachableStages} onSelect={setViewStage} />
      <SideDataStrip />

      <div ref={panelRef} className="wrap ps-tab-panel" style={{ scrollMarginTop: 130 }}>

<<<<<<< ours
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'location' ? 'block' : 'none' }}>
          <div className="ps-setup-grid" style={{ display: 'flex', gap: 48, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="ps-setup-col-persona" style={{ flex: '1 1 320px', maxWidth: 380 }}>
              <PersonaPicker personaId={personaId} onSelect={setPersonaId} />
            </div>

            <div className="ps-setup-col-location" style={{ flex: '2 1 480px', minWidth: 320 }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.14em', marginBottom: 10 }}>WHERE&apos;S THE PLACE?</div>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 20 }}>How do you want to start?</h2>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                style={{
                  flex: '1 1 260px', maxWidth: 380, minHeight: 260, textAlign: 'left',
                  background: mode === 'locality' ? 'color-mix(in srgb, var(--slate) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--slate) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--slate)`,
                  borderRadius: 'var(--radius)', padding: '26px 24px 24px 22px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--slate)', letterSpacing: '.1em', marginBottom: 12 }}>OPTION A</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>City → Locality → Unit</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.55, marginBottom: 18 }}>Browse scored neighbourhoods, then pick a floor/facing.</div>

                <ul style={{ margin: 0, padding: 0, fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.8, listStyle: 'none', marginTop: 'auto' }}>
                  {[
                    'Compare against a full scored shortlist first',
                    'See all 8 Neighbourhood Score metrics first',
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
                  flex: '1 1 260px', maxWidth: 380, minHeight: 260, textAlign: 'left',
                  background: mode === 'address' ? 'color-mix(in srgb, var(--sun) 14%, var(--bg-2))' : 'color-mix(in srgb, var(--sun) 5%, var(--bg-2))',
                  border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`,
                  borderLeft: `4px solid var(--sun)`,
                  borderRadius: 'var(--radius)', padding: '26px 24px 24px 22px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--sun)', letterSpacing: '.1em', marginBottom: 12 }}>OPTION B</div>
                <div className="ps-mode-btn-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>I have the exact address</div>
                <div className="ps-mode-btn-sub" style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.55, marginBottom: 18 }}>Search it directly — we&apos;ll place the pin and detect the area for you.</div>

                <ul style={{ margin: 0, padding: 0, fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.8, listStyle: 'none', marginTop: 'auto' }}>
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
                <p style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 20 }}>Pick one to continue.</p>
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
=======
        {/* ── Priorities: personas only. Optional by design -- one is
            already selected when you get here, and the tab says so, so
            nobody has to guess whether skipping it breaks anything. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'priorities' ? 'block' : 'none' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Who&apos;s house-hunting?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 24, lineHeight: 1.55 }}>
              This tunes the score to what matters most to you. Optional —
              we&apos;ve started you on <strong style={{ color: 'var(--text)' }}>Young Professional</strong>, and you can change it any time,
              including after you have a score.
            </p>

            <PersonaPicker personaId={personaId} onSelect={setPersonaId} showHeading={false} />

            <div style={{ marginTop: 28 }}>
              <button onClick={() => setViewStage('location')} className="btn btn-lg btn-cta ps-btn ps-cta-btn">
                Continue — Pick a Location <span className="btn-cta-arrow">→</span>
              </button>
>>>>>>> theirs
            </div>
          </div>

<<<<<<< ours
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
=======
        {/* ── Location: search bar first, always. The address/browse
            choice is a toggle right here rather than something you had
            to decide on a previous tab -- landing on this tab cold used
            to show "Pick how you want to start first ← Back to
            Priorities", which is the exact dead end this removes. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'location' ? 'block' : 'none' }}>
          {/* 1100px, not 640 -- .avsheet (the area spec card rendered
              once a locality's picked) has a natural width of 1056px, so
              a narrower wrapper clamped it into a slim centred column
              with dead space either side on desktop. Never binds on
              phones, so mobile's vertical layout is untouched. */}
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Where are you looking?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 20, lineHeight: 1.55 }}>
              Type the address if you have one, or browse scored neighbourhoods to find an area first.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {modeTab('address', 'Search an address')}
              {modeTab('locality', 'Browse areas')}
            </div>

            {locationVisited && (mode === 'locality'
              ? <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />
              : <AddressPicker onConfirmed={handleAddressConfirmed} initialLat={lat} initialLon={lon} />)}
          </div>

          {/* One button, not three. AddressPicker no longer has its own
              Confirm/Continue pair -- it reports the pin upward as soon
              as it settles, so this is the only thing left to press. */}
          {unitReady && (
            <div style={{ textAlign: 'center', marginTop: 36 }}>
              <button onClick={() => setViewStage('unit')} className="btn btn-lg btn-cta ps-btn ps-cta-btn">
                Continue — Configure Your Unit <span className="btn-cta-arrow">→</span>
              </button>
            </div>
          )}
>>>>>>> theirs
        </div>

        {/* Unit + Verdict share one mounted UnitVerdict instance so
            SunScoutPanel's map and the floor/facing/score state survive
            switching tabs. Hidden via display:none rather than unmounted
            when neither tab is active. */}
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
              onLocationChanged={resolveAndSetLocation}
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

        {/* No location yet on Unit/Verdict: while GPS is being asked for
            this is a one-line "locating you" note; if it's refused, the
            search bar below is the whole recovery -- no "go back" button,
            nothing to return to. */}
        {(viewStage === 'unit' || viewStage === 'verdict') && !unitReady && (
          <div className="ps-flow-wrap" style={{ width: '100%' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 0' }}>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Which place are we scoring?</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-mute)', marginBottom: 20, lineHeight: 1.55 }}>
                {geoStatus === 'locating'
                  ? 'Finding your current location — the map will open there. Search below any time to change it.'
                  : 'Search an address to open the 3D sun and shadow map for it.'}
              </p>
              <AddressSearchBar
                onPicked={(la, lo, label) => resolveAndSetLocation(la, lo, label || '')}
                showMyLocation
                autoFocus
                placeholder="Type an address, building or landmark…"
              />
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 14 }}>
                Prefer to browse scored neighbourhoods instead?{' '}
                <button onClick={() => { setMode('locality'); setViewStage('location'); }}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--brand)', textDecoration: 'underline', cursor: 'pointer' }}>
                  Browse areas
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
