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
import FloorPlanAnalysis from '@/components/floor-plan/FloorPlanAnalysis';
import { PERSONA_ORDER } from '@/lib/personas';

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
  // Defaults to the first persona rather than null -- every tab is
  // independently reachable now (see reachableStages below), so a first
  // visitor who jumps straight to Location or Unit without ever touching
  // Priorities shouldn't get stuck behind an unmade choice. Priorities
  // stays fully editable any time; this is just a sane starting point,
  // not a requirement to visit that tab first.
  const [personaId, setPersonaId] = useState(initial?.personaId ?? PERSONA_ORDER[0]);

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
  const [viewStage, setViewStage] = useState(initial?.stage || (initial?.areaRecord || initial?.lat ? 'unit' : 'priorities'));

  const panelRef = useRef(null);
  // Direct Unit/Verdict entry with no location yet auto-geolocates once
  // (see the effect below) rather than showing anything to fill in --
  // this flag is what stops that from retriggering every render, and
  // gets cleared by resetLocation so leaving and coming back through a
  // fresh "no location" state (e.g. after switching entry mode) can
  // auto-locate again instead of staying stuck on a stale attempt.
  const autoGeoTried = useRef(false);
  const [autoGeoError, setAutoGeoError] = useState('');

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon(''); setUnitSeen(false); setVerdictStarted(false);
    setFloor(null); setFacing(null);
    autoGeoTried.current = false; setAutoGeoError('');
  };

  const chooseMode = (m) => {
    if (m !== mode) { setMode(m); resetLocation(); }
    setViewStage('location');
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
    // AddressPicker's own "Continue to Sun & Shadow" button (shown once
    // the pin's confirmed) is already the deliberate "I'm committing to
    // this one" gesture -- jump straight to Unit here instead of also
    // requiring the separate flow-level "Continue — Configure Your Unit"
    // button below, which just duplicated it for this mode (see the
    // location-tab render below, which only shows that button for
    // locality mode now). Also where the direct-Unit-tab GPS fallback
    // lands, where it's a same-tab no-op.
    setViewStage('unit');
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

  // Landing directly on the Location tab (stepper click, direct link,
  // reload) with no entry mode picked yet used to dead-end into "go back
  // to Priorities and choose A or B first." Priorities is skippable now
  // (see personaId's default above), so Location needs to stand on its
  // own too: default straight to the search-bar mode (AddressPicker
  // already auto-locates via GPS on mount and lets you type/search to
  // change it) rather than blocking on an unmade choice. Browsing scored
  // areas instead is still one click away via the toggle rendered below,
  // not gated behind Priorities.
  useEffect(() => {
    if (viewStage === 'location' && !mode) setMode('address');
  }, [viewStage, mode]);

  const unitReady = Boolean(lat && lon);

  // Landed on Unit or Verdict directly with no location yet -- skip the
  // neighbourhood-matching address flow entirely (that's Location's mode
  // B, a deliberate step-by-step confirm-then-see-the-area-card flow) and
  // just get straight into the 3D shadow view: try the browser's GPS
  // once, silently, and feed whatever it returns straight in as lat/lon
  // with no area record attached (areaRecord stays null -- Verdict later
  // shows a Home Comfort Score only, not a combined one, which is correct
  // for "I never told it a neighbourhood"). SunScoutPanel's own toolbar
  // already has a search box that changes the location from there, so
  // there's nothing else this needs to offer. If GPS is denied or
  // unavailable, fall back to a fixed default location (central Delhi)
  // purely so the map has *something* to render -- autoGeoError surfaces
  // that so it doesn't look like a silent wrong-place bug.
  useEffect(() => {
    if ((viewStage !== 'unit' && viewStage !== 'verdict') || unitReady || autoGeoTried.current) return;
    autoGeoTried.current = true;
    if (!('geolocation' in navigator)) {
      setAutoGeoError('Location access isn\u2019t available here, showing a default spot, search above to find yours.');
      handleAddressConfirmed(28.6139, 77.2090, null, null, '');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => handleAddressConfirmed(pos.coords.latitude, pos.coords.longitude, null, null, ''),
      () => {
        setAutoGeoError('Couldn\u2019t get your location, showing a default spot, search above to find yours.');
        handleAddressConfirmed(28.6139, 77.2090, null, null, '');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [viewStage, unitReady, handleAddressConfirmed]);


  // Coarse but reliable -- derived straight from state this component
  // already owns. "Unit" and "Verdict" tick (done) independently of which
  // tab is currently in view -- see PropertyScoreProgress's `done` prop.
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
  // Furnishing is the one exception to "always clickable" above -- it's
  // reached AFTER seeing a score (review flagged the old placement, on
  // the Unit tab, as showing up before there was any verdict to react
  // to), so it only unlocks once unitSeen is true rather than being open
  // from the start like the other four.
  const reachableStages = ['priorities', 'location', 'unit', 'verdict', ...(unitSeen ? ['furnish'] : [])];

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

        {/* ── Priorities: persona list + entry-mode choice, side by
            side. Just the choice here -- picking Option A/B doesn't show
            the actual picker on this screen, it advances straight to the
            Location tab (see chooseMode above), which is where the real
            browsing/searching happens. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'priorities' ? 'block' : 'none' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* One heading for the whole screen -- both columns below get
                only a small eyebrow of their own (same size/margin as
                each other), not a second full headline, so their card
                lists start at the same height without any manual
                spacing hacks. */}
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Pick your priorities.</h2>
            <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 28, lineHeight: 1.55, maxWidth: 520 }}>
              This tunes the score to what matters most to you.
            </p>

            <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 340px', maxWidth: 420 }}>
                <PersonaPicker personaId={personaId} onSelect={setPersonaId} showHeading={false} />
              </div>

              {/* Same card language as the persona list -- round icon
                  badge + title + one-line blurb, same padding and gap --
                  so the two columns read as one matched set instead of
                  two differently-styled pickers glued together. */}
              <div style={{ flex: '1 1 340px', maxWidth: 420 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--sun)', letterSpacing: '.14em', marginBottom: 10 }}>HOW DO YOU WANT TO START?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => chooseMode('locality')} className="ps-mode-btn ps-btn"
                  style={{
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: mode === 'locality' ? 'color-mix(in srgb, var(--slate) 14%, var(--bg-2))' : 'var(--bg-2)',
                    border: `1px solid ${mode === 'locality' ? 'var(--slate)' : 'var(--line)'}`,
                  }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--slate)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                  }}>A</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: mode === 'locality' ? 'var(--slate)' : 'var(--ink)' }}>Browse areas</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.4, marginTop: 2 }}>See scored neighbourhoods, then pick a unit.</span>
                  </span>
                </button>
                <button onClick={() => chooseMode('address')} className="ps-mode-btn ps-btn"
                  style={{
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    background: mode === 'address' ? 'color-mix(in srgb, var(--sun) 14%, var(--bg-2))' : 'var(--bg-2)',
                    border: `1px solid ${mode === 'address' ? 'var(--sun)' : 'var(--line)'}`,
                  }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--sun)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                  }}>B</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: mode === 'address' ? 'var(--sun)' : 'var(--ink)' }}>I have an address</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.4, marginTop: 2 }}>We&apos;ll place the pin and find the area for you.</span>
                  </span>
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Location: the real picker for whichever mode was chosen on
            Priorities. Landing here directly (stepper click, direct link)
            with no mode chosen yet defaults to the address/search picker
            (see the effect above) rather than blocking -- the toggle link
            just below switches to browsing areas instead, no need to go
            back to Priorities for that. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'location' ? 'block' : 'none' }}>
          {/* 1100px, not 640 -- .avsheet (the area-card spec sheet rendered
              below once a locality's picked) has its own natural width of
              1056px baked into its shared CSS, so a narrower wrapper here
              was clamping it down and leaving the picker looking squeezed
              into a slim centred column with dead space on both sides on
              desktop. 1100 gives that card room to breathe without maxing
              out ps-flow-wrap's own 1400px ceiling. On phones this number
              never actually binds -- the viewport itself is already
              narrower than 640, let alone 1100 -- so mobile's vertical
              layout is untouched. */}
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Switch between the two entry modes right here -- no need to
                go back to Priorities for this. */}
            <div style={{ textAlign: 'right', marginBottom: 14 }}>
              {mode === 'address' ? (
                <button onClick={() => chooseMode('locality')} className="ps-link-btn"
                  style={{ background: 'none', border: 'none', color: 'var(--text-mute)', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
                  Prefer to browse scored areas instead?
                </button>
              ) : (
                <button onClick={() => chooseMode('address')} className="ps-link-btn"
                  style={{ background: 'none', border: 'none', color: 'var(--text-mute)', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
                  Have an exact address? Search for it instead
                </button>
              )}
            </div>
            {mode === 'locality' && <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />}
            {mode === 'address' && <AddressPicker onConfirmed={handleAddressConfirmed} />}
          </div>

          {mode === 'locality' && (
            <div style={{ textAlign: 'center', marginTop: 36 }}>
              <button
                onClick={() => unitReady && setViewStage('unit')}
                disabled={!unitReady}
                className="btn btn-lg btn-cta ps-btn ps-cta-btn"
                style={{ opacity: unitReady ? 1 : .45, cursor: unitReady ? 'pointer' : 'default' }}
              >
                Continue - Configure Your Unit <span className="btn-cta-arrow">→</span>
              </button>
              {!unitReady && (
                <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10 }}>Pick a location to continue.</p>
              )}
            </div>
          )}
        </div>

        {/* Unit + Verdict share one mounted UnitVerdict instance (see the
            file-level comment above) so SunScoutPanel's map and the
            floor/facing/combined-score state it holds survive switching
            tabs -- including a trip back to Location to change area and
            back again -- instead of resetting every time. Hidden via
            display:none rather than unmounted whenever a location IS
            picked but neither tab is currently active. */}
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

        {/* Landed on Unit or Verdict directly with no location picked yet
            -- the effect above is already asking the browser for GPS (or
            has just fallen back to a default spot); this is only visible
            for the brief moment before that resolves and unitReady flips
            true, at which point the block above takes over and mounts
            straight into the 3D shadow view -- no neighbourhood step in
            between. */}
        {(viewStage === 'unit' || viewStage === 'verdict') && !unitReady && (
          <div className="ps-flow-wrap" style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: 14.5, color: 'var(--text-mute)' }}>
              {autoGeoError || 'Locating you\u2026 the 3D shadow view will open right at your spot.'}
            </p>
          </div>
        )}

        {/* ── Furnishing: deliberately placed after Verdict, not on Unit
            (see the reachableStages comment above) -- a person lands here
            once they've actually seen a score, not before. The floor-plan
            advisor renders inline (embedded) instead of linking out to its
            own tab, so it's a real step in this flow rather than a side
            errand. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'furnish' ? 'block' : 'none' }}>
          {unitSeen ? (
            <div style={{ maxWidth: 1120, margin: '0 auto' }}>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', marginBottom: 8 }}>Furnish this unit.</h2>
              <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 28, lineHeight: 1.55, maxWidth: 560 }}>
                Upload a floor plan - a PDF, JPG, or PNG - and get room-by-room furniture and placement suggestions, marked directly on the plan.
              </p>
              <FloorPlanAnalysis embedded />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: 14.5, color: 'var(--text-mute)' }}>Get a Home Comfort Score on the Unit tab first, then come back here to furnish it.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
