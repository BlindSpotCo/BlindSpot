'use client';

// lib/sunscout/useMapCapture.js
//
// The screenshot-capture run that report generation needs, lifted out of
// SunScoutPanel so any screen holding a Map3DShadow can drive it. It asks
// the iframe for twelve frames (3 per season, 9am/noon/3pm), one at a
// time, and resolves with whatever landed.
//
// Every guard from the original is kept, because each one is a bug that
// was already found once: a 20s watchdog per frame so a wedged tile fetch
// costs one frame instead of hanging the run; a single exit point so no
// path can leave the promise pending; a ready-poll before the first shot
// so a map that never loaded fails with a reason rather than a spinner;
// and a hard failure when every frame is missing, since the analysis step
// downstream would only write nonsense from an empty set.

import { useCallback, useEffect, useRef } from 'react';

export const SHOTS = [
  { label: 'Summer · 9am',   date: '2025-06-21', time: '09:00' },
  { label: 'Summer · Noon',  date: '2025-06-21', time: '12:00' },
  { label: 'Summer · 3pm',   date: '2025-06-21', time: '15:00' },
  { label: 'Winter · 9am',   date: '2025-12-21', time: '09:00' },
  { label: 'Winter · Noon',  date: '2025-12-21', time: '12:00' },
  { label: 'Winter · 3pm',   date: '2025-12-21', time: '15:00' },
  { label: 'Spring · 9am',   date: '2025-03-20', time: '09:00' },
  { label: 'Spring · Noon',  date: '2025-03-20', time: '12:00' },
  { label: 'Spring · 3pm',   date: '2025-03-20', time: '15:00' },
  { label: 'Autumn · 9am',   date: '2025-09-22', time: '09:00' },
  { label: 'Autumn · Noon',  date: '2025-09-22', time: '12:00' },
  { label: 'Autumn · 3pm',   date: '2025-09-22', time: '15:00' },
];

export default function useMapCapture() {
  const captureRef = useRef(null);
  const statusRef = useRef('loading');
  const bufferRef = useRef([]);
  const idxRef = useRef(0);
  const resolverRef = useRef(null);
  const rejecterRef = useRef(null);
  const watchdogRef = useRef(null);
  const progressRef = useRef(null);
  const onShotRef = useRef(null);

  const clearWatchdog = () => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
  };

  // Single exit point, so no path leaves the promise pending.
  const finish = useCallback((err) => {
    clearWatchdog();
    const resolve = resolverRef.current;
    const reject = rejecterRef.current;
    resolverRef.current = null;
    rejecterRef.current = null;
    if (!resolve && !reject) return;
    if (err) { reject?.(err); return; }
    resolve?.([...bufferRef.current]);
  }, []);

  const requestShot = useCallback((index) => {
    const shot = SHOTS[index];
    if (!shot) return;
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      if (!resolverRef.current) return;
      console.warn(`[useMapCapture] "${shot.label}" (${index + 1}/${SHOTS.length}) timed out, skipping it`);
      onShotRef.current?.(shot.label, null);
    }, 20000);
    captureRef.current?.(shot.label, shot.time, shot.date);
  }, []);

  const onScreenshot = useCallback((label, data) => {
    // A stray late message from an abandoned run would corrupt the next
    // one's buffer.
    if (!resolverRef.current) return;
    if (data) bufferRef.current.push({ label, base64: data });
    idxRef.current += 1;
    const done = idxRef.current;
    progressRef.current?.(done, SHOTS.length);
    if (done < SHOTS.length) {
      setTimeout(() => requestShot(done), 350);
      return;
    }
    clearWatchdog();
    if (bufferRef.current.length === 0) { finish(new Error('no-frames-captured')); return; }
    finish();
  }, [requestShot, finish]);

  useEffect(() => { onShotRef.current = onScreenshot; }, [onScreenshot]);

  const onReady = useCallback((fn) => { captureRef.current = fn; }, []);

  const onStatus = useCallback((status, reason) => {
    statusRef.current = status;
    if (status === 'failed') {
      console.warn('[useMapCapture] 3D map failed to initialise:', reason);
      if (rejecterRef.current) finish(new Error(`map-failed:${reason || 'unknown'}`));
    }
  }, [finish]);

  const captureScreenshots = useCallback((onProgress) => new Promise((resolve, reject) => {
    bufferRef.current = [];
    idxRef.current = 0;
    resolverRef.current = resolve;
    rejecterRef.current = reject;
    progressRef.current = onProgress || null;

    if (statusRef.current === 'failed') { finish(new Error('map-failed')); return; }

    const startedAt = Date.now();
    const beginWhenReady = () => {
      if (!resolverRef.current) return; // cancelled
      if (statusRef.current === 'ready') { requestShot(0); return; }
      if (statusRef.current === 'failed') { finish(new Error('map-failed')); return; }
      if (Date.now() - startedAt > 20000) {
        console.warn('[useMapCapture] 3D map never reported ready, aborting');
        finish(new Error('map-not-ready'));
        return;
      }
      setTimeout(beginWhenReady, 250);
    };
    setTimeout(beginWhenReady, 300);
  }), [finish, requestShot]);

  useEffect(() => () => clearWatchdog(), []);

  return { captureScreenshots, onReady, onScreenshot, onStatus };
}
