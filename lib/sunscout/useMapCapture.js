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

import { useCallback, useEffect, useRef, useState } from 'react';

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
  // Surfaced so a screen can wait for the map before offering to
  // photograph it, instead of letting someone start a run that can only
  // end in "the map didn't load".
  const [ready, setReady] = useState(false);
  const captureRef = useRef(null);
  const pingRef = useRef(null);
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

  const onReady = useCallback((fn, ping) => {
    captureRef.current = fn;
    pingRef.current = ping || null;
  }, []);

  const onStatus = useCallback((status, reason) => {
    statusRef.current = status;
    setReady(status === 'ready');
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
    // If the map's onReady never reached this hook, nothing is wired and
    // every frame would time out in turn -- twelve twenty-second waits
    // that look like a slow map rather than a missing connection. Say so
    // in one second instead. (This is exactly how it broke once.)
    if (!captureRef.current) { finish(new Error('capture-not-wired')); return; }

    const startedAt = Date.now();
    const beginWhenReady = () => {
      if (!resolverRef.current) return; // cancelled
      if (statusRef.current === 'ready') { requestShot(0); return; }
      if (statusRef.current === 'failed') { finish(new Error('map-failed')); return; }
      // Ask the iframe directly rather than only waiting to overhear it.
      pingRef.current?.();
      // And after a short wait, try anyway. A handshake we never heard is
      // not evidence the map is missing -- it is only evidence we didn't
      // hear it, and refusing to photograph a map that is plainly on
      // screen is the worse failure of the two. If it really isn't there,
      // the per-frame watchdogs end the run with something true
      // ('no-frames-captured') instead of a guess made up front.
      if (Date.now() - startedAt > 6000) {
        console.warn('[useMapCapture] no ready notice heard; attempting the capture anyway');
        requestShot(0);
        return;
      }
      setTimeout(beginWhenReady, 250);
    };
    setTimeout(beginWhenReady, 300);
  }), [finish, requestShot]);

  // Ask the map whether it is up, until it says yes. The iframe announces
  // itself once on load; a parent that wasn't listening at that instant --
  // remounted, hot-reloaded, or simply mounted a tick late -- would
  // otherwise wait forever on a map that is plainly on screen, with the
  // report button disabled and no way to prove it wrong. The reply is
  // free: only a document whose script has run can answer at all.
  useEffect(() => {
    if (ready) return undefined;
    // Bounded: a map that hasn't answered in ~30s isn't going to, and a
    // timer that never stops is its own small leak.
    let left = 25;
    const id = setInterval(() => {
      if (left-- <= 0) { clearInterval(id); return; }
      pingRef.current?.();
    }, 1200);
    pingRef.current?.();
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => () => clearWatchdog(), []);

  return { captureScreenshots, onReady, onScreenshot, onStatus, ready };
}
