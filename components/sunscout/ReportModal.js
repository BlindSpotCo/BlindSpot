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

const FACING = ['North','South','East','West','North-East','South-East','North-West','South-West'];

const ORG = '#E07B00';
const INK = '#1A0A00';
const SUB = '#8A8A8A';
const LINE = 'rgba(26,10,0,0.15)';
const MONO = "'Geist Mono', monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";
const DISPLAY = "'Space Grotesk', sans-serif";

export default function ReportModal({
  lat, lon, tzOffset, address, onClose, captureScreenshots, onFloorFacingSubmit,
  // Combined-report context, passed down from UnitVerdict via SunScoutPanel
  // when this modal is opened from the Property Score flow (as opposed to
  // SunScout used standalone). When avRecord is present, the generated
  // report covers the neighbourhood too, not just this unit.
  areaRecord, combinedScore, unitScore, areaWeight, unitWeight, unitSubScores, verdictLabel,
  personaId,
  prefillFloor, prefillFacing, prefillCustomNote, prefillActionItems,
}) {
  const [floor, setFloor]     = useState(prefillFloor != null ? String(prefillFloor) : '0');
  const [facing, setFacing]   = useState(prefillFacing || 'South');
  const [facingTouched, setFacingTouched] = useState(Boolean(prefillFacing));
  const facingTouchedRef = useRef(Boolean(prefillFacing));
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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  // Which half of the job is running, and how far through the frame
  // capture we are -- both purely so the waiting state can say something
  // true instead of one fixed sentence for two minutes.
  const [step, setStep] = useState('capturing'); // 'capturing' | 'analysing' | 'writing'
  const [captured, setCaptured] = useState({ done: 0, total: 12 });
  const [error, setError]     = useState('');
  const [reportUrl, setReportUrl] = useState(null);
  // The report itself only exists as a blob: URL (see generate() below),
  // which dies the moment this tab closes -- nothing to actually persist.
  // savableData holds the pieces worth keeping (the written analysis +
  // summary + the report's own HTML, so a saved report can be reopened
  // later exactly as generated) for the Save button below.
  const [savableData, setSavableData] = useState(null);

  // Floor + facing were already picked one step earlier, in UnitVerdict's
  // own combined-score card (the button that opens this modal always
  // passes both -- see SunScoutPanel's single openReport() call site).
  // Re-asking for them here, behind a "Generate AI Report" button of its
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

    const attemptOnce = async () => {
      // Capture is the long half of this -- twelve frames, ~4.5s each,
      // near enough a minute. Reporting each frame as it lands is what
      // makes a slow run distinguishable from a hung one; before, the bar
      // sat at 5% for the whole phase and every healthy run looked frozen.
      setStep('capturing');
      const screenshots = await captureScreenshots((done, total) => {
        setCaptured({ done, total });
        setProgress(5 + Math.round((done / total) * 30));
      });
      setStep('analysing');
      setProgress(35);

      const analyseRes = await fetch('/api/sunscout/report/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots, lat, lon, address: addr, floor, facing, tzOffset,
          avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
          personaId, customNote: safeCustomNote,
          actionItems: prefillActionItems || undefined,
        }),
      });
      if (!analyseRes.ok) throw new Error('analysis-failed');
      const { analysis, summary } = await analyseRes.json();
      setStep('writing');
      setProgress(75);

      const pdfRes = await fetch('/api/sunscout/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat, lon, tzOffset, address: addr, floor, facing, screenshots, analysis, summary,
          reportLabel: reportLabel || undefined,
          facingAssumptionNote: (!facingTouched && facingSuggestion) ? facingSuggestion.sentence : undefined,
          avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
          unitSubScores, verdictLabel,
        }),
      });
      if (!pdfRes.ok) throw new Error('pdf-failed');
      setProgress(100);

      const { mainHtml, galleryHtml } = await pdfRes.json();

      // The gallery (12 screenshots + per-image analysis) is its own blob
      // with its own URL. The main report links out to it via a
      // __GALLERY_URL__ placeholder that gets swapped for the real blob URL
      // here, once we know it -- this is what lets the main report stay
      // short (no images embedded) while still linking straight to them.
      const galleryBlob = new Blob([galleryHtml], { type: 'text/html' });
      const galleryUrl = URL.createObjectURL(galleryBlob);
      const finalMainHtml = mainHtml.replaceAll('__GALLERY_URL__', galleryUrl);

      const blob = new Blob([finalMainHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setReportUrl(url);
      setSavableData({
        mainHtml: finalMainHtml, galleryHtml,
        analysis, summary, address: addr, floor, facing,
        lat, lon, verdictLabel, combinedScore, unitScore, areaWeight, unitWeight,
        hasArea: !!areaRecord,
      });
    };

    try {
      try {
        await attemptOnce();
      } catch (firstErr) {
        // One silent retry before bothering the person with an error --
        // review found the report failing 3-4 times in a row, which looks
        // like a broken feature but is consistent with transient
        // platform/API blips rather than a hard failure every time.
        console.error('Report generation failed, retrying once:', firstErr);
        // A map that hasn't loaded will not have loaded 1.2 seconds
        // later, and each of those attempts costs a 20s wait before it
        // gives up. Retry the transient things; report the structural
        // ones straight away instead of doubling the person's wait for
        // an answer that cannot change.
        const m = String(firstErr?.message || '');
        if (m.startsWith('map-failed') || m === 'map-not-ready') throw firstErr;
        setProgress(5);
        setCaptured({ done: 0, total: 12 });
        await new Promise(r => setTimeout(r, 1200));
        await attemptOnce();
      }
    } catch (e) {
      console.error('Report generation failed after retry:', e);
      // The map failing to load is a different problem from the AI being
      // busy, and it needs a different response from the person -- "try
      // again in a minute" is useless advice for a blocked CDN. The
      // capture layer now reports which one it was, so say so.
      const msg = String(e?.message || '');
      setError(
        msg.startsWith('map-failed') || msg === 'map-not-ready'
          ? "The 3D map didn't load, so there was nothing to photograph for the report. That's usually a slow or blocked connection to the map provider, not a problem with your address. Go back to the flat, wait for the map to appear, then try again."
          : msg === 'no-frames-captured'
            ? "The map loaded but none of the frames came back, so there was nothing to build a report from. This is usually a temporary problem with the map tiles, please try again in a minute."
            : "Something went wrong generating your report. This sometimes happens when things are busy, please try again in a minute."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoGenerate) generate();
    // Mount-only -- floor/facing/prefill are fixed for this modal's
    // lifetime, and generate() itself isn't a stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The floor/facing/name FORM step is a short, deliberate input step, so
  // it stays a real full-screen blocking modal -- that's the one moment
  // where blocking is actually right. Once "Generate" is clicked (loading)
  // or the report is ready, this switches to a small non-blocking corner
  // card instead: no dark backdrop, doesn't cover the rest of the page,
  // and the person can keep using the site (e.g. the Furnishing tab)
  // while it finishes. Portalled to document.body so it also survives
  // sitting inside a display:none ancestor when a tab switch hides the
  // Unit/Verdict panel this component actually lives in underneath.
  const isFormStep = !loading && !autoGenerate && !reportUrl;

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
    if (!isFormStep || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isFormStep]);

  const overlayStyle = isFormStep
    ? { position:'fixed', inset:0, zIndex:1000, background:'rgba(10,5,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }
    : { position:'fixed', bottom:20, right:20, zIndex:1000, width:360, maxWidth:'calc(100vw - 40px)', pointerEvents:'none' };

  const cardStyle = isFormStep
    ? { background:'#FFFBF5', border:`1px solid ${LINE}`, padding:0, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 30px 90px rgba(0,0,0,0.35)', fontFamily:SANS }
    : { background:'#FFFBF5', border:`1px solid ${LINE}`, padding:0, width:'100%', maxHeight:'70vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.28)', borderRadius:8, fontFamily:SANS, pointerEvents:'auto' };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay" style={overlayStyle}>
      <div style={cardStyle}>
      <div className="modal-body" style={{ padding: isFormStep ? 24 : 18 }}>

        {!isFormStep && !reportUrl && (
          <div className="mono" style={{ fontSize:10, fontWeight:600, color:ORG, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>
            Report generating - feel free to keep browsing
          </div>
        )}

        {reportUrl ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:500, color:'#16a34a', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, border:'1px solid #16a34a', display:'inline-block', padding:'5px 14px' }}>Report Ready</div>
            <h3 style={{ fontFamily:DISPLAY, fontSize:18, fontWeight:800, color:INK, marginBottom:8 }}>Your report is ready</h3>
            <p style={{ fontSize:13, color:SUB, lineHeight:1.6, marginBottom:20 }}>Opens in a new tab.</p>
            {savableData && (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                <SaveReportButton
                  source="ai-report"
                  data={savableData}
                  defaultTitle={savableData.address}
                />
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              <button onClick={() => window.open(reportUrl, '_blank')} style={{ background:INK, color:'#fff', border:'none', padding:'13px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Open Report
              </button>
              <button onClick={onClose} style={{ background:'none', color:SUB, border:`1px solid ${LINE}`, borderTop:'none', padding:'12px', fontSize:12, cursor:'pointer', fontFamily:MONO, letterSpacing:'.05em', textTransform:'uppercase' }}>
                Close
              </button>
            </div>
          </div>
        ) : !loading && !autoGenerate ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:MONO, fontSize:10, fontWeight:500, color:ORG, letterSpacing:'.14em', marginBottom:6 }}>{areaRecord ? 'AI COMBINED REPORT' : 'AI SOLAR REPORT'}</div>
                <h2 className="modal-title" style={{ fontFamily:DISPLAY, fontSize:21, fontWeight:800, color:INK, margin:0 }}>Home Buyer Analysis</h2>
              </div>
              <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:SUB, lineHeight:1, padding:4 }}>✕</button>
            </div>

            <p style={{ fontSize:13, color:SUB, lineHeight:1.6, marginBottom:26 }}>
              {areaRecord
                ? `We combine your Neighbourhood Score for ${areaRecord.name || areaRecord.pin_code} with precise sun/shadow data for this exact unit - 12 real screenshots (3 per season) - then use AI to write one combined Home Buyer Verdict covering both. The report itself stays short and readable; the 12 images and their analysis sit in a linked gallery.`
                : 'We compute precise sun/shadow data for this exact location, capture 12 real screenshots (3 per season) at different times, then use AI to narrate the shadow patterns. The images and their analysis open in a linked gallery, keeping the main report short.'}
            </p>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Floor number</label>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <input type="range" min="0" max="30" value={floor} onChange={e => setFloor(e.target.value)} style={{ flex:1, accentColor:ORG }} />
                <div style={{ background:INK, color:'#fff', fontFamily:MONO, fontSize:13, fontWeight:500, padding:'4px 12px', minWidth:40, textAlign:'center' }}>{floor}</div>
              </div>
              <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, marginTop:6 }}>Floor {floor} ≈ {parseInt(floor)*3}m above ground</div>
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

            <div style={{ marginBottom:24 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Focus on anything specific? <span style={{ color:SUB, textTransform:'none', letterSpacing:0 }}>(optional)</span></label>
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
              <button onClick={generate} style={{ flex:1, background:ORG, color:'#fff', border:'none', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Generate AI Report
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, textAlign:'center', marginTop:12, letterSpacing:'.03em' }}>TAKES ~30 SECONDS · FREE · AI-POWERED</div>
          </>
        ) : error ? (
          // Only reachable via the autoGenerate path -- the manual form
          // above shows its own inline error and lets the person just hit
          // Generate again. Skipping that form on the auto-start path
          // means a failure here needs its own way out, or a stalled
          // progress bar would be a dead end with no visible cause.
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ border:'1px solid #dc2626', padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:20, fontFamily:MONO, textAlign:'left' }}>ERROR: {error}</div>
            <div style={{ display:'flex', gap:0 }}>
              <button onClick={generate} style={{ flex:1, background:ORG, color:'#fff', border:'none', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Try Again
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ marginBottom:20, animation:'rm-spin 1.6s linear infinite', display:'inline-block', color:ORG }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </div>
            <h3 style={{ fontFamily:DISPLAY, fontSize:17, fontWeight:800, color:INK, marginBottom:10 }}>Generating your report</h3>
            {/* Says which of the three phases is running, and counts the
                frames through the long one. One unchanging sentence for
                two minutes is why a working run and a stuck run looked
                identical. */}
            <p style={{ fontFamily:MONO, fontSize:11.5, color:SUB, lineHeight:1.8, marginBottom:20 }}>
              {step === 'capturing'
                ? `Photographing the sun and shadow through the year — frame ${Math.min(captured.done + 1, captured.total)} of ${captured.total}.`
                : step === 'analysing'
                  ? 'Frames captured. The AI is now reading them alongside the neighbourhood data.'
                  : 'Almost there, writing up your report.'}
            </p>
            <div style={{ background:'#EFEBE3', height:4, overflow:'hidden' }}>
              <div style={{ background:ORG, height:'100%', width:`${progress}%`, transition:'width 0.4s ease' }} />
            </div>
          </div>
        )}

        <style>{`
          @keyframes rm-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>
      </div>
      </div>
    </div>,
    document.body
  );
}
