'use client';
// components/sunscout/ReportModal.js
// Ported from SunScout's components/ReportModal.tsx. Two real changes from
// the original: (1) API paths point at BlindSpot's own /api/sunscout/*
// routes instead of SunScout's, (2) the "Save to BlindSpot" redirect flow
// is gone -- redundant now that this runs natively inside BlindSpot itself
// -- replaced with a direct onFloorFacingSubmit(floor, facing) callback so
// the combined-score page can reuse the same values without postMessage.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SaveReportButton from '@/components/reports/SaveReportButton';
import { SHOTS } from '@/lib/sunscout/useMapCapture';

const FACING = ['North','South','East','West','North-East','South-East','North-West','South-West'];

// The "personalize your report" step, shown once per generation right
// before the real work starts (both the manual-form path and the
// autoGenerate path). Four quick-tap questions plus the existing free-text
// note. AUDIENCE_OPTIONS.persona maps straight onto lib/personas.js's four
// weighting profiles -- this replaces the old dedicated persona-picker
// screen with one plain question instead of naming "persona" anywhere.
const AUDIENCE_OPTIONS = [
  { key: 'just_me', label: 'Just me', persona: 'young_professional' },
  { key: 'family', label: 'My family, long-term', persona: 'family_buyer' },
  { key: 'investment', label: 'Investment or rental', persona: 'investor' },
  { key: 'client', label: 'A client of mine', persona: 'broker' },
];
const PURPOSE_OPTIONS = [
  { key: 'buying_to_live', label: 'Buying to live in it' },
  { key: 'buying_to_rent', label: 'Buying to rent out' },
  { key: 'renting_deciding', label: 'Renting nearby, deciding whether to buy' },
  { key: 'researching', label: 'Just researching / comparing' },
];
const HORIZON_OPTIONS = [
  { key: 'under_3', label: 'Under 3 years' },
  { key: '3_7', label: '3-7 years' },
  { key: '10_plus', label: '10+ years' },
  { key: 'unsure', label: 'Not sure yet' },
];
const PRIORITY_OPTIONS = [
  { key: 'safety', label: 'Safety & crime' },
  { key: 'schools', label: 'Schools' },
  { key: 'sunlight', label: 'Sunlight & daylight' },
  { key: 'privacy', label: 'Noise & privacy' },
  { key: 'air', label: 'Air quality' },
  { key: 'connectivity', label: 'Connectivity/commute' },
  { key: 'resale', label: 'Resale value' },
  { key: 'price', label: 'Price vs. fundamentals' },
];

const LABEL_STYLE = { fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10.5, fontWeight: 500, color: 'var(--ink, #1C1812)', letterSpacing: '.08em', display: 'block', marginBottom: 10, textTransform: 'uppercase' };

// Single- or multi-select pill row shared by all four tap questions above.
// `value` is a string for single-select, an array for multi (pass `multi`).
function OptionPills({ options, value, onSelect, multi, max }) {
  const ORG = 'var(--ss, #AF5F30)';
  const INK = 'var(--ink, #1C1812)';
  const SUB = 'var(--text-mute, #5A5140)';
  const LINE = 'var(--line, rgba(28,24,18,0.14))';
  const isSelected = (key) => (multi ? value.includes(key) : value === key);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const selected = isSelected(o.key);
        const disabled = multi && !selected && max && value.length >= max;
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(o.key)}
            style={{
              background: selected ? ORG : '#fff',
              color: selected ? '#fff' : (disabled ? SUB : INK),
              border: `1px solid ${selected ? ORG : LINE}`,
              padding: '9px 14px', fontSize: 12.5, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer', borderRadius: 20,
              opacity: disabled ? 0.55 : 1,
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// These are the page's own tokens, not a second palette.
//
// This modal opens from a page set in Geist, in warm browns, and rendered
// itself in Arial in a brighter, yellower orange with cold grey body text:
// it asked for 'Plus Jakarta Sans' and 'Space Grotesk', neither of which
// this site ever loads (app/layout.js fetches Geist, Geist Mono and
// Playfair), and hardcoded #E07B00 / #1A0A00 / #8A8A8A instead of --ss /
// --ink / --text-mute. You click an orange link and a different-looking
// dialog opens.
const ORG = 'var(--ss, #AF5F30)';
const INK = 'var(--ink, #1C1812)';
const SUB = 'var(--text-mute, #5A5140)';
const LINE = 'var(--line, rgba(28,24,18,0.14))';
const PAPER = 'var(--paper, #FFFDF8)';
const MONO = "'Geist Mono', ui-monospace, monospace";
const SANS = "'Geist', system-ui, sans-serif";
const DISPLAY = "'Geist', system-ui, sans-serif";

export default function ReportModal({
  lat, lon, tzOffset, address, onClose, captureScreenshots, onFloorFacingSubmit,
  // galleryOnly: this run was asked for the sun & shadow document -- the 12
  // map angles and the monthly sunlight table -- not the combined verdict.
  // Same pipeline either way; only which blob we hand back changes.
  galleryOnly,
  // Combined-report context, passed down from UnitVerdict via SunScoutPanel
  // when this modal is opened from the Property Score flow (as opposed to
  // SunScout used standalone). When avRecord is present, the generated
  // report covers the neighbourhood too, not just this unit.
  areaRecord, combinedScore, unitScore, areaWeight, unitWeight, unitSubScores, verdictLabel,
  personaId,
  prefillFloor, prefillFacing, prefillCustomNote, prefillActionItems,
  onBusyChange,
}) {
  const [floor, setFloor]     = useState(prefillFloor != null ? String(prefillFloor) : '0');
  const [facing, setFacing]   = useState(prefillFacing || 'South');
  const [facingTouched, setFacingTouched] = useState(Boolean(prefillFacing));
  const facingTouchedRef = useRef(Boolean(prefillFacing));
  // Every object URL this modal hands out, so they can be released when it
  // goes. galleryHtml carries all twelve JPEGs inline; a couple of "Try
  // Again"s left several megabytes pinned for the life of the tab.
  const madeUrlsRef = useRef([]);
  const [facingSuggestion, setFacingSuggestion] = useState(null);
  const [facingLoading, setFacingLoading] = useState(true);
  const [facingExpanded, setFacingExpanded] = useState(false);
  const [reportLabel, setReportLabel] = useState('');
  // Free-text "focus on this" note -- separate from the floor-plan/
  // furnishing notes field, this one steers the actual AI Report (verdict
  // + analysis), not the furnishing advisor. Usually arrives prefilled
  // from UnitVerdict's own field (the autoGenerate path never shows this
  // modal's form), but stays editable here too for the standalone-SunScout
  // path where this modal's form is the only place to say it.
  const [customNote, setCustomNote] = useState(prefillCustomNote || '');
  // The "personalize your report" step. Shown once per generation, before
  // the real work starts, on BOTH the manual-form path and the
  // autoGenerate path (which used to skip straight to generating with no
  // step at all). Answers here feed the report prompt server-side -- see
  // app/api/sunscout/report/analyse/route.js.
  const [showQuestions, setShowQuestions] = useState(false);
  const [audience, setAudience] = useState('');
  const [purpose, setPurpose] = useState('');
  const [horizon, setHorizon] = useState('');
  const [priorities, setPriorities] = useState([]);
  const togglePriority = (key) => {
    setPriorities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : (prev.length >= 3 ? prev : [...prev, key])));
  };
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Which half of the job is running, and how far through the frame
  // capture we are -- both purely so the waiting state can say something
  // true instead of one fixed sentence for two minutes.
  const [step, setStep] = useState('capturing'); // 'capturing' | 'analysing' | 'captioning' | 'writing'
  const [captured, setCaptured] = useState({ done: 0, total: 12 });
  const [error, setError]     = useState('');
  const [reportUrl, setReportUrl] = useState(null);
  // The report itself only exists as a blob: URL (see generate() below),
  // which dies the moment this tab closes -- nothing to actually persist.
  // savableData holds the pieces worth keeping (the written analysis +
  // summary + the report's own HTML, so a saved report can be reopened
  // later exactly as generated) for the Save button below.
  const [savableData, setSavableData] = useState(null);
  // Set when the report was built but the written commentary wasn't --
  // the report is still worth opening, and saying nothing about the gap
  // would be worse than the gap.
  const [aiNotice, setAiNotice] = useState(false);
  // What actually landed, so the finished card can say so rather than
  // claiming twelve of everything. Partial results were being presented as
  // complete ones: eleven frames could time out and the modal still said
  // "frame 12 of 12" and "Report Ready".
  const [shortfall, setShortfall] = useState(null); // { frames, captions, table }


  // Floor + facing were already picked one step earlier, in UnitVerdict's
  // own combined-score card (the button that opens this modal always
  // passes both -- see SunScoutPanel's single openReport() call site).
  // Re-asking for them here, behind a "Generate the report" button of its
  // own, was a second menu at the step that matters most: one more click
  // to confirm values the person had already committed to a moment ago.
  // When both arrive prefilled, skip straight to generating -- the form
  // below only still renders for a caller that opens this modal without
  // them.
  const autoGenerate = prefillFloor != null && !!prefillFacing;

  useEffect(() => {
    let cancelled = false;
    setFacingLoading(true);
    fetch(`/api/sunscout/report/suggest-facing?lat=${lat}&lon=${lon}`)
      .then(res => res.ok ? res.json() : { suggestion: null })
      .then(({ suggestion }) => {
        if (cancelled) return;
        if (suggestion) {
          setFacingSuggestion(suggestion);
          if (!facingTouchedRef.current) setFacing(suggestion.direction);
        } else if (!facingTouchedRef.current) {
          setFacingExpanded(true);
        }
      })
      .catch(() => {
        if (!cancelled && !facingTouchedRef.current) setFacingExpanded(true);
      })
      .finally(() => { if (!cancelled) setFacingLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const pickFacing = (dir) => {
    setFacing(dir);
    setFacingTouched(true);
    facingTouchedRef.current = true;
    setFacingExpanded(false);
  };

  const generate = async () => {
    setLoading(true);
    setError('');
    setAiNotice(false);
    setShortfall(null);
    setProgress(5);

    // Only bubble floor/facing up when they were just picked in THIS
    // modal's own form. When autoGenerate is true, floor/facing arrived
    // as prefill from the caller's already-current combined score --
    // resubmitting them back up used to call the parent's "a new
    // floor/facing was picked" handler regardless, which treats this as
    // a fresh unit change and clears out that very score. That's what
    // made the Verdict screen flash to "No score yet" the instant you
    // hit Generate: the number it had was live and correct, this just
    // wiped it out from underneath itself.
    if (onFloorFacingSubmit && !autoGenerate) onFloorFacingSubmit(parseInt(floor, 10), facing);

    const addr = address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const safeCustomNote = customNote.trim() || undefined;
    // personaId as a prop is never actually passed by either caller today
    // (ReportScreen.js doesn't set it) -- the "who's this for" question
    // below is the only thing that ever sets it now, mapped straight onto
    // lib/personas.js's four profiles.
    const effectivePersonaId = personaId || AUDIENCE_OPTIONS.find((o) => o.key === audience)?.persona || undefined;

    // Capturing twelve frames off the 3D map takes about a minute. It is
    // by far the most expensive part of this and it either works or it
    // doesn't -- so it happens ONCE. The old shape retried the whole run,
    // which meant a busy model cost the person a second minute of
    // photographing before failing at the same step.
    const capture = async () => {
      setStep('capturing');
      const shots = await captureScreenshots((done, total) => {
        setCaptured({ done, total });
        setProgress(5 + Math.round((done / total) * 40));
      });
      if (!shots || shots.length === 0) throw new Error('no-frames-captured');
      return shots;
    };

    // One retry, on the network steps only, and only for the failures a
    // retry can actually change.
    // A ceiling on each request. Without one, a response that never
    // arrives -- a proxy holding the socket, the platform killing the
    // function without closing it -- leaves this awaiting forever, and
    // there is deliberately no cancel button during generation. The result
    // was a card spinning on "laying out the document" with no way out but
    // a page reload. The analyse route budgets itself at ~48s, so 90s here
    // is generous and still finite.
    const postJson = async (url, payload, label) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let res;
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(90_000),
          });
        } catch (netErr) {
          if (attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue; }
          throw new Error(`${label}-unreachable`);
        }
        if (res.ok) return res.json();
        if (attempt === 0 && res.status >= 500) { await new Promise(r => setTimeout(r, 1200)); continue; }
        throw new Error(`${label}-failed-${res.status}`);
      }
      throw new Error(`${label}-failed`);
    };

    try {
      const screenshots = await capture();

      // The sun & shadow document is the frames plus the monthly table.
      // Both are computed from solar geometry; the model was only ever
      // adding captions. Asking for it anyway is what made this document
      // fail whenever the model was busy -- for something it doesn't need.
      setStep(galleryOnly ? 'captioning' : 'analysing');
      setProgress(50);

      const analysed = await postJson('/api/sunscout/report/analyse', {
        screenshots, lat, lon, address: addr, floor, facing, tzOffset,
        avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
        personaId: effectivePersonaId, customNote: safeCustomNote,
        purpose: purpose || undefined,
        horizon: horizon || undefined,
        priorities: priorities.length ? priorities : undefined,
        actionItems: prefillActionItems || undefined,
        // The sun & shadow document wants the per-image descriptions and
        // nothing else -- not the eight-section combined report it used to
        // ask for and then throw away all but a twelfth of.
        captionsOnly: Boolean(galleryOnly),
      }, 'analysis');

      const { analysis, captions, summary, aiUnavailable, captionedCount } = analysed || {};
      if (aiUnavailable) setAiNotice(true);

      // Three separate ways a run can come back short of what this modal
      // promised, none of which used to be visible anywhere: frames that
      // timed out, images the model didn't describe, and a solar
      // computation that failed and took the monthly table with it.
      const missingFrames = SHOTS.length - screenshots.length;
      const missingCaptions = Math.max(0, screenshots.length - (captionedCount || 0));
      const noTable = !summary?.monthlySummary?.length;
      if (missingFrames > 0 || missingCaptions > 0 || noTable) {
        setShortfall({ frames: missingFrames, captions: missingCaptions, table: noTable });
      }

      setStep('writing');
      setProgress(78);

      const { mainHtml, galleryHtml } = await postJson('/api/sunscout/report/pdf', {
        lat, lon, tzOffset, address: addr, floor, facing, screenshots,
        analysis: analysis || '', captions: captions || {}, summary,
        reportLabel: reportLabel || undefined,
        facingAssumptionNote: (!facingTouched && facingSuggestion) ? facingSuggestion.sentence : undefined,
        avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
        unitSubScores, verdictLabel,
        aiUnavailable: Boolean(aiUnavailable) && !galleryOnly,
        galleryOnly: Boolean(galleryOnly),
      }, 'pdf');

      setProgress(100);

      // The gallery (12 screenshots + per-image analysis) is its own blob
      // with its own URL. The main report links out to it via a
      // __GALLERY_URL__ placeholder that gets swapped for the real blob URL
      // here, once we know it -- this is what lets the main report stay
      // short (no images embedded) while still linking straight to them.
      const galleryBlob = new Blob([galleryHtml], { type: 'text/html' });
      const galleryUrl = URL.createObjectURL(galleryBlob);
      const finalMainHtml = mainHtml.replaceAll('__GALLERY_URL__', galleryUrl);

      // Only make the URL we are going to hand out. A gallery run used to
      // create a second object URL for the main report, never reference it,
      // and pin a full copy of that HTML for the life of the tab.
      const url = galleryOnly ? galleryUrl : URL.createObjectURL(new Blob([finalMainHtml], { type: 'text/html' }));
      madeUrlsRef.current.push(galleryUrl);
      if (url !== galleryUrl) madeUrlsRef.current.push(url);
      setReportUrl(url);
      setSavableData({
        // A gallery-only run must save the document it actually produced.
        // Storing the combined report here meant reopening a saved sun &
        // shadow report showed something the person never generated.
        //
        // galleryHtml is deliberately NOT saved alongside it. Nothing reads
        // it back -- /my-reports/[id] renders mainHtml and nothing else --
        // and it carries all twelve JPEGs inline, a couple of megabytes.
        // On a sun & shadow save it was the same document twice, which is
        // how a save of a perfectly good report came back as a failure.
        mainHtml: galleryOnly ? galleryHtml : finalMainHtml,
        analysis: analysis || '', summary, address: addr, floor, facing,
        lat, lon, verdictLabel, combinedScore, unitScore, areaWeight, unitWeight,
        hasArea: !!areaRecord,
        kind: galleryOnly ? 'sun-shadow' : (areaRecord ? 'combined' : 'unit'),
      });
    } catch (e) {
      console.error('Report generation failed:', e);
      // The map failing to load is a different problem from the AI being
      // busy, and it needs a different response from the person -- "try
      // again in a minute" is useless advice for a blocked CDN. The
      // capture layer reports which one it was, so say so.
      const msg = String(e?.message || '');
      setError(
        msg.startsWith('map-failed') || msg === 'map-not-ready'
          ? "The 3D map didn't load, so there was nothing to photograph for the report. That's usually a slow or blocked connection to the map provider, not a problem with your address. Close this, scroll to the map and wait for the buildings to appear, then try again."
          : msg === 'no-frames-captured'
            ? "The map loaded but none of the frames came back, so there was nothing to build a report from. This is usually a temporary problem with the map tiles, please try again in a minute."
            : msg === 'capture-not-wired'
              ? "The 3D map hasn't finished loading, so there was nothing to photograph. Close this, wait for the buildings to appear on the map, then try again."
            : msg === 'capture-already-running'
              ? 'A report is already being built from this spot. Let that one finish first.'
            : msg === 'capture-cancelled'
              ? 'That run was stopped before it finished.'
            : msg.startsWith('analysis-') || msg.startsWith('pdf-')
              ? `We photographed the map fine, but building the document failed (${msg}). The photographs are kept, so trying again picks up from there rather than starting over.`
              : "Something went wrong generating your report. This sometimes happens when things are busy, please try again in a minute."
      );
    } finally {
      setLoading(false);
    }
  };

  // The page locks the map pin while frames are being captured. That has to
  // track the run, not this component's presence: the finished and failed
  // cards stay mounted until dismissed.
  useEffect(() => { onBusyChange?.(loading); }, [loading, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);

  useEffect(() => () => {
    // Not on regenerate -- a report the person already opened in another
    // tab must keep working. Only when this modal is done for good.
    madeUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
    madeUrlsRef.current = [];
  }, []);

  useEffect(() => {
    // autoGenerate used to call generate() straight away here, skipping
    // any step at all. Now the combined/full-report path stops at the
    // personalize-questions step first -- generate() only ever runs from
    // that step's own button. The sun & shadow document (galleryOnly) is
    // the 12 map frames plus the monthly table, not a written verdict
    // shaped by who's reading it -- none of the five questions change
    // anything about that run (see the `persona`/`personalizeAnswers`
    // block in report/analyse/route.js, both ignored when captionsOnly),
    // so asking them first would just be a stalling screen. Straight to
    // generate() for that one, same as before.
    if (autoGenerate) { if (galleryOnly) generate(); else setShowQuestions(true); }
    // Mount-only -- floor/facing/prefill are fixed for this modal's
    // lifetime, and generate() itself isn't a stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The floor/facing/name FORM step and the personalize-QUESTIONS step are
  // both short, deliberate input steps, so together they stay a real
  // full-screen blocking modal -- that's the one moment where blocking is
  // actually right. Once "Generate" is clicked (loading) or the report is
  // ready, this switches to a small non-blocking corner card instead: no
  // dark backdrop, doesn't cover the rest of the page, and the person can
  // keep using the site (e.g. the Furnishing tab) while it finishes.
  // Portalled to document.body so it also survives sitting inside a
  // display:none ancestor when a tab switch hides the Unit/Verdict panel
  // this component actually lives in underneath.
  const isFormStep = !loading && !autoGenerate && !reportUrl && !showQuestions;
  // Shown for BOTH paths -- manual (after the floor/facing form) and
  // autoGenerate (which has no form step at all, so this is its first
  // screen). Stays visible on a failed generate() too (loading goes back
  // to false, showQuestions is never reset), so a retry re-shows this step
  // with its own inline error instead of a separate dead-end error card.
  const isQuestionsStep = !loading && !reportUrl && showQuestions;
  const isBlockingStep = isFormStep || isQuestionsStep;

  // Escape closes this -- but deliberately NOT while it's generating.
  // There is no cancel button during generation for the same reason:
  // closing throws away a run that takes a minute or two of real work
  // (12 map captures plus two model calls), and a stray Escape while
  // waiting is exactly the kind of thing that happens. Once there's
  // something to dismiss -- the form, an error, or the finished report --
  // Escape does the same thing as the Cancel/Close button next to it.
  const canDismiss = !loading || Boolean(error) || Boolean(reportUrl);
  useEffect(() => {
    if (!canDismiss) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canDismiss, onClose]);

  // A report in flight is a minute or two of work that cannot be
  // recovered -- 12 map captures plus two model calls, all of it living
  // only in this tab. Closing or reloading mid-run throws it away
  // silently, so ask first. Deliberately scoped to exactly that window:
  // no prompt before it starts, and none once the report is ready (the
  // blob is already made, and by then the person is done here).
  useEffect(() => {
    if (!loading || error) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [loading, error]);

  // The form step is the only blocking, full-screen state, so it's the
  // only one that should stop the page behind it scrolling. The corner
  // progress card explicitly invites you to keep browsing.
  useEffect(() => {
    if (!isBlockingStep || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isBlockingStep]);

  const overlayStyle = isBlockingStep
    ? { position:'fixed', inset:0, zIndex:1000, background:'rgba(10,5,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }
    : { position:'fixed', bottom:20, right:20, zIndex:1000, width:360, maxWidth:'calc(100vw - 40px)', pointerEvents:'none' };

  const cardStyle = isBlockingStep
    ? { background:PAPER, border:`1px solid ${LINE}`, borderRadius:8, padding:0, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 30px 90px rgba(0,0,0,0.35)', fontFamily:SANS }
    : { background:PAPER, border:`1px solid ${LINE}`, padding:0, width:'100%', maxHeight:'70vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.28)', borderRadius:8, fontFamily:SANS, pointerEvents:'auto' };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`modal-overlay${isBlockingStep ? '' : ' rm-corner-card'}`} style={overlayStyle}>
      <div style={cardStyle}>
      <div className="modal-body" style={{ padding: isBlockingStep ? 24 : 18 }}>

        {!isBlockingStep && !reportUrl && (
          <div className="mono" style={{ fontSize:10, fontWeight:600, color:ORG, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>
            {galleryOnly ? 'Sun & shadow report' : 'Full AI report'} generating - feel free to keep browsing
          </div>
        )}

        {reportUrl ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            {/* One quiet line, not a warning panel. What came back short is
                worth saying, but it is a footnote to a finished report --
                a bulleted box in amber read as though something had failed. */}
            <h3 style={{ fontFamily:DISPLAY, fontSize:20, fontWeight:800, color:INK, marginBottom:7, letterSpacing:'-.01em' }}>
              {galleryOnly ? 'Your sun & shadow report is ready' : 'Your report is ready'}
            </h3>
            <p style={{ fontSize:13.5, color:SUB, lineHeight:1.65, marginBottom:22, maxWidth:'30ch', marginLeft:'auto', marginRight:'auto' }}>
              {galleryOnly
                ? `${SHOTS.length - (shortfall?.frames || 0)} map images through the year${shortfall?.table ? '' : ', with the monthly sunlight table'}.`
                : 'The neighbourhood, the flat, and who this one suits.'}
            </p>

            {/* frames/captions describe the auto-generated sun & shadow
                gallery -- a bonus artifact linked from the full/combined
                report, not something that report's user asked for or is
                looking at (it has no images embedded at all; see the
                __GALLERY_URL__ comment in report/pdf/route.js). Naming
                "the linked gallery" still read as "why are you talking
                about images in MY report" -- the actual fix is not
                mentioning that gallery's completeness here at all unless
                the user explicitly asked for it (galleryOnly). What they
                asked for either came back complete or it didn't; a side
                document's shortfall isn't their problem to see. */}
            {(() => {
              const notices = [
                galleryOnly && shortfall?.frames > 0
                  ? `${SHOTS.length - shortfall.frames} of ${SHOTS.length} map frames came back.`
                  : null,
                galleryOnly && shortfall?.captions > 0
                  ? `${shortfall.captions} ${shortfall.captions === 1 ? 'image has' : 'images have'} no written description.`
                  : null,
                shortfall?.table ? 'The monthly sunlight table couldn’t be worked out for this pin.' : null,
                aiNotice && !(galleryOnly && shortfall?.captions) ? 'The written sections didn’t come back this time.' : null,
              ].filter(Boolean);
              if (!notices.length) return null;
              return (
                <p style={{
                  fontSize:12.5, color:SUB, lineHeight:1.7, marginBottom:22, textAlign:'left',
                  borderTop:`1px solid ${LINE}`, borderBottom:`1px solid ${LINE}`, padding:'11px 2px',
                }}>
                  {notices.join(' ')}
                  {' '}Everything else is measured and unaffected - generating again usually fills the rest in.
                </p>
              );
            })()}

            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              <button
                onClick={() => window.open(reportUrl, '_blank')}
                style={{ background:INK, color:'#fff', border:'none', borderRadius:4, padding:'14px', fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:'.01em', minHeight:46 }}
              >
                Open the report
              </button>

              <div style={{ display:'flex', gap:9 }}>
                {savableData && (
                  <div style={{ flex:1, display:'flex' }}>
                    <SaveReportButton
                      source="ai-report"
                      data={savableData}
                      style={{ flex:1, display:'flex' }}
                      defaultTitle={galleryOnly ? `${savableData.address} · sun & shadow` : savableData.address}
                    />
                  </div>
                )}
                <button
                  onClick={onClose}
                  style={{ flex:savableData ? '0 0 auto' : 1, background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderRadius:4, padding:'13px 18px', fontSize:13, fontWeight:600, cursor:'pointer', minHeight:46 }}
                >
                  Close
                </button>
              </div>
            </div>
            <p style={{ fontSize:11.5, color:SUB, marginTop:14 }}>Opens in a new tab.</p>
          </div>
        ) : isQuestionsStep ? (
          // Shown once per generation, on both the manual-form path (after
          // "Continue" below) and the autoGenerate path (which has no
          // floor/facing form at all, so this is its first screen). Also
          // re-shown on a failed generate() -- loading goes back to false,
          // showQuestions is never reset -- with its own inline error, the
          // same pattern the old form-step error box used.
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:ORG, letterSpacing:'.14em', marginBottom:6 }}>A FEW QUICK QUESTIONS</div>
                <h2 className="modal-title" style={{ fontFamily:DISPLAY, fontSize:21, fontWeight:800, color:INK, margin:0 }}>Personalize your report</h2>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:SUB, lineHeight:1, padding:4 }}>✕</button>
            </div>

            <p style={{ fontSize:13, color:SUB, lineHeight:1.6, marginBottom:24 }}>
              Everything below is optional, but it changes what the report leads with and how it's written for you specifically.
            </p>

            <div style={{ marginBottom:22 }}>
              <label style={LABEL_STYLE}>Who's this report for?</label>
              <OptionPills options={AUDIENCE_OPTIONS} value={audience} onSelect={setAudience} />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={LABEL_STYLE}>Why are you looking at this place?</label>
              <OptionPills options={PURPOSE_OPTIONS} value={purpose} onSelect={setPurpose} />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={LABEL_STYLE}>How long do you plan to stay or hold it?</label>
              <OptionPills options={HORIZON_OPTIONS} value={horizon} onSelect={setHorizon} />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={LABEL_STYLE}>What matters most to you? <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(up to 3)</span></label>
              <OptionPills options={PRIORITY_OPTIONS} value={priorities} onSelect={togglePriority} multi max={3} />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={LABEL_STYLE}>Anything specific you're worried about or want addressed? <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
              <textarea
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                rows={2}
                placeholder="e.g. I care most about noise and safety, I work from home and need good daylight…"
                style={{ width:'100%', border:`1px solid ${LINE}`, padding:'11px 12px', fontSize:13, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}
              />
            </div>

            {error && (
              <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:16, fontFamily:MONO }}>ERROR: {error}</div>
            )}

            <div style={{ display:'flex', gap:0 }}>
              <button onClick={generate} style={{ flex:1, background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                {error ? 'Try again' : 'Generate the report'}
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', boxSizing:'border-box', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, textAlign:'center', marginTop:12, letterSpacing:'.03em' }}>About two minutes · photographs the map, then writes it up</div>
          </>
        ) : !loading && !autoGenerate ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:ORG, letterSpacing:'.14em', marginBottom:6 }}>{areaRecord ? 'Combined report' : 'Sun & shadow report'}</div>
                <h2 className="modal-title" style={{ fontFamily:DISPLAY, fontSize:21, fontWeight:800, color:INK, margin:0 }}>Home Buyer Analysis</h2>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:SUB, lineHeight:1, padding:4 }}>✕</button>
            </div>

            <p style={{ fontSize:13, color:SUB, lineHeight:1.6, marginBottom:26 }}>
              {areaRecord
                ? `We combine your Neighbourhood Score for ${areaRecord.name || areaRecord.pin_code} with precise sun/shadow data for this exact unit - 12 real screenshots (3 per season) - then use AI to write one BlindSpot Verdict covering both. The report itself stays short and readable; the images and their descriptions sit in a gallery linked from the top of it.`
                : 'We compute precise sun/shadow data for this exact location, capture 12 real screenshots (3 per season) at different times, then use AI to narrate the shadow patterns. The images and their descriptions open in a gallery linked from the top of the report, keeping the report itself short.'}
            </p>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Floor number</label>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <input type="range" min="1" max="60" value={floor} onChange={e => setFloor(e.target.value)} style={{ flex:1, accentColor:ORG }} />
                <div style={{ background:INK, color:'#fff', fontFamily:MONO, fontSize:13, fontWeight:500, padding:'4px 12px', minWidth:40, textAlign:'center' }}>{floor}</div>
              </div>
              <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, marginTop:6 }}>Floor {floor} ≈ {parseInt(floor, 10) * 3}m above ground</div>
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Facing direction</label>

              {!facingExpanded ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${LINE}`, padding:'11px 14px' }}>
                  <div style={{ fontSize:13, color:INK }}>
                    {facingLoading ? (
                      <span style={{ color:SUB, fontFamily:MONO, fontSize:11.5 }}>Detecting facing from nearby buildings…</span>
                    ) : (
                      <>
                        <strong>{facing}</strong>
                        <span style={{ color:SUB, fontSize:11.5 }}>
                          {' '}- {facingTouched ? 'set by you' : facingSuggestion ? 'assumed from nearby buildings, unconfirmed' : 'default, unconfirmed'}
                        </span>
                      </>
                    )}
                  </div>
                  <button onClick={() => setFacingExpanded(true)} style={{ background:'none', border:'none', color:ORG, fontFamily:MONO, fontSize:11, fontWeight:500, cursor:'pointer', textTransform:'uppercase', letterSpacing:'.04em', padding:0 }}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
                    {FACING.map(dir => (
                      <button key={dir} onClick={() => pickFacing(dir)} style={{ background: facing===dir ? ORG : '#fff', color: facing===dir ? '#fff' : INK, border:`1px solid ${facing===dir ? ORG : LINE}`, padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer', marginLeft:-1, marginTop:-1 }}>{dir}</button>
                    ))}
                  </div>
                  <button onClick={() => setFacingExpanded(false)} style={{ background:'none', border:'none', color:ORG, fontFamily:MONO, fontSize:10.5, cursor:'pointer', marginTop:10, padding:0, textTransform:'uppercase', letterSpacing:'.05em' }}>
                    [−] Done
                  </button>
                </>
              )}

              {facingSuggestion && !facingTouched && (
                <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, marginTop:10, lineHeight:1.6, borderTop:`1px dashed ${LINE}`, paddingTop:8 }}>
                  {facingSuggestion.sentence}
                </div>
              )}
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Name this report <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Skyline Residences · Unit 502"
                value={reportLabel}
                onChange={e => setReportLabel(e.target.value)}
                style={{ width:'100%', border:`1px solid ${LINE}`, padding:'11px 12px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
              />
            </div>

            {/* Only reachable for galleryOnly: the combined-report path
                always detours through the questions step (which has its
                own inline error + Try Again) before generate() ever runs,
                so a failure there never lands back here. A galleryOnly
                failure has nowhere else to surface, since this form is the
                only step it ever shows. */}
            {galleryOnly && error && (
              <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:16, fontFamily:MONO }}>ERROR: {error}</div>
            )}

            <div style={{ display:'flex', gap:0 }}>
              {/* galleryOnly (the sun & shadow document, not the combined
                  verdict) skips the personalize step entirely and generates
                  straight away -- none of those five questions change a
                  document that's just 12 map frames plus the monthly
                  table, see the mount-effect comment above for why. */}
              <button onClick={() => (galleryOnly ? generate() : setShowQuestions(true))} style={{ flex:1, background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                {galleryOnly && error ? 'Try again' : galleryOnly ? 'Generate the report' : 'Continue'}
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', boxSizing:'border-box', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, textAlign:'center', marginTop:12, letterSpacing:'.03em' }}>
              {galleryOnly ? 'About a minute · photographs the map, then lays it out' : 'A few quick questions next, then about two minutes to build'}
            </div>
          </>
        ) : (autoGenerate && galleryOnly && error) ? (
          // autoGenerate skips the form above entirely, so a galleryOnly
          // failure on that path has no step to reappear in at all --
          // this is its only way out. (The combined-report autoGenerate
          // path never lands here; its failures re-show the questions
          // step instead, see isQuestionsStep above.)
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:20, fontFamily:MONO, textAlign:'left' }}>ERROR: {error}</div>
            <div style={{ display:'flex', gap:0 }}>
              <button onClick={generate} style={{ flex:1, background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Try Again
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', boxSizing:'border-box', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="rm-generating" style={{ textAlign:'center', padding:'30px 0' }}>
            <div className="rm-generating-spinner" style={{ marginBottom:20, animation:'rm-spin 1.6s linear infinite', display:'inline-block', color:ORG }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </div>
            <h3 className="rm-generating-title" style={{ fontFamily:DISPLAY, fontSize:17, fontWeight:800, color:INK, marginBottom:4 }}>
              {galleryOnly ? 'Building your sun & shadow report' : 'Writing your full AI report'}
            </h3>
            {/* The two runs are genuinely different jobs and used to look
                identical while they ran. One photographs the map and lays
                the frames out with the sunlight table; the other adds a
                model reading all of it. Say which one this is, and how
                long it should take. */}
            <p style={{ fontFamily:MONO, fontSize:10.5, color:SUB, letterSpacing:'.04em', textTransform:'uppercase', marginBottom:12 }}>
              {galleryOnly ? '12 map images, described · + sunlight table · ~1 min' : 'The written verdict, area and flat together · ~2 min'}
            </p>
            {/* Says which phase is running, and counts the frames through
                the long one. One unchanging sentence for two minutes is
                why a working run and a stuck run looked identical. */}
            <p style={{ fontFamily:MONO, fontSize:11.5, color:SUB, lineHeight:1.8, marginBottom:20 }}>
              {step === 'capturing'
                ? `Photographing the sun and shadow through the year - frame ${Math.min(captured.done + 1, captured.total)} of ${captured.total}.`
                : step === 'captioning'
                  ? 'Frames captured. Writing what each one shows.'
                  : step === 'analysing'
                    ? 'Frames captured. The AI is now reading them alongside the neighbourhood data.'
                    : 'Almost there, laying out the document.'}
            </p>
            <div style={{ background:'#EFEBE3', height:4, overflow:'hidden' }}>
              <div style={{ background:ORG, height:'100%', width:`${progress}%`, transition:'width 0.4s ease' }} />
            </div>
          </div>
        )}

        <style>{`
          @keyframes rm-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

          /* The non-blocking corner card (progress + "report ready") was
             sized for desktop -- width:360 with maxWidth:calc(100vw - 40px)
             is nearly the full screen width on a phone, and the generating
             state's 30px top/bottom padding plus a 36px spinner made it
             read as a second full-screen popup rather than a small corner
             notice. Below 480px: pin it to a slim bar near the bottom
             edge instead of a floating card, and shrink the generating
             state's own padding/spinner/heading so it reads as a strip,
             not a screen. */
          @media (max-width:480px){
            .rm-corner-card{
              left:10px !important; right:10px !important; bottom:10px !important;
              width:auto !important; max-width:none !important;
            }
            .rm-corner-card .modal-body{ padding:12px 14px !important; }
            .rm-generating{ padding:6px 0 !important; }
            .rm-generating-spinner{ margin-bottom:8px !important; }
            .rm-generating-spinner svg{ width:24px !important; height:24px !important; }
            .rm-generating-title{ font-size:14px !important; margin-bottom:2px !important; }
          }
        `}</style>
      </div>
      </div>
    </div>,
    document.body
  );
}
