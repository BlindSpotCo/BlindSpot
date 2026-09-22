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
import { answersToRequest, GOAL_OPTIONS, HORIZON_OPTIONS, PRIORITY_OPTIONS, MAX_PRIORITIES } from '@/lib/reportQuestions';

const FACING = ['North','South','East','West','North-East','South-East','North-West','South-West'];

const LABEL_STYLE = { fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10.5, fontWeight: 500, color: 'var(--ink, #1C1812)', letterSpacing: '.08em', display: 'block', marginBottom: 10, textTransform: 'uppercase' };

// Tap-to-pick pill row for the three optional questions. A second tap on
// the picked pill clears it (single) or removes it (multi).
function OptionPills({ options, isOn, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = isOn(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.key)}
            style={{
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, lineHeight: 1,
              padding: '9px 13px', borderRadius: 999, cursor: 'pointer',
              background: on ? 'var(--brand, #3D4116)' : 'var(--card, #FFFDF8)',
              color: on ? '#FFFDF8' : 'var(--ink, #1C1812)',
              border: `1px solid ${on ? 'var(--brand, #3D4116)' : 'var(--line, rgba(28,24,18,0.16))'}`,
            }}
          >
            {o.label}
          </button>
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

// Shown one at a time while a report builds, in place of a frame counter.
// Each is something worth checking on a site visit, and each is a claim
// this product's own models make -- facing and heat (shadeHeatScore),
// winter shadow length (the sun path), floor height and outlook
// (view/privacy priors), monsoon exposure (dampnessScore). Nothing here
// that the report itself would not back up.
const REPORT_TIPS = [
  'West-facing rooms take the sun in the hottest part of the day. Expect warmer evenings and a bigger AC bill in summer.',
  'East-facing rooms get the morning sun, then sit in shade through the hottest hours - often the coolest facing in an Indian summer.',
  'For most of the year the midday sun is to the south, so south-facing windows get light in every season - and the most in winter.',
  'North-facing rooms get soft, even light and less direct sun. Cooler, but dimmer in the winter months.',
  'The winter sun sits much lower in the sky. A tower next door that is harmless in May can block your light completely in December.',
  'Higher floors usually get more hours of direct sun. The lowest floors are the first to be shaded by the buildings around them.',
  'In most Indian cities the monsoon arrives from the south-west. Check walls on that side for damp patches and suspiciously fresh paint.',
  'Visit at the time you will actually be home. A flat that is bright at noon can be in shade by four.',
];

export default function ReportModal({
  lat, lon, tzOffset, address, onClose, captureScreenshots, cancelCapture, onFloorFacingSubmit,
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
  // The optional questions step for the full report: goal, timeline, top
  // priorities (see lib/reportQuestions.js). Shown after Generate is
  // clicked, before any work starts. Skipping sends none of it.
  const [showQuestions, setShowQuestions] = useState(false);
  const [goal, setGoal] = useState('');
  const [horizon, setHorizon] = useState('');
  const [priorities, setPriorities] = useState([]);
  const togglePriority = (k) => setPriorities((p) => (
    p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_PRIORITIES ? [...p.slice(1), k] : [...p, k]
  ));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Which half of the job is running, and how far through the frame
  // capture we are -- both purely so the waiting state can say something
  // true instead of one fixed sentence for two minutes.
  const [step, setStep] = useState('capturing'); // 'capturing' | 'analysing' | 'captioning' | 'writing'
  const [captured, setCaptured] = useState({ done: 0, total: 12 });
  // Which tip is showing, and a displayed percentage that creeps toward
  // the next milestone during the long waits (reading the images, writing
  // the document), when the real figure would otherwise sit still for half
  // a minute and read as stuck. It never passes the next real milestone
  // and never goes backwards; the real figure takes over the moment it
  // moves.
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * REPORT_TIPS.length));
  const [creep, setCreep] = useState(0);
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
  // What actually landed, so the finished card can say so rather than
  // claiming twelve of everything. Partial results were being presented as
  // complete ones: eleven frames could time out and the modal still said
  // "frame 12 of 12" and "Report Ready".
  const [shortfall, setShortfall] = useState(null); // { frames, captions, table }
  // The deliberate Cancel button below, not the accidental-dismissal
  // guards further down (Escape/beforeunload stay blocked during loading
  // -- this is the one intentional way out). cancelledRef short-circuits
  // postJson's retry and tells the catch block in generate() to close
  // quietly instead of showing an error card; abortRef holds whichever
  // fetch is currently in flight so Cancel can end it immediately rather
  // than waiting out its 90s ceiling.
  const cancelledRef = useRef(false);
  const abortRef = useRef(null);
  const [cancelling, setCancelling] = useState(false);


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

  const generate = async (opts) => {
    const skipped = opts?.skip === true;
    cancelledRef.current = false;
    setCancelling(false);
    setLoading(true);
    setError('');
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
    const asked = answersToRequest(skipped ? {} : { goal, horizon, priorities });
    const safeCustomNote = skipped ? undefined : (customNote.trim() || undefined);
    const effectivePersonaId = personaId || asked.personaId;

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
    // (before the Cancel button below existed) there was no way out but a
    // page reload -- the card just spun on "laying out the document"
    // forever. The analyse route budgets itself at ~48s, so 90s here is
    // generous and still finite -- Cancel no longer has to wait this out,
    // but a run nobody's watching still ends on its own.
    const postJson = async (url, payload, label) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (cancelledRef.current) throw new Error('capture-cancelled');
        let res;
        // A fresh controller per attempt, same as AbortSignal.timeout(90_000)
        // used to give each one -- still a fresh 90s ceiling per attempt,
        // just also reachable from outside: abortRef always points at
        // whichever fetch is actually in flight, so Cancel can end it
        // immediately instead of waiting out that ceiling.
        const controller = new AbortController();
        abortRef.current = controller;
        // The analysis route can use most of its 120s now that the newer
        // models are slower; aborting at 90s would throw away a run that
        // was about to answer, and then pay for it again.
        const timeoutId = setTimeout(() => controller.abort(), label === 'analysis' ? 118_000 : 90_000);
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch (netErr) {
          if (cancelledRef.current) throw new Error('capture-cancelled');
          if (attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue; }
          throw new Error(`${label}-unreachable`);
        } finally {
          clearTimeout(timeoutId);
        }
        if (res.ok) return res.json();
        // Say why in the console -- a bare "failed-500" gave nothing to go on.
        try { console.error(`[report] ${label} ${res.status}:`, (await res.text()).slice(0, 400)); } catch {}
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

      // The model reads smaller copies. Twelve full 960px frames came close
      // to Vercel's 4.5 MB request limit on their own; 640px at a lower
      // JPEG quality is plenty to see shadows and roughly a third the size.
      // The report itself still uses the full-size frames.
      const shrink = (dataUrl) => new Promise((resolve) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const w = Math.min(640, img.naturalWidth || 640);
              const h = Math.round(w * (img.naturalHeight || 427) / (img.naturalWidth || 640));
              const c = document.createElement('canvas');
              c.width = w; c.height = h;
              c.getContext('2d').drawImage(img, 0, 0, w, h);
              resolve(c.toDataURL('image/jpeg', 0.72));
            } catch { resolve(dataUrl); }
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        } catch { resolve(dataUrl); }
      });
      const aiShots = await Promise.all(screenshots.map(async (sc) => ({ ...sc, base64: await shrink(sc.base64) })));

      const analysed = await postJson('/api/sunscout/report/analyse', {
        screenshots: aiShots, lat, lon, address: addr, floor, facing, tzOffset,
        avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
        personaId: effectivePersonaId, customNote: safeCustomNote,
        purpose: asked.purpose,
        horizon: asked.horizon,
        priorities: asked.priorities,
        actionItems: prefillActionItems || undefined,
        // The sun & shadow document wants the per-image descriptions and
        // nothing else -- not the eight-section combined report it used to
        // ask for and then throw away all but a twelfth of.
        captionsOnly: Boolean(galleryOnly),
      }, 'analysis');

      const { analysis, captions, summary, aiUnavailable, aiReason, captionedCount, captionError } = analysed || {};
      // The report leaves the written sections out quietly when the model
      // doesn't answer, so the reason goes to the console instead.
      if (aiUnavailable) console.warn('[report] written analysis unavailable:', aiReason || 'unknown');
      if (captionError) console.warn(`[report] image descriptions: ${captionedCount || 0}/${screenshots.length}, last error:`, captionError);

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

      // The twelve frames stay in the browser. Sending them to the server
      // just to have them pasted back into the HTML pushed this request
      // past Vercel's 4.5 MB body limit on detailed maps -- the 500s. The
      // server gets a short token per frame and the real images go back in
      // here.
      const shotToken = (i) => `__BS_SHOT_${i}__`;
      const { mainHtml: mainTpl, galleryHtml: galleryTpl } = await postJson('/api/sunscout/report/pdf', {
        lat, lon, tzOffset, address: addr, floor, facing,
        screenshots: screenshots.map((sc, i) => ({ label: sc.label, base64: shotToken(i) })),
        analysis: analysis || '', captions: captions || {}, summary,
        reportLabel: reportLabel || undefined,
        facingAssumptionNote: (!facingTouched && facingSuggestion) ? facingSuggestion.sentence : undefined,
        avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
        unitSubScores, verdictLabel,
        aiUnavailable: Boolean(aiUnavailable) && !galleryOnly,
        galleryOnly: Boolean(galleryOnly),
      }, 'pdf');

      const fillShots = (html) => screenshots.reduce((h, sc, i) => h.split(shotToken(i)).join(sc.base64), html || '');
      const mainHtml = fillShots(mainTpl);
      const galleryHtml = fillShots(galleryTpl);

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
      // A deliberate Cancel click, not a failure -- close quietly instead
      // of landing on an error card the person now has to also dismiss.
      // They already know why this stopped; they're the one who stopped
      // it, usually to fix a floor or facing picked wrong a moment ago.
      if (cancelledRef.current) { onClose?.(); return; }

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

  const generatingNow = loading && !error;
  useEffect(() => {
    if (!generatingNow) return;
    const id = setInterval(() => setTipIndex((i) => (i + 1) % REPORT_TIPS.length), 6500);
    return () => clearInterval(id);
  }, [generatingNow]);
  useEffect(() => {
    if (!generatingNow) { setCreep(0); return; }
    // Ceilings sit just under the next real milestone set in generate().
    const ceiling = step === 'capturing' ? 0 : step === 'writing' ? 97 : 76;
    if (!ceiling) return;
    const id = setInterval(() => setCreep((c) => Math.min(ceiling, Math.max(c, progress) + 1)), 1100);
    return () => clearInterval(id);
  }, [generatingNow, step, progress]);
  const shownProgress = Math.min(100, Math.max(progress, creep));

  // The one deliberate way out of a run in progress -- ends whichever
  // half is actually live (the map capture via the hook's own cancel, or
  // an in-flight analyse/pdf request via abortRef) and lets generate()'s
  // own catch block above close the modal quietly. Safe to call more than
  // once: cancelCapture()/abort() are no-ops once nothing's listening.
  const cancelGenerate = () => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    setCancelling(true);
    cancelCapture?.();
    abortRef.current?.abort();
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
    // The sun & shadow document is frames plus a table -- nothing the
    // questions would change -- so it starts straight away. The full
    // report stops at the questions step first.
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
  // Stays up on a failed run (loading drops back, showQuestions stays true),
  // so a retry happens from here with the error shown inline.
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
            <h3 style={{ fontFamily:DISPLAY, fontSize:20, fontWeight:800, color:INK, marginBottom:7, letterSpacing:'-.01em' }}>
              {galleryOnly ? 'Your sun & shadow report is ready' : 'Your report is ready'}
            </h3>
            <p style={{ fontSize:13.5, color:SUB, lineHeight:1.65, marginBottom:22, maxWidth:'30ch', marginLeft:'auto', marginRight:'auto' }}>
              {galleryOnly
                ? `${SHOTS.length - (shortfall?.frames || 0)} map images through the year${shortfall?.table ? '' : ', with the monthly sunlight table'}.`
                : 'The neighbourhood, the flat, and who this one suits.'}
            </p>

            {/* No shortfall notice. Missing captions, frames or written
                sections are left out of the document quietly -- a line here
                saying so only made a finished report read as a failed one. */}

            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {/* On the map step, this corner card and the dock's
                  "Continue to the verdict" button are both on screen at
                  once, and both looked like "the" next step -- a plain
                  "Open the report" here didn't say this leads somewhere
                  different (the sun & shadow gallery, not the verdict).
                  Naming which report fixes that without touching the
                  other button at all. */}
              <button
                onClick={() => window.open(reportUrl, '_blank')}
                className="rm-cta"
                style={{ background:INK, color:'#fff', border:'none', borderRadius:4, padding:'14px', fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:'.01em', minHeight:46 }}
              >
                {galleryOnly ? 'Open the sun & shadow report' : 'Open the report'}
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
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:ORG, letterSpacing:'.14em', marginBottom:6 }}>OPTIONAL</div>
                <h2 className="modal-title" style={{ fontFamily:DISPLAY, fontSize:21, fontWeight:800, color:INK, margin:0 }}>Personalize your report</h2>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:SUB, lineHeight:1, padding:4 }}>✕</button>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={LABEL_STYLE}>What's your goal?</label>
              <OptionPills options={GOAL_OPTIONS} isOn={(k) => goal === k} onPick={(k) => setGoal(goal === k ? '' : k)} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={LABEL_STYLE}>How long will you stay or hold it?</label>
              <OptionPills options={HORIZON_OPTIONS} isOn={(k) => horizon === k} onPick={(k) => setHorizon(horizon === k ? '' : k)} />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={LABEL_STYLE}>Top priorities <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(up to {MAX_PRIORITIES})</span></label>
              <OptionPills options={PRIORITY_OPTIONS} isOn={(k) => priorities.includes(k)} onPick={togglePriority} />
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={LABEL_STYLE}>Anything specific to address? <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
              <textarea
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="e.g. I work from home and need good daylight"
                style={{ width:'100%', border:`1px solid ${LINE}`, padding:'11px 12px', fontSize:13, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}
              />
            </div>

            {error && (
              <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:16, fontFamily:MONO }}>ERROR: {error}</div>
            )}

            <button onClick={() => generate()} className="rm-cta" style={{ width:'100%', background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
              {error ? 'Try again' : 'Generate the report'}
            </button>
            <button onClick={() => generate({ skip: true })} style={{ display:'block', margin:'12px auto 0', background:'none', border:'none', padding:'4px 2px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, color:SUB, textDecoration:'underline', textUnderlineOffset:4 }}>
              Skip &amp; generate default report →
            </button>
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

            {error && (
              <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:16, fontFamily:MONO }}>ERROR: {error}</div>
            )}

            <div style={{ display:'flex', gap:0 }}>
              <button onClick={() => (galleryOnly ? generate() : setShowQuestions(true))} style={{ flex:1, background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                {galleryOnly && error ? 'Try again' : galleryOnly ? 'Generate the report' : 'Continue'}
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', boxSizing:'border-box', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, textAlign:'center', marginTop:12, letterSpacing:'.03em' }}>
              {galleryOnly ? 'About a minute · photographs the map, then lays it out' : 'A few optional questions next, then about two minutes to build'}
            </div>
          </>
        ) : (autoGenerate && error) ? (
          // autoGenerate skips the form above entirely, so a failure on
          // that path has no step to reappear in -- this is its way out.
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:20, fontFamily:MONO, textAlign:'left' }}>ERROR: {error}</div>
            <div style={{ display:'flex', gap:0 }}>
              <button onClick={() => generate()} className="rm-cta" style={{ flex:1, background:ORG, color:'#fff', border:'1px solid transparent', boxSizing:'border-box', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
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
            <p style={{ fontSize:12.5, color:SUB, marginBottom:16 }}>
              {galleryOnly ? 'Usually takes about a minute.' : 'Usually takes about two minutes.'}
            </p>
            {/* What is happening, said the way a person would say it. This
                used to be "Photographing the sun and shadow through the
                year - frame 7 of 12" in monospace: accurate, and exactly
                the kind of line that tells a non-technical reader nothing
                except that a machine is counting. */}
            <p className="rm-gen-step" style={{ fontSize:14, fontWeight:600, color:INK, lineHeight:1.5, marginBottom:12 }}>
              {step === 'capturing'
                ? 'Generating your personalised sunlight analysis'
                : step === 'captioning'
                  ? 'Describing what each view shows'
                  : step === 'analysing'
                    ? 'Reading your building alongside the neighbourhood'
                    : 'Putting your report together'}
            </p>
            {/* The bar with its number beside it. A thin bar alone asks
                people to judge a proportion; "58%" doesn't. */}
            <div className="rm-gen-bar" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, background:'#EFEBE3', height:6, borderRadius:3, overflow:'hidden' }}>
                <div style={{ background:ORG, height:'100%', borderRadius:3, width:`${shownProgress}%`, transition:'width 0.6s ease' }} />
              </div>
              <span
                aria-live="polite"
                style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:INK, minWidth:40, textAlign:'right', fontVariantNumeric:'tabular-nums' }}
              >
                {Math.round(shownProgress)}%
              </span>
            </div>
            {/* Something worth knowing while you wait, instead of a frame
                count -- what to look for on the site visit. Changes every
                few seconds, which is also the clearest sign the run is
                alive. */}
            <div className="rm-gen-tip" key={tipIndex} style={{
              marginTop:18, padding:'12px 14px', textAlign:'left',
              background:'#F7F3EA', borderLeft:`3px solid ${ORG}`, borderRadius:4,
              animation:'rm-tip-in .45s ease',
            }}>
              <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:ORG, marginBottom:4 }}>
                Did you know?
              </div>
              <div style={{ fontSize:13, lineHeight:1.55, color:INK }}>
                {REPORT_TIPS[tipIndex]}
              </div>
            </div>
            {/* The one deliberate way to stop a run in progress -- for
                picking the wrong floor or facing and noticing mid-build.
                Escape and the backdrop click stay blocked during loading
                (see canDismiss above) so a stray keypress can't throw away
                a minute of work by accident; this is a real click, on a
                button whose only job is exactly that. */}
            <button
              type="button"
              onClick={cancelGenerate}
              disabled={cancelling}
              style={{
                marginTop:18, background:'none', border:'none', padding:0,
                color:SUB, fontFamily:MONO, fontSize:11, letterSpacing:'.05em',
                textTransform:'uppercase', textDecoration: cancelling ? 'none' : 'underline',
                textUnderlineOffset:3, cursor: cancelling ? 'default' : 'pointer',
                opacity: cancelling ? 0.6 : 1,
              }}
            >
              {cancelling ? 'Stopping…' : 'Cancel · pick a different floor or facing'}
            </button>
          </div>
        )}

        <style>{`
          @keyframes rm-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes rm-tip-in { from{ opacity:0; transform:translateY(4px) } to{ opacity:1; transform:none } }
          @media (prefers-reduced-motion: reduce){ .rm-gen-tip{ animation:none !important } }

          /* Same press-then-settle idiom as .btn-cta in globals.css --
             instant snap down on press, the base rule's bounce-easing
             transition plays the settle on release. */
          .rm-cta{ transition:transform .3s cubic-bezier(.34,1.56,.64,1); }
          .rm-cta:active{ transform:scale(.97); transition:transform .05s ease; }
          @media (prefers-reduced-motion:reduce){
            .rm-cta, .rm-cta:active{ transition:none; }
          }

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
            .rm-gen-tip{ display:none !important; }
            .rm-gen-step{ font-size:12.5px !important; margin-bottom:8px !important; }
          }
        `}</style>
      </div>
      </div>
    </div>,
    document.body
  );
}
