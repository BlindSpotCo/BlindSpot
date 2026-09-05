'use client';
// components/property-score/PropertyScoreFlow.js
// The property-score flow: a Start screen offering three independent
// branches -- the area, the flat, furnishing -- and the screens each of
// those branches needs. Not a wizard. A user who picks "the flat" gets
// GPS and the 3D shadow view immediately and never sees a locality
// picker; a user who picks "the area" never sees a floor/facing control
// until they ask for one. Whichever half they skip is offered afterwards
// (see StartChooser for the doors, and UnitVerdict's onAddNeighbourhood
// for the way back across), because the combined score genuinely needs
// both -- but it's offered, not imposed.
//
// This replaces a 4-stage Priorities -> Location -> Unit -> Verdict
// stepper. The stages themselves still exist as `viewStage` values and
// still render one at a time; what's gone is the numbered strip that
// presented them as an order everyone walks in, plus the persona screen
// that used to sit at the front of it.
//
// Unit and Verdict remain two views over the *same* mounted UnitVerdict
// instance rather than two separate components -- SunScoutPanel's 3D map
// and the floor/facing/combined-score state it holds all need to survive
// switching between those two views (and back to Location to change area,
// and back again), not reset every time. UnitVerdict decides which of
// its two halves to show via the `viewStage` prop passed straight
// through; see the comment there for the split.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LocalityPicker from './LocalityPicker';
import AVAreaCard from './AVAreaCard';
import AddressPicker from './AddressPicker';
import UnitVerdict from './UnitVerdict';
import StartChooser from './StartChooser';
import SideDataStrip from './SideDataStrip';
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
  const router = useRouter();
  const [mode, setMode] = useState(initial?.mode ?? null); // 'locality' | 'address'
  // Persona is no longer asked for. It still exists and still weights the
  // AsliVastu composite (lib/personas.js) and still travels to
  // /api/property-score and into saved reports -- it's just pinned to a
  // default here instead of being a screen a first-time visitor has to get
  // past. Deliberately left as plumbing rather than ripped out: personaId
  // reaches 16 files including two API routes and every already-saved
  // report in /my-reports, so removing the *question* is a 3-file change
  // while removing the *concept* is a migration. An explicit ?persona= in
  // the URL is still honoured, so nothing already bookmarked or saved
  // starts reading back differently.
  const personaId = initial?.personaId ?? PERSONA_ORDER[0];

  const [areaRecord, setAreaRecord] = useState(initial?.areaRecord ?? null);
  const [pinCode, setPinCode] = useState(initial?.areaRecord?.pin_code ?? null);
  const [city, setCity] = useState(initial?.city ?? null);
  const [addressLabel, setAddressLabel] = useState(initial?.addressLabel ?? '');
  const [lat, setLat] = useState(initial?.lat ?? '');
  const [lon, setLon] = useState(initial?.lon ?? '');

  // Mirrors UnitVerdict's own floor/facing state purely so the URL sync
  // effect below has something to write -- UnitVerdict remains the real
  // owner (see onUnitPicked), this is not re-fed down except as the
  // *initial* value on first mount.
  const [floor, setFloor] = useState(initial?.floor ?? null);
  const [facing, setFacing] = useState(initial?.facing ?? null);

  // Which screen is actually on show. Every value is reachable directly --
  // from a door on Start, from a cross-branch offer, or from a URL -- so
  // this is a router, not a cursor walking a fixed sequence.
  const [viewStage, setViewStage] = useState(initial?.stage || (initial?.areaRecord || initial?.lat ? 'unit' : 'start'));

  const panelRef = useRef(null);

  // Take manual control of scroll restoration, once, for this whole flow.
  // Every tab change writes to history via replaceState below (viewStage,
  // personaId, mode, city, floor, facing... all synced to the URL) --
  // Safari (and other browsers) can associate a remembered scroll
  // position with each of those history entries and restore it on their
  // own timeline, independent of and after our own scrollTo() calls run.
  // That's a plausible, well-documented cause of a scroll position that
  // silently reverts moments after we set it, on this exact pattern of
  // an SPA that rewrites its own URL -- 'manual' hands all of that back
  // to our own code (the effect further down) instead.
  //
  // Handed back on unmount: this is a global browser setting, not a
  // per-page one, so leaving it on 'manual' meant every other page the
  // person visited afterwards in this tab (My Reports, the neighbourhood
  // report, home) also lost its scroll position on Back, for no reason.
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  // Direct Unit/Verdict entry with no location yet auto-geolocates once
  // (see the effect below) rather than showing anything to fill in --
  // this flag is what stops that from retriggering every render, and
  // gets cleared by resetLocation so leaving and coming back through a
  // fresh "no location" state (e.g. after switching entry mode) can
  // auto-locate again instead of staying stuck on a stale attempt.
  const autoGeoTried = useRef(false);
  const [autoGeoError, setAutoGeoError] = useState('');
  const [areaLookupBusy, setAreaLookupBusy] = useState(false);
  const [areaLookupNote, setAreaLookupNote] = useState('');
  const [areaFromUnit, setAreaFromUnit] = useState(false);
  // True while the AI report modal is up (UnitVerdict owns it, but this
  // component decides whether UnitVerdict is allowed to be hidden) --
  // see unitPanelStyle further down.
  const [reportOpen, setReportOpen] = useState(false);

  const resetLocation = () => {
    setAreaRecord(null); setPinCode(null); setCity(null); setAddressLabel('');
    setLat(''); setLon('');
    setFloor(null); setFacing(null);
    autoGeoTried.current = false; setAutoGeoError('');
  };

  // Switching between "search an address" and "browse scored areas".
  //
  // This used to wipe the location -- pin, area, floor, facing, the lot --
  // on every toggle. But the toggle is a link that reads "Prefer to
  // browse scored areas instead?", i.e. an invitation to *look*, and
  // looking cost people everything they had entered, with no warning and
  // no undo. Nothing is actually stale at the moment of the toggle
  // either: the pin is still the pin until they pick something else in
  // the other picker, and picking something else already replaces it
  // (handleAreaSelected / handleAddressConfirmed both do), which then
  // resets floor and facing through UnitVerdict's own [lat, lon] effect.
  // So the destructive step happens where it belongs -- on an actual new
  // choice -- and merely peeking at the other picker is free.
  const chooseMode = (m) => {
    setAreaFromUnit(false);
    setMode(m);
    setViewStage('location');
  };

  // The three doors on the Start tab. Each one goes straight where it says
  // it goes -- no shared preamble, no stage in between.
  //
  // 'unit' deliberately does NOT set a mode or send you via Location: the
  // Unit tab already auto-geolocates when it's entered with no lat/lon
  // (see the GPS effect further down, which predates this change), so
  // clicking "Check the flat" lands directly in the 3D shadow view at
  // wherever the user is standing. With no areaRecord attached, Verdict
  // then correctly shows a Home Comfort Score rather than a combined one,
  // and the area is offered as the next step at the end of that screen
  // (see UnitVerdict's onSeeNeighbourhood).
  //
  // 'furnishing' leaves this flow entirely -- the Furnishing Advisor is
  // its own route and takes a floor-plan upload, not a location, so there
  // is nothing for it to share with the other two branches.
  const chooseDoor = useCallback((key) => {
    setAreaFromUnit(false);
    if (key === 'neighbourhood') { setMode('locality'); setViewStage('location'); return; }
    if (key === 'unit') { setViewStage('unit'); return; }
    if (key === 'furnishing') router.push('/floor-plan-analysis');
  }, [router]);

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

  // Flat-first users finish the Home Comfort Score with no area attached.
  // This is the hand-off across to the other half, and it resolves the
  // area from the coordinates they already scored rather than handing
  // them an empty picker: reverse-geocode the pin to a postcode, then
  // look that postcode up in the AsliVastu coverage list. Same two calls
  // and the same pin_code match AddressPicker already uses to decide
  // whether a searched address is covered -- deliberately not a second,
  // differently-behaved matching rule sitting alongside it.
  //
  // An uncovered postcode is a real outcome rather than an error to
  // swallow: AsliVastu covers four cities, so a perfectly valid flat can
  // sit outside all of them. That case lands on the locality browser with
  // a note saying so, which is the honest fallback -- pick a nearby
  // covered area, or keep the unit-only score.
  const seeNeighbourhood = useCallback(async () => {
    if (!lat || !lon) return;
    setAreaLookupBusy(true);
    setAreaLookupNote('');
    try {
      const [geoRes, avRes] = await Promise.all([
        fetch(`/api/sunscout/reverse-geocode?lat=${lat}&lon=${lon}`),
        fetch('/api/av-localities'),
      ]);
      const postcode = (await geoRes.json())?.result?.postcode || '';
      const { cities } = await avRes.json();
      let found = null, foundCity = null;
      if (postcode && cities) {
        for (const c of Object.keys(cities)) {
          const rec = cities[c].find(r => r.pin_code === postcode);
          if (rec) { found = rec; foundCity = c; break; }
        }
      }
      if (found) {
        // Attach the area WITHOUT going through handleAreaSelected, which
        // also moves lat/lon to the locality centroid. The pin must not
        // move: these coordinates are the flat that was just scored, and
        // moving them trips UnitVerdict's [lat, lon] reset and wipes the
        // floor, facing and score the user is coming back to.
        setAreaRecord(found);
        setPinCode(found.pin_code);
        setCity(foundCity);
        setAreaFromUnit(true);
        setViewStage('location');
        return;
      }
      // Out of coverage. Deliberately STAY on the unit screen rather than
      // navigating to the locality browser, which is what the previous
      // version did and which quietly destroyed the user's work: every
      // record in that browser carries its own centroid, so picking one
      // teleports the pin to another city, fires the [lat, lon] reset,
      // and empties the floor/facing they had just scored. They then land
      // on Verdict being told to "pick a floor and facing first" for a
      // unit they had finished. Offering an area we cannot honestly
      // attach to this pin is worse than offering nothing.
      //
      // Reverse-geocoding returns no postcode at all in some countries --
      // the UAE has no postal-code system, so a Dubai pin comes back with
      // postcode: null. That's the common case here, not a rare edge, and
      // it deserves a straight answer rather than a picker.
      setAreaLookupNote(postcode
        ? `We don't have neighbourhood data for ${postcode} yet.`
        : "This location is outside our neighbourhood coverage.");
    } catch {
      setAreaLookupNote("Couldn't load neighbourhood data just now, try again in a minute.");
    } finally {
      setAreaLookupBusy(false);
    }
  }, [lat, lon]);

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
  // starting over.
  //
  // The important part is WHICH history operation each change gets:
  //
  //  - A change of tab (viewStage) does a pushState, so it becomes its
  //    own entry in the browser's history. Everything used to be a
  //    replaceState, which meant the entire flow -- Start, the area, the
  //    flat, the verdict, half an hour of picking -- collapsed into ONE
  //    history entry, and the browser/phone Back gesture took you
  //    straight out to whatever page you were on before the flow. That's
  //    the "I go back and I'm on the home screen and I've lost
  //    everything" bug: Back never meant "the previous screen of this
  //    flow", because as far as the browser knew there had only ever
  //    been one screen. Now Back walks Verdict -> Flat -> Area -> Start
  //    and only then leaves the page.
  //  - A change WITHIN a tab (dragging the floor slider, moving the pin,
  //    picking a facing) stays a replaceState. Those are edits, not
  //    navigations; giving each one a history entry would mean twenty
  //    Back presses to get out of the floor slider.
  //
  // Plain history API rather than a Next.js router push either way --
  // this must never trigger a navigation or a server round-trip, only
  // rewrite the address bar. Skipped entirely on the very first render
  // (the effect's dependencies already equal what page.js put in the URL
  // then), and once more immediately after a popstate we handled
  // ourselves (the URL is already correct at that point, and pushing
  // there would fight the Back press that caused it).
  const firstSync = useRef(true);
  const lastSyncedStage = useRef(initial?.stage || null);
  const skipNextSync = useRef(false);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      lastSyncedStage.current = viewStage;
      // Stamp the entry we arrived on so a Back press that lands here
      // is recognisable as ours (see the popstate handler below) rather
      // than looking like an entry from before the flow.
      // Third argument omitted on purpose: passing a URL here (even '')
      // would rewrite the address bar, and '' in particular resolves to
      // the bare path and would silently drop the query string we were
      // opened with. Omitting it leaves the URL exactly as it is and
      // only attaches our marker to the entry.
      try { window.history.replaceState({ ...window.history.state, bsStage: viewStage }, ''); } catch { /* non-fatal */ }
      return;
    }
    // Just came back from a popstate we handled: the browser has already
    // moved to that entry, so this run must REPLACE it (bringing its
    // query string back in line with the state we're actually holding)
    // rather than push a new one on top and break Forward.
    const fromPop = skipNextSync.current;
    skipNextSync.current = false;
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
    const url = window.location.pathname + (qs ? `?${qs}` : '');
    const stageChanged = !fromPop && viewStage !== lastSyncedStage.current;
    lastSyncedStage.current = viewStage;
    const state = { ...(window.history.state || null), bsStage: viewStage };
    if (stageChanged) window.history.pushState(state, '', url);
    else window.history.replaceState(state, '', url);
  }, [viewStage, personaId, mode, pinCode, city, areaRecord, lat, lon, addressLabel, floor, facing]);

  // The other half of the pushState above: a Back (or Forward) press
  // inside the flow. Everything the flow holds -- the area record, the
  // pin, the floor, the computed verdict -- is still sitting right here
  // in React state, because nothing actually navigated; the only thing
  // that needs restoring is which tab is showing. So read that off the
  // entry the browser just moved to and switch to it, and let all the
  // work stand.
  //
  // Falls back to reading ?stage= off the URL for an entry that predates
  // this (a link someone had open before a deploy). An entry with
  // neither is from before the flow started, and that's a real exit --
  // the browser does a full navigation for those and this never runs.
  useEffect(() => {
    const onPop = (e) => {
      let next = e.state?.bsStage;
      if (!next) {
        try { next = new URLSearchParams(window.location.search).get('stage'); } catch { /* ignore */ }
      }
      if (!next || next === viewStage) return;
      skipNextSync.current = true;
      setViewStage(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [viewStage]);

  // Land at the literal top of the page whenever the active tab changes --
  // otherwise a switch from a long tab (Unit, with the sun/shadow panel)
  // to a short one (Verdict) can leave you scrolled to a blank stretch
  // below its actual content, or vice versa.
  //
  // This used to compute a specific scroll target that tried to land just
  // below the sticky header+stepper, to avoid the panel's own heading
  // being covered by them. That entire calculation is unnecessary now:
  // the actual cause of the covering was a CSS mismatch (the stepper's
  // sticky `top` not matching the header's real height on phone, see
  // globals.css), which is fixed at the source.
  // With that fixed, y=0 -- the actual top of the page -- is always a
  // safe landing spot: header, stepper, and panel heading all render in
  // their normal, non-overlapping flow from there, on every tab.
  //
  // Repeated a few times over the first second, all at the SAME target
  // (0) -- unlike the old computed-offset version, there's no arithmetic
  // here that can be wrong, so repeating it costs nothing and guards
  // against anything nudging the scroll position back down shortly after
  // mount (async data landing, a font swap, or a browser's own automatic
  // scroll-anchoring correction all fall in this category, and there's no
  // way to verify from here which one it is on an actual phone).
  //
  // The repeats are cancelled the moment the person scrolls (or touches,
  // or spins a wheel) themselves. Without that, the guard turns into the
  // bug: switch tab, start reading immediately, and 300ms later the page
  // yanks itself back to the top under your finger -- twice. An intent to
  // scroll is unambiguous, and it always outranks a defensive re-snap.
  useEffect(() => {
    const toTop = () => window.scrollTo({ top: 0, behavior: 'auto' });
    toTop();
    const timers = [80, 300, 800].map(ms => setTimeout(toTop, ms));
    const cancel = () => timers.forEach(clearTimeout);
    const opts = { passive: true, once: true };
    window.addEventListener('wheel', cancel, opts);
    window.addEventListener('touchmove', cancel, opts);
    window.addEventListener('keydown', cancel, opts);
    return () => {
      cancel();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchmove', cancel);
      window.removeEventListener('keydown', cancel);
    };
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

  // The AI report is generated from live screenshots of the 3D map inside
  // UnitVerdict, so that component has to keep rendering for as long as
  // the report is running -- even if the person wanders back to Start or
  // Location while it works (the report card itself says "feel free to
  // keep browsing", so they will). display:none would kill the capture,
  // so park the panel offscreen instead: same real box, same painting,
  // just outside the viewport. See UnitVerdict's OFFSCREEN_LIVE for the
  // same trick one level down, and why none of the cheaper ways of
  // hiding a thing work here.
  // One step back, named for what it actually goes back to. The screen
  // before Verdict is the flat you scored, not the start of the product;
  // the screen before the flat is the area you picked it in, when there
  // was one. Only Location genuinely has nothing behind it but Start.
  // Where "pick up where I left off" goes: the furthest point their work
  // actually reaches, not just whatever tab they happened to leave from.
  const resumeStage = (floor != null && facing) ? 'verdict' : 'unit';

  const back = viewStage === 'verdict'
    ? { to: 'unit', label: 'Back to the flat' }
    : viewStage === 'unit' && (areaRecord || mode === 'locality')
      ? { to: 'location', label: 'Back to the area' }
      // Arrived on Location from the flat ("See the neighbourhood"),
      // so the flat -- not Start -- is the screen behind this one.
      : viewStage === 'location' && areaFromUnit
        ? { to: 'unit', label: 'Back to the flat' }
        : { to: 'start', label: 'All three options' };

  const unitPanelParked = !(viewStage === 'unit' || viewStage === 'verdict') && reportOpen;
  const unitPanelStyle = (viewStage === 'unit' || viewStage === 'verdict')
    ? { width: '100%', display: 'block' }
    : unitPanelParked
      ? { position: 'fixed', left: '-20000px', top: 0, width: '1000px', height: '760px', overflow: 'hidden', pointerEvents: 'none' }
      : { width: '100%', display: 'none' };

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


  return (
    <section className="section" id="property-score-flow" style={{ paddingTop: 0 }}>
      {/* The 4-step stepper that used to sit here is gone. It described a
          Start -> Area -> Flat -> Verdict sequence, and there is no such
          sequence any more: a user who picks "the flat" never passes
          through Area, and the numbered ticks kept implying they'd skipped
          something. What the stepper did carry that nothing else did is
          the way back out of a branch, so that -- and only that -- is what
          replaces it. Moving between Flat and Verdict already has its own
          controls inside UnitVerdict (onBackToUnit, and the score button
          forward), so this doesn't need to duplicate them. */}
      {viewStage !== 'start' && (
        <div className="wrap" style={{ paddingTop: 20, paddingBottom: 4, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <button
            onClick={() => setViewStage(back.to)}
            style={{
              background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
              fontSize: 13, color: 'var(--text)', display: 'inline-flex',
              alignItems: 'center', gap: 7, fontWeight: 600,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>&#8592;</span>
            {back.label}
          </button>
          {/* The way out of the whole branch, kept separate from the back
              step above. These used to be the same control -- one "All
              three options" link that, from any screen, threw you all the
              way to the start. That's fine as an escape hatch and awful
              as a back button, and it was the only one on the page, so
              stepping back one screen (Verdict -> the flat, to change a
              floor) meant restarting the branch. Two links, two jobs. */}
          {back.to !== 'start' && (
            <button
              onClick={() => setViewStage('start')}
              style={{
                background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
                fontSize: 12.5, color: 'var(--text-mute)', textDecoration: 'underline',
              }}
            >
              All three options
            </button>
          )}
        </div>
      )}
      <SideDataStrip />

      {/* .section-inner's 88px top padding + top border were sized for
          sitting below the old 3-screen intro sequence, as a breathing
          gap before the "real" content started -- now every tab sits
          directly under the sticky stepper instead, which already has
          its own bottom border as the divider, so that combination read
          as a large empty gap under it. .ps-tab-panel (globals.css) is
          smaller, has no border, and is tuned for being the first thing
          under the stepper on every tab. */}
      <div ref={panelRef} className="wrap ps-tab-panel ps-tab-panel-scroll-margin">

        {/* ── Start: one question, three doors. Replaces the old
            Priorities screen (persona list + entry-mode A/B), which asked
            two things before the user had seen anything. StartChooser
            routes each door itself via chooseDoor above. */}
        <div className="ps-flow-wrap" style={{ width: '100%', display: viewStage === 'start' ? 'block' : 'none' }}>
          {/* Coming back to Start with work already done -- via the "All
              three options" link, or Back, or a reopened tab -- used to
              look exactly like a first visit: three doors, no sign that
              the address, floor, facing and verdict you'd already got
              were still sitting there. People reasonably assumed they'd
              lost it and started over. This says plainly that it's still
              there, gives one click back to it, and makes throwing it
              away a deliberate, labelled act rather than a side effect of
              clicking a door again. */}
          {unitReady && (
            <div style={{
              border: '1px solid var(--line)', borderLeft: '3px solid var(--brand)',
              borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-mute)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>Still in progress</strong>
                {addressLabel ? ` — ${addressLabel}` : ''}
                {floor != null && facing ? ` · floor ${floor}, ${facing}` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setViewStage(resumeStage)}
                  className="ps-btn"
                  style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '9px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Pick up where I left off →
                </button>
                <button
                  onClick={() => { setAreaFromUnit(false); resetLocation(); }}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: 'var(--text-mute)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Start fresh
                </button>
              </div>
            </div>
          )}
          <StartChooser onChoose={chooseDoor} />
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
            {/* Switch between the two entry modes. Hidden on the
                resolved-from-the-flat path, where there is no picker on
                screen for either link to switch between. */}
            <div style={{ textAlign: 'right', marginBottom: 14, display: (areaFromUnit && areaRecord) ? 'none' : 'block' }}>
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
            {/* Arrived here from the flat, with the area already resolved
                from the coordinates that were just scored -- so there is
                nothing left to choose and no picker to show. AVAreaCard is
                the same sheet LocalityPicker renders once you've selected
                something, and carries its own link out to the full
                /neighbourhood-report page. The "pick a different area"
                link below is the escape hatch for a wrong pincode match,
                not the main path. */}
            {areaFromUnit && areaRecord ? (
              <>
                <AVAreaCard record={areaRecord} city={city} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
                  <button
                    onClick={() => { setAreaFromUnit(false); }}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: 'var(--text-mute)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Not the right area? Pick it yourself
                  </button>
                  <button
                    onClick={() => setViewStage('verdict')}
                    className="btn btn-lg btn-cta ps-btn ps-cta-btn"
                  >
                    See your combined verdict <span className="btn-cta-arrow">&#8594;</span>
                  </button>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 10, textAlign: 'right' }}>
                  Straight to the verdict, the flat is already scored.
                </p>
              </>
            ) : (
            <>
            {mode === 'locality' && <LocalityPicker onAreaSelected={handleAreaSelected} selectedPinCode={pinCode} />}
            {mode === 'address' && <AddressPicker onConfirmed={handleAddressConfirmed} />}

            </>
            )}
          </div>

          {mode === 'locality' && !areaFromUnit && (
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
          <div className="ps-flow-wrap" style={unitPanelStyle} aria-hidden={unitPanelParked || undefined}>
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
              viewStage={viewStage}
              onScoreComputed={() => setViewStage('verdict')}
              onBackToUnit={() => setViewStage('unit')}
              initialFloor={floor}
              initialFacing={facing}
              onUnitPicked={handleUnitPicked}
              onSeeNeighbourhood={seeNeighbourhood}
              seeNeighbourhoodBusy={areaLookupBusy}
              neighbourhoodNote={areaLookupNote}
              onDismissNeighbourhoodNote={() => setAreaLookupNote('')}
              onTryAnotherAddress={() => chooseMode('address')}
              onReportOpenChange={setReportOpen}
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
      </div>
    </section>
  );
}
