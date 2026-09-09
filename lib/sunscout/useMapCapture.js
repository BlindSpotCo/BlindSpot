'use client';

// lib/sunscout/useMapCapture.js
//
// The screenshot-capture run that report generation needs, lifted out of
// SunScoutPanel so any screen holding a Map3DShadow can drive it. It asks
// the iframe for twelve frames (3 per season, 9am/noon/3pm), one at a
// time, and resolves with whatever landed.
//
// Every guard here is a bug that was already found once, so read the
// comments before simplifying any of them. The important structural point
// is that FRAMES AND RUNS BOTH HAVE IDENTITY. The iframe answers with a
// label and nothing else, and this hook used to advance its counter on any
// reply at all, which meant:
//   - a frame arriving just after its own 20s watchdog had already given
//     up on it advanced the counter twice, skipping one frame entirely and
//     leaving two request chains racing each other through the same map;
//   - a reply from a run that had already been abandoned landed in the
//     next run's buffer, under a label that run never asked for.
// Both are silent: you get a report built from the wrong pictures. So a
// reply is now only accepted if it is the frame this run is actually
// waiting for.

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

const FRAME_TIMEOUT_MS = 20000;

export default function useMapCapture() {
  const captureRef = useRef(null);
  const pingRef = useRef(null);
  const statusRef = useRef('loading');
  const [ready, setReady] = useState(false);

  const runRef = useRef(0);        // which run is live; 0 means none
  const awaitingRef = useRef(-1);  // the frame index this run is waiting for
  const bufferRef = useRef([]);
  const doneRef = useRef(0);
  const resolverRef = useRef(null);
  const rejecterRef = useRef(null);
  const watchdogRef = useRef(null);
  const nextShotRef = useRef(null);
  const progressRef = useRef(null);
  const onShotRef = useRef(null);

  const clearTimers = () => {
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    if (nextShotRef.current) { clearTimeout(nextShotRef.current); nextShotRef.current = null; }
  };

  // Single exit point, so no path leaves the promise pending. Ending a run
  // also ends its identity: anything still in flight for it is ignored from
  // here on rather than leaking into whatever runs next.
  const finish = useCallback((err) => {
    clearTimers();
    runRef.current = 0;
    awaitingRef.current = -1;
    const resolve = resolverRef.current;
    const reject = rejecterRef.current;
    resolverRef.current = null;
    rejecterRef.current = null;
    if (!resolve && !reject) return;
    if (err) { reject?.(err); return; }
    resolve?.([...bufferRef.current]);
  }, []);

  const requestShot = useCallback((index, run) => {
    if (run !== runRef.current) return;   // this run is over
    const shot = SHOTS[index];
    if (!shot) return;
    clearTimers();
    awaitingRef.current = index;
    watchdogRef.current = setTimeout(() => {
      // Consume THIS frame, not "a" frame. If its real answer turns up
      // later it will find the slot already closed and be dropped.
      if (run !== runRef.current || awaitingRef.current !== index) return;
      console.warn(`[useMapCapture] "${shot.label}" (${index + 1}/${SHOTS.length}) timed out, skipping it`);
      onShotRef.current?.(shot.label, null, index);
    }, FRAME_TIMEOUT_MS);
    captureRef.current?.(shot.label, shot.time, shot.date);
  }, []);

  const onScreenshot = useCallback((label, data, forIndex) => {
    const run = runRef.current;
    if (!run || !resolverRef.current) return;    // no run in flight

    // The iframe replies with a label; the watchdog calls in with an index.
    // Either way the reply is only accepted for the frame we are actually
    // waiting on, and only once.
    const index = typeof forIndex === 'number' ? forIndex : awaitingRef.current;
    if (index < 0 || index !== awaitingRef.current) {
      console.warn(`[useMapCapture] ignoring a stale reply for "${label}" — this run is waiting for ${awaitingRef.current >= 0 ? SHOTS[awaitingRef.current]?.label : 'nothing'}`);
      return;
    }
    awaitingRef.current = -1;
    clearTimers();

    if (data) bufferRef.current.push({ label: SHOTS[index]?.label || label, base64: data });
    doneRef.current += 1;
    const done = doneRef.current;
    progressRef.current?.(done, SHOTS.length);

    if (done < SHOTS.length) {
      nextShotRef.current = setTimeout(() => requestShot(done, run), 350);
      return;
    }
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
    if (status !== 'failed') return;

    console.warn('[useMapCapture] the 3D map reported a failure:', reason);
    if (!rejecterRef.current) return;

    // A failure reported BEFORE any frame landed means the map never came
    // up, and there is nothing to photograph. A failure reported after some
    // frames are already in hand is a different thing entirely -- the map
    // is plainly working, something inside it threw once -- and throwing
    // away eight good frames over it, then telling the person their map
    // never loaded, was both wasteful and untrue. Let the run carry on; if
    // the map really is gone the per-frame watchdogs end it honestly.
    if (bufferRef.current.length > 0) {
      console.warn('[useMapCapture] ...but frames are already captured, so the run continues');
      return;
    }
    finish(new Error(`map-failed:${reason || 'unknown'}`));
  }, [finish]);

  const captureScreenshots = useCallback((onProgress) => new Promise((resolve, reject) => {
    // Two runs at once used to orphan the first promise forever: its
    // resolve was overwritten and nothing else held it, so the modal
    // waiting on it never returned, never cleared its spinner, and left a
    // beforeunload prompt armed. React Strict Mode's double-mount and a
    // double-click on "Try Again" both do this.
    if (resolverRef.current) { reject(new Error('capture-already-running')); return; }

    const run = runRef.current = Date.now();
    bufferRef.current = [];
    doneRef.current = 0;
    awaitingRef.current = -1;
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
      if (run !== runRef.current || !resolverRef.current) return; // cancelled
      if (statusRef.current === 'ready') { requestShot(0, run); return; }
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
        requestShot(0, run);
        return;
      }
      nextShotRef.current = setTimeout(beginWhenReady, 250);
    };
    nextShotRef.current = setTimeout(beginWhenReady, 300);
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

  // On unmount, settle whatever is pending. Clearing the timers alone left
  // the promise hanging and the caller's `finally` unreached.
  useEffect(() => () => {
    if (resolverRef.current || rejecterRef.current) finish(new Error('capture-cancelled'));
    else clearTimers();
  }, [finish]);

  return { captureScreenshots, onReady, onScreenshot, onStatus, ready };
}
