'use client';
// components/property-score/UnitVerdict.js
// Shared tail for both Property Score entry modes (locality-picked or
// direct-address). Renders the native SunScout panel for the exact pin,
// then either a combined AsliVastu+SunScout verdict (if an AsliVastu area
// was matched) or a SunScout-only Home Comfort Score (if not).

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SunScoutPanel from '@/components/sunscout/SunScoutPanel';
import LiveScoreCard from '@/components/sunscout/LiveScoreCard';
import FloorPlanAnalysis from '@/components/floor-plan/FloorPlanAnalysis';
import { getPersona, PERSONA_ORDER } from '@/lib/personas';
import { getActionItems } from '@/lib/property-score/actionItems';
import { FACTOR_LABELS } from '@/lib/property-score/ui';

const FACING_OPTS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

// The pitch deck's "05 — THE VERDICT SYSTEM" slide defines these four
// verdicts as a flat 2x2 colour quadrant, not four labels sharing one
// colour: olive (Prime Pick, strong+strong), wine (Location Play, strong
// area/weak unit), burnt orange (Hidden Gem, weak area/strong unit),
// olive-gold (Reconsider, weak+weak). The badge below used to render
// every one of the four in var(--brand) regardless of which verdict it
// was -- correct for Prime Pick, but Location Play/Hidden Gem/Reconsider
// all looked identical to it instead of carrying their own quadrant's
// colour the way the deck's own reference slide (and its live-product
// screenshot on the following slide) both show.
const VERDICT_COLOR = {
  'Prime Pick': 'var(--brand)',
  'Location Play': 'var(--av)',
  'Hidden Gem': 'var(--ss)',
  'Reconsider': 'var(--olive-gold)',
};

export default function UnitVerdict({ areaRecord, pinCode, city, lat, lon, setLat, setLon, addressLabel, personaId, onUnitSeen, onVerdictStart, viewStage, onScoreComputed, onBackToUnit, initialFloor, initialFacing, onUnitPicked }) {
  const persona = getPersona(personaId) || getPersona(PERSONA_ORDER[0]);
  const sunScoutRef = useRef(null);
  const [floor, setFloor] = useState(initialFloor ?? null);
  const [facing, setFacing] = useState(initialFacing ?? null);
  const [capturedFromSS, setCapturedFromSS] = useState(Boolean(initialFloor != null && initialFacing));
  const [ssPreview, setSsPreview] = useState(null);

  const [combined, setCombined] = useState(null);
  // Free-text "focus on this" note for the AI Report -- see where it's
  // read below, next to the Generate button.
  const [reportCustomNote, setReportCustomNote] = useState('');
  // Popup state for the "What to check when you visit" checklist -- see
  // where it's opened, further down.
  const [showVisitChecklist, setShowVisitChecklist] = useState(false);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const [combinedError, setCombinedError] = useState('');
  const [areaWeight, setAreaWeight] = useState(persona.defaultAreaWeight);
  // Debounce timer for the area/unit weight slider's recompute -- see
  // where it's used below. Cleared on unmount so a stray recompute can't
  // fire (and setState) after the component's gone.
  const weightDebounceRef = useRef(null);
  useEffect(() => () => clearTimeout(weightDebounceRef.current), []);
  // True from the instant the slider moves until the recompute it
  // triggered resolves -- separate from loadingCombined (which only
  // covers the fetch itself) so the score can visibly react during the
  // 250ms debounce too, not just once the request is in flight. Without
  // this, dragging the bar gave no feedback for up to ~250ms before
  // anything visibly changed, which read as "nothing happened."
  const [weightUpdating, setWeightUpdating] = useState(false);

  const [gpsError, setGpsError] = useState('');
  // Whether the report modal (owned by SunScoutPanel, opened via
  // sunScoutRef.openReport) is currently up -- see showUnit below for
  // why this needs to be tracked here at all.
  const [reportOpen, setReportOpen] = useState(false);
  // Lat/lon are already populated by the time this panel renders -- from
  // the locality's area record, or the pin the user just confirmed on the
  // map in AddressPicker. Showing them up front as two blank-looking
  // required text inputs reads as "something I still have to fill in" to
  // a first-time visitor. Default to a plain, human-readable location
  // line instead; the raw coordinate fields (and "use my location") stay
  // one click away for the rare case someone needs to correct them.
  const [showCoords, setShowCoords] = useState(false);

  // A persona switch resets the area/unit split back to that persona's
  // default — same idea as picking a new location, since the previous
  // slider position was tuned for a different persona's starting point.
  useEffect(() => {
    setAreaWeight(persona.defaultAreaWeight);
  }, [personaId]);

  // A new location (new locality pick, or a fresh address confirm) should
  // clear out any stale verdict from the previous one, and reset both
  // ticks -- "Unit" ticks on the Get Score click below, "Verdict" ticks
  // when the full AI report is generated. Skipped on the very first run:
  // that "change" is just this component mounting with a location that
  // was restored from the URL, and clearing floor/facing/combined right
  // back out again would defeat the whole point of restoring them.
  const isFirstLocationEffect = useRef(true);
  useEffect(() => {
    if (isFirstLocationEffect.current) { isFirstLocationEffect.current = false; return; }
    setCombined(null); setFloor(null); setFacing(null);
    setCapturedFromSS(false); setSsPreview(null); setAreaWeight(50);
    onUnitSeen?.(false);
    onVerdictStart?.(false);
  }, [pinCode, lat, lon]);

  // Mirror floor/facing up to PropertyScoreFlow purely so it has a
  // current value to write into the URL -- this component stays the
  // real owner of the state itself.
  useEffect(() => {
    onUnitPicked?.(floor, facing);
  }, [floor, facing, onUnitPicked]);

  const [comfortLoading, setComfortLoading] = useState(false);
  const [comfortError, setComfortError] = useState('');

  // Replaces the old LiveScoreModal popup -- same /api/sunscout/score call
  // it used to make, just fired from the inline picker on the page
  // instead of from inside a modal. Sets ssPreview to the full result
  // (LiveScoreCard needs subScores etc., not just {liveScore, grade}).
  const fetchComfortScore = useCallback(async () => {
    if (floor == null || !facing || !lat || !lon) return;
    setComfortLoading(true);
    setComfortError('');
    setSsPreview(null);
    try {
      const params = new URLSearchParams({
        lat: String(lat), lon: String(lon), tzOffset: '330',
        floor: String(floor), facing,
      });
      const res = await fetch(`/api/sunscout/score?${params.toString()}`);
      if (!res.ok) throw new Error('score-failed');
      const data = await res.json();
      setSsPreview(data);
      setCapturedFromSS(true);
    } catch {
      setComfortError('Could not compute a score for this unit right now. Try again in a minute.');
    } finally {
      setComfortLoading(false);
    }
  }, [lat, lon, floor, facing]);

  const handleLocationSelect = useCallback((newLat, newLon) => {
    setLat(String(newLat)); setLon(String(newLon));
  }, [setLat, setLon]);

  // Syncs the AI Report modal's own floor/facing picker back up here --
  // that modal is separate from the inline Home Comfort Score picker
  // above, and keeps its own picker for when someone opens the full
  // report without having gone through the inline flow first.
  const handleReportFloorFacing = useCallback((f, d) => {
    setFloor(f); setFacing(d); setCapturedFromSS(true); setSsPreview(null); setCombined(null);
  }, []);

  const useMyLocation = () => {
    setGpsError('');
    if (!navigator.geolocation) { setGpsError('This browser does not support location access.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLon(pos.coords.longitude.toFixed(6)); },
      err => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied, check your browser/site settings and try again.'
            : 'Could not get your location right now, try entering lat/lon manually instead.'
        );
      }
    );
  };

  const computeCombined = useCallback(async (customAreaWeight, floorOverride, facingOverride) => {
    const useFloor = floorOverride ?? floor;
    const useFacing = facingOverride ?? facing;
    if (!lat || !lon || useFloor == null || !useFacing) return;
    onUnitSeen?.(true);
    const aw = customAreaWeight ?? areaWeight;
    setLoadingCombined(true);
    setCombinedError('');
    try {
      if (pinCode) {
        const params = new URLSearchParams({
          pin_code: pinCode, lat, lon, floor: String(useFloor), facing: useFacing, tzOffset: '330',
          weightArea: String(aw / 100), weightUnit: String((100 - aw) / 100),
          persona: personaId,
        });
        const res = await fetch(`/api/property-score?${params}`);
        if (!res.ok) throw new Error('failed');
        setCombined(await res.json());
      } else {
        const params = new URLSearchParams({ lat, lon, floor: String(useFloor), facing: useFacing, tzOffset: '330' });
        const res = await fetch(`/api/sunscout/score?${params}`);
        if (!res.ok) throw new Error('failed');
        const ss = await res.json();
        setCombined({
          combinedScore: ss.liveScore,
          verdict: { label: 'Home Comfort Score', detail: 'No Neighbourhood Score data for this pincode yet, this is the unit-only Home Comfort Score.' },
          area: null,
          unit: { source: 'Home Comfort Score', floor: ss.unit?.floor ?? useFloor, facing: ss.unit?.facing ?? useFacing, score: ss.liveScore, grade: ss.grade, weight: 100, subScores: ss.subScores },
          formula: null,
          dataNotes: ss.dataNotes || [],
        });
      }
      onScoreComputed?.();
    } catch {
      setCombinedError('Could not compute the score right now, please try again in a minute.');
    } finally {
      setLoadingCombined(false);
    }
  }, [pinCode, lat, lon, floor, facing, areaWeight, personaId, onScoreComputed]);

  // If we mounted already holding a full restored selection (URL had a
  // location *and* a floor/facing), recompute the actual score once too
  // -- otherwise a reload lands back on the Verdict tab with the right
  // floor/facing but no number, which is its own kind of "lost your
  // place." Fires once on mount only.
  const didAutoRestore = useRef(false);
  useEffect(() => {
    if (didAutoRestore.current) return;
    // viewStage here is this render's (mount's) value, captured by the
    // empty dep array below -- exactly what we want: only auto-compute
    // if the *restored* tab was already Verdict, not e.g. Unit with a
    // floor/facing mid-pick that just hasn't been submitted yet.
    if (viewStage === 'verdict' && initialFloor != null && initialFacing && lat && lon) {
      didAutoRestore.current = true;
      computeCombined(undefined, initialFloor, initialFacing);
    }
    // Mount-only, deliberately -- see didAutoRestore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unit and Verdict are two views over this one mounted instance (see
  // PropertyScoreFlow.js's comment) rather than two components, so
  // SunScoutPanel's own 3D scene survives switching tabs. The sunscout
  // panel + floor/facing/Get Score block below both belong to the Unit
  // tab and hide via display:none rather than unmounting when Verdict is
  // active -- SunScoutPanel specifically needs that (its map/drag state
  // would otherwise reset); the floor/facing block has no state at risk
  // itself but shares the same toggle for one obvious on/off switch
  // instead of two separate conditions to keep in sync. The verdict card
  // further down is a plain conditional -- nothing in it holds state of
  // its own, `combined` already lives in this component regardless of
  // which branch renders it.
  // "Generate Full AI Report" (further down, the Verdict tab's own
  // button) opens this modal via the ref while sitting ON the Verdict
  // tab -- which means normally this whole panel, modal included, would
  // be sitting inside a display:none ancestor the instant it opens (a
  // hidden ancestor hides its entire subtree). reportOpen keeps this
  // panel visible for exactly as long as that modal is, so "Generating
  // your report…" is actually seen rather than running invisibly until
  // you happen to click back to Unit.
  const showUnit = viewStage !== 'verdict' || reportOpen;

  // Independent of areaWeight on purpose -- built from the raw
  // per-dimension scores (area.factors, unit.subScores), not the
  // weighted combinedScore, so dragging the area/unit slider can't make
  // a real concern disappear from view (Apeksha, 3:22 PM: "keep
  // important concerns visible regardless of weighting").
  const actionItems = combined
    ? getActionItems({ areaFactors: combined.area?.factors, factorLabels: FACTOR_LABELS, unitSubScores: combined.unit?.subScores })
    : [];

  return (
    <>
      {/* SUNSCOUT PANEL */}
      <div style={{ marginBottom: 36, display: showUnit ? 'block' : 'none' }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 12 }}>SUN &amp; SHADOW FOR THIS FLAT</div>

        {lat && lon && addressLabel && !showCoords ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
              <span style={{ color: 'var(--text-dim)' }}>📍 </span>{addressLabel}
            </div>
            <button onClick={() => setShowCoords(true)} className="ps-link-btn" style={{ background: 'none', border: 'none', color: 'var(--text-mute)', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', flexShrink: 0 }}>
              Edit exact location
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)} className="uv-latlon-input"
              style={{ flex: '1 1 140px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--text)', fontSize: 13.5, fontFamily: "'IBM Plex Mono', monospace" }} />
            <input type="text" placeholder="Longitude" value={lon} onChange={e => setLon(e.target.value)} className="uv-latlon-input"
              style={{ flex: '1 1 140px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '9px 12px', color: 'var(--text)', fontSize: 13.5, fontFamily: "'IBM Plex Mono', monospace" }} />
            <button onClick={useMyLocation} className="uv-mylocation-btn ps-btn" style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '9px 16px', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              Use my location
            </button>
            {addressLabel && (
              <button onClick={() => setShowCoords(false)} className="ps-link-btn" style={{ flex: '0 0 100%', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, textAlign: 'left', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                Done editing - show location name
              </button>
            )}
          </div>
        )}
        {gpsError && <div style={{ color: '#f87171', fontSize: 12.5, marginBottom: 10 }}>{gpsError}</div>}
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 14 }}>
          Use the <strong style={{ color: 'var(--sun)' }}>HOME COMFORT SCORE</strong> button below for the breakdown, once you have a verdict below, you can generate the <strong style={{ color: 'var(--sun)' }}>full AI report</strong> covering both the neighbourhood and this unit.
        </div>

        {lat && lon && (
          <div style={{ width: '100%', maxWidth: '100%', border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', height: 680 }}>
            <SunScoutPanel
              ref={sunScoutRef}
              lat={parseFloat(lat)} lon={parseFloat(lon)}
              address={addressLabel || areaRecord?.name || ''}
              onLocationSelect={handleLocationSelect}
              onReportFloorFacing={handleReportFloorFacing}
              areaRecord={areaRecord}
              combinedScore={combined?.combinedScore}
              unitScore={combined?.unit?.score}
              unitSubScores={combined?.unit?.subScores}
              verdictLabel={combined?.verdict?.label}
              areaWeight={areaRecord ? areaWeight / 100 : undefined}
              unitWeight={areaRecord ? (100 - areaWeight) / 100 : undefined}
              personaId={personaId}
              onReportOpenChange={setReportOpen}
            />
          </div>
        )}
      </div>

      {/* HOME COMFORT SCORE -- picked and scored right here on the page,
          same "sheet" treatment as the Neighbourhood Score card above
          (plain bordered block, no overlay) instead of the modal popup
          this used to open. Floor/facing live here directly; no separate
          picker duplicated inside a popup to keep in sync with this one
          anymore. Getting the score, seeing it, and moving to Verdict is
          now three plain steps on one page: pick floor/facing -> Get
          Home Comfort Score -> Continue to Verdict, instead of open
          popup -> pick again inside it -> get score -> Done. */}
      {lat && lon && (
        <div style={{ marginBottom: 20, display: showUnit ? 'block' : 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '.12em', marginBottom: 4 }}>HOME COMFORT SCORE</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 16 }}>
            {areaRecord ? 'Do this first, the combined verdict below needs this to combine.' : 'Sun, shade & heat, view, privacy, and wind - for this exact floor and facing.'}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', flexShrink: 0 }}>Floor</span>
              <input type="range" min="0" max="30" value={floor ?? 0} onChange={e => { setFloor(Number(e.target.value)); setSsPreview(null); setCapturedFromSS(false); }} style={{ flex: 1, accentColor: 'var(--sun)' }} />
              <div style={{ background: 'var(--sun)', color: '#fff', borderRadius: 'var(--radius)', padding: '4px 12px', fontSize: 13.5, fontWeight: 700, minWidth: 36, textAlign: 'center' }}>{floor ?? 0}</div>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 16 }}>
              {(floor ?? 0) === 0 ? 'Floor 0 is the ground floor - more shade, more street noise, easier access.' : `Floor ${floor ?? 0} of the building - higher floors usually get more sun and less street noise.`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-mute)', flexShrink: 0 }}>Facing</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>Which way this unit's main windows/balcony open - decides how much sun, shade and heat it gets.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
              {FACING_OPTS.map(dir => (
                <button key={dir} onClick={() => { setFacing(dir); setSsPreview(null); setCapturedFromSS(false); }} className="uv-facing-btn" style={{
                  background: facing === dir ? 'var(--sun)' : 'transparent', color: facing === dir ? '#fff' : 'var(--text)',
                  border: `1px solid ${facing === dir ? 'var(--sun)' : 'var(--line)'}`,
                  padding: '8px 4px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: -1, marginTop: -1,
                }}>{dir}</button>
              ))}
            </div>
          </div>

          {!ssPreview && (
            <button onClick={fetchComfortScore} disabled={comfortLoading || floor == null || !facing} className="ps-btn ps-cta-btn"
              style={{
                background: (floor == null || !facing) ? 'var(--line)' : 'var(--sun)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '14px 24px', fontSize: 13.5, fontWeight: 700,
                cursor: (floor == null || !facing) ? 'default' : 'pointer', letterSpacing: '.03em', textTransform: 'uppercase',
                opacity: comfortLoading ? .6 : 1,
              }}>
              {comfortLoading ? 'Scoring this unit…' : '☀ Get Home Comfort Score →'}
            </button>
          )}
          {comfortError && <div style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{comfortError}</div>}

          {ssPreview && !comfortLoading && (
            <>
              <div style={{ marginTop: 16 }}>
                <LiveScoreCard result={ssPreview} />
              </div>
              <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
                <button onClick={() => { setSsPreview(null); setCapturedFromSS(false); }} style={{ flex: 1, background: 'transparent', color: 'var(--text)', border: '1px solid var(--line)', padding: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase' }}>
                  ← Adjust &amp; Recalculate
                </button>
                {/* The one deliberate step left between here and Verdict --
                    computeCombined() below both fetches the real combined
                    number and (via onScoreComputed) flips the wizard to
                    the Verdict tab. */}
                <button onClick={() => computeCombined()} disabled={loadingCombined} style={{ background: 'var(--brand)', color: '#fff', border: 'none', padding: '12px 22px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '.03em', textTransform: 'uppercase', opacity: loadingCombined ? .6 : 1 }}>
                  {loadingCombined ? 'Computing…' : (areaRecord ? 'Continue to Verdict →' : 'Continue →')}
                </button>
              </div>
              {combinedError && <div style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{combinedError}</div>}
            </>
          )}
        </div>
      )}

      {/* VERDICT -- its own tab. Plain conditional: nothing here holds
          state of its own (`combined` lives above, in this same
          component, regardless of whether this branch is rendering),
          so unmounting/remounting it on tab switches is safe. */}
      {viewStage === 'verdict' && lat && lon && (
        combined ? (
          <>
          <div className="uv-combined-card" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '28px 26px', background: 'var(--bg-2)' }}>
            {combined.area && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
                  <span className="mono" style={{ color: 'var(--slate)' }}>AREA {areaWeight}%</span>
                  <span className="mono" style={{ color: 'var(--sun)' }}>UNIT {100 - areaWeight}%</span>
                </div>
                <input type="range" min="0" max="100" value={areaWeight}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setAreaWeight(v);
                    setWeightUpdating(true);
                    clearTimeout(weightDebounceRef.current);
                    weightDebounceRef.current = setTimeout(() => {
                      computeCombined(v).finally(() => setWeightUpdating(false));
                    }, 250);
                  }}
                  style={{ width: '100%', accentColor: 'var(--slate)' }} />
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>
                  Starts 50/50, drag to reweight how much the neighbourhood matters vs. the specific flat, the score and verdict below recalculate live. This changes how the same data is read for you, not the property itself.
                </div>
              </div>
            )}

            <div className="uv-score-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 6 }}>
                  {combined.area ? 'BLINDSPOT COMBINED SCORE' : 'HOME COMFORT SCORE'}
                  {weightUpdating && <span style={{ color: 'var(--slate)' }}> - recalculating...</span>}
                </div>
                <div className="uv-score-number" style={{ fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 56, lineHeight: 1, color: 'var(--text)', opacity: weightUpdating ? .45 : 1, transition: 'opacity .15s ease' }}>
                  {combined.combinedScore}<span style={{ fontSize: 20, color: 'var(--text-dim)' }}>/100</span>
                </div>
              </div>
              {/* A verdict tag, not a control -- the original was a solid
                  filled pill with the same shape/weight as the page's real
                  buttons, which read as clickable even though nothing
                  happens on click. First fix (outlined mono chip) solved
                  that but came out flat/lifeless -- lost the colour-coded
                  punch the pitch deck's 2x2 quadrant design was built
                  around. This keeps the tag framing (VERDICT caption above
                  it, no cursor, no hover/shadow -- nothing that implies
                  "click me") but brings the colour back as a tinted fill +
                  bold display type, so it still reads as a label, just a
                  punchier one. */}
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', letterSpacing: '.12em', marginBottom: 6 }}>VERDICT</div>
                <div
                  className="uv-verdict-badge"
                  style={{
                    display: 'inline-block', fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 17,
                    color: VERDICT_COLOR[combined.verdict.label] || 'var(--brand)',
                    background: `color-mix(in srgb, ${VERDICT_COLOR[combined.verdict.label] || 'var(--brand)'} 16%, var(--bg-2))`,
                    padding: '7px 16px', borderRadius: 'var(--radius)', cursor: 'default',
                  }}
                >
                  {combined.verdict.label}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 14, color: 'var(--text-mute)', lineHeight: 1.6, marginBottom: 24 }}>{combined.verdict.detail}</p>

            {combined.area ? (
              <div className="uv-score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div className="uv-score-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--slate)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 6 }}>AREA - {combined.area.name} - {combined.area.weight}%</div>
                  <div className="uv-score-box-number" style={{ fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 24, color: 'var(--slate)' }}>{combined.area.score}</div>
                </div>
                <div className="uv-score-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT (HOME COMFORT) - FL {combined.unit.floor}, {combined.unit.facing} - {combined.unit.weight}%</div>
                  <div className="uv-score-box-number" style={{ fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 24, color: 'var(--sun)' }}>{combined.unit.score}</div>
                </div>
              </div>
            ) : (
              <div className="uv-score-box" style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--sun)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 20 }}>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 6 }}>UNIT (HOME COMFORT) - FL {combined.unit.floor}, {combined.unit.facing}</div>
                <div className="uv-score-box-number" style={{ fontFamily: "'Anton', sans-serif", fontWeight: 400, fontSize: 24, color: 'var(--sun)' }}>{combined.unit.score}</div>
              </div>
            )}

            {/* A standalone trigger rather than an inline block -- the
                checklist used to sit wedged between the combined score and
                its own Area/Unit breakdown, which broke the natural
                score -> breakdown reading order. This keeps that flow
                intact and treats the checklist as its own thing you reach
                for, not a paragraph you have to read past. */}
            {actionItems.length > 0 && (
              <button
                onClick={() => setShowVisitChecklist(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                  background: 'transparent', border: '1px solid var(--sun)', borderRadius: 'var(--radius)',
                  padding: '13px 18px', marginBottom: 24, cursor: 'pointer', textAlign: 'left',
                }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.08em', fontWeight: 500 }}>
                  What to check when you visit
                </span>
                <span style={{ fontSize: 13, color: 'var(--sun)' }}>→</span>
              </button>
            )}

            {showVisitChecklist && typeof document !== 'undefined' && createPortal(
              <div
                onClick={() => setShowVisitChecklist(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,5,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '24px 26px', boxShadow: '0 30px 90px rgba(0,0,0,0.35)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--sun)', letterSpacing: '.1em' }}>WHAT TO CHECK WHEN YOU VISIT</div>
                    <button onClick={() => setShowVisitChecklist(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {actionItems.map(item => (
                      <div key={item.key} style={{ fontSize: 14, color: 'var(--text-mute)', lineHeight: 1.55 }}>
                        <strong style={{ color: 'var(--text)' }}>{item.label} ({item.score}):</strong> {item.action}
                      </div>
                    ))}
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* The report always auto-generates the instant this modal opens
                (floor/facing already arrived above -- see the comment on
                ReportModal's autoGenerate), so a "focus on this" field
                needs to be captured here, one step before that, rather
                than inside the report modal's own form, which this flow
                never shows. */}
            <div style={{ marginBottom: 16 }}>
              <label className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '.06em', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                Anything specific you want the report to focus on? <span style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                value={reportCustomNote}
                onChange={e => setReportCustomNote(e.target.value)}
                rows={2}
                placeholder="e.g. I have young kids and care most about noise and safety, I work from home and need good daylight…"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>

            <button
              onClick={() => { onVerdictStart?.(true); sunScoutRef.current?.openReport({ floor: combined.unit.floor, facing: combined.unit.facing, customNote: reportCustomNote }); }}
              className="ps-btn ps-cta-btn"
              style={{
                background: 'var(--brand)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius)', padding: '13px 22px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '.03em', textTransform: 'uppercase', width: '100%',
              }}>
              {combined.area ? 'Generate Full AI Report - Neighbourhood + Unit' : 'Generate AI Report - Unit'}
            </button>
          </div>

          {/* Furnishing lives here on the Verdict tab, after the score
              card above, not as its own top-level tab -- keeping it on
              the same viewStage means the 3D map panel (which the report
              modal's captureScreenshots() depends on) never gets hidden
              via display:none just from someone browsing furnishing
              while a report generates. A separate "Furnishing" tab did
              exactly that and silently broke report generation. */}
          <div style={{ marginTop: 28, paddingTop: 28, borderTop: '1px solid var(--line)' }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--sun)', letterSpacing: '.12em', marginBottom: 4 }}>FURNISH THIS UNIT</div>
            <p style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 18, lineHeight: 1.55, maxWidth: 560 }}>
              Upload a floor plan - a PDF, JPG, or PNG - and get room-by-room furniture and placement suggestions, marked directly on the plan.
            </p>
            <FloorPlanAnalysis embedded />
          </div>
          </>
        ) : (
          // Reachable by clicking the stepper's Verdict tab directly (once
          // it's been visited before and is therefore clickable again) at
          // a moment `combined` has since been cleared -- a location or
          // persona change resets it. Nothing to show yet, so send them
          // back to compute one instead of a blank tab.
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 14.5, color: 'var(--text-mute)', marginBottom: 20 }}>No score yet for this unit, pick a floor and facing first.</p>
            <button onClick={onBackToUnit} className="btn btn-lg btn-cta ps-btn ps-cta-btn">← Back to Unit</button>
          </div>
        )
      )}
    </>
  );
}
