'use client';
// components/sunscout/ReportModal.js
// Ported from SunScout's components/ReportModal.tsx. Two real changes from
// the original: (1) API paths point at BlindSpot's own /api/sunscout/*
// routes instead of SunScout's, (2) the "Save to BlindSpot" redirect flow
// is gone -- redundant now that this runs natively inside BlindSpot itself
// -- replaced with a direct onFloorFacingSubmit(floor, facing) callback so
// the combined-score page can reuse the same values without postMessage.

import { useState, useEffect, useRef } from 'react';

const FACING = ['North','South','East','West','North-East','South-East','North-West','South-West'];

const ORG = '#E07B00';
const INK = '#1A0A00';
const SUB = '#8A8A8A';
const LINE = 'rgba(26,10,0,0.15)';
const MONO = "'IBM Plex Mono', monospace";
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
  prefillFloor, prefillFacing,
}) {
  const [floor, setFloor]     = useState(prefillFloor != null ? String(prefillFloor) : '5');
  const [facing, setFacing]   = useState(prefillFacing || 'South');
  const [facingTouched, setFacingTouched] = useState(Boolean(prefillFacing));
  const facingTouchedRef = useRef(Boolean(prefillFacing));
  const [facingSuggestion, setFacingSuggestion] = useState(null);
  const [facingLoading, setFacingLoading] = useState(true);
  const [facingExpanded, setFacingExpanded] = useState(false);
  const [reportLabel, setReportLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]     = useState('');
  const [reportUrl, setReportUrl] = useState(null);

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

    if (onFloorFacingSubmit) onFloorFacingSubmit(parseInt(floor, 10), facing);

    try {
      const addr = address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

      const screenshots = await captureScreenshots();
      setProgress(35);

      const analyseRes = await fetch('/api/sunscout/report/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots, lat, lon, address: addr, floor, facing, tzOffset,
          avRecord: areaRecord || undefined, combinedScore, unitScore, areaWeight, unitWeight,
          personaId,
        }),
      });
      if (!analyseRes.ok) throw new Error('analysis-failed');
      const { analysis, summary } = await analyseRes.json();
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
    } catch (e) {
      console.error('Report generation failed:', e);
      setError("Something went wrong generating your report. This sometimes happens when things are busy — please try again in a minute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(10,5,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#FFFBF5', border:`1px solid ${LINE}`, padding:0, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 30px 90px rgba(0,0,0,0.35)', fontFamily:SANS }}>
      <div className="modal-body" style={{ padding:24 }}>

        {reportUrl ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:500, color:'#16a34a', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, border:'1px solid #16a34a', display:'inline-block', padding:'5px 14px' }}>Report Ready</div>
            <h3 style={{ fontFamily:DISPLAY, fontSize:18, fontWeight:800, color:INK, marginBottom:8 }}>Your report is ready</h3>
            <p style={{ fontSize:13, color:SUB, lineHeight:1.6, marginBottom:24 }}>Opens in a new tab.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              <button onClick={() => window.open(reportUrl, '_blank')} style={{ background:INK, color:'#fff', border:'none', padding:'13px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Open Report
              </button>
              <button onClick={onClose} style={{ background:'none', color:SUB, border:`1px solid ${LINE}`, borderTop:'none', padding:'12px', fontSize:12, cursor:'pointer', fontFamily:MONO, letterSpacing:'.05em', textTransform:'uppercase' }}>
                Close
              </button>
            </div>
          </div>
        ) : !loading ? (
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
                ? `We combine your Neighbourhood Score for ${areaRecord.name || areaRecord.pin_code} with precise sun/shadow data for this exact unit — 12 real screenshots (3 per season) — then use AI to write one combined Home Buyer Verdict covering both. The report itself stays short and readable; the 12 images and their analysis sit in a linked gallery.`
                : 'We compute precise sun/shadow data for this exact location, capture 12 real screenshots (3 per season) at different times, then use AI to narrate the shadow patterns. The images and their analysis open in a linked gallery, keeping the main report short.'}
            </p>

            <div style={{ marginBottom:22 }}>
              <label style={{ fontFamily:MONO, fontSize:10.5, fontWeight:500, color:INK, letterSpacing:'.08em', display:'block', marginBottom:10, textTransform:'uppercase' }}>Floor number</label>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <input type="range" min="1" max="30" value={floor} onChange={e => setFloor(e.target.value)} style={{ flex:1, accentColor:ORG }} />
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
                          {' '}— {facingTouched ? 'set by you' : facingSuggestion ? 'assumed from nearby buildings, unconfirmed' : 'default, unconfirmed'}
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
              <button onClick={generate} style={{ flex:1, background:ORG, color:'#fff', border:'none', padding:'14px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.03em', textTransform:'uppercase' }}>
                Generate AI Report
              </button>
              <button onClick={onClose} style={{ background:'transparent', color:SUB, border:`1px solid ${LINE}`, borderLeft:'none', padding:'14px 20px', fontSize:13, cursor:'pointer' }}>Cancel</button>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10.5, color:SUB, textAlign:'center', marginTop:12, letterSpacing:'.03em' }}>TAKES ~30 SECONDS · FREE · AI-POWERED</div>
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <div style={{ marginBottom:20, animation:'rm-spin 1.6s linear infinite', display:'inline-block', color:ORG }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </div>
            <h3 style={{ fontFamily:DISPLAY, fontSize:17, fontWeight:800, color:INK, marginBottom:10 }}>Generating your report</h3>
            <p style={{ fontFamily:MONO, fontSize:11.5, color:SUB, lineHeight:1.8, marginBottom:20 }}>This usually takes under a minute.</p>
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
    </div>
  );
}
