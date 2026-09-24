'use client';
// components/report/RoomPhotoAnalyzer.js
//
// "Give me a photo of a room" -- next to the visit checklist. Add as many
// room photos as you want (capped at MAX_PHOTOS so one report doesn't turn
// into an unbounded pile of Gemini calls); each one asks for the one thing
// it actually needs besides the photo -- which way the camera was facing --
// via the same compass control as the floor/facing gate. Multiple photos
// sit in a row (a real grid, not one stacked under the next) so comparing
// a couple of rooms doesn't turn into an endless scroll.
//
// Every number drawn on a photo comes back already computed server-side
// (see app/api/sunscout/room-photo/analyse/route.js): this component's own
// job is purely presentational -- a bold yellow arrow + label where the
// API says sunlight comes in, a blue one where it says air moves. The
// label carries the headline (direction, sun verdict) right on the photo;
// a plain-text list underneath carries the rest (heat, ventilation, the
// building/road caveat) for anyone who wants the full readout.

import { useState, useRef, useEffect, useCallback, useId } from 'react';

const FACING_DEG = {
  North: 0, 'North-East': 45, East: 90, 'South-East': 135,
  South: 180, 'South-West': 225, West: 270, 'North-West': 315,
};
const FACING_SHORT = {
  North: 'N', 'North-East': 'NE', East: 'E', 'South-East': 'SE',
  South: 'S', 'South-West': 'SW', West: 'W', 'North-West': 'NW',
};
const FACING_OPTS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

// Mobile photos can land at several thousand pixels wide -- sending that
// straight to Gemini is slow and mostly wasted (window edges don't need
// 4000px to be findable), and a big base64 payload is the more likely way
// this request times out. Downscale to something generous but sane before
// it ever leaves the browser.
const MAX_DIM = 1280;
// A phone's own camera photo is usually a tall 3:4 or 9:16 -- rendered at
// full container width with plain `height:auto` that used to run to 700px+
// and swallow the whole screen. Capping the PREVIEW BOX's width (not its
// height directly) to whatever keeps its height under this, using the
// photo's own aspect ratio, keeps the image filling its box exactly --
// which matters because the arrow/badge overlay math below assumes the
// displayed image is a uniform scale of the original, with no letterboxing.
const MAX_PREVIEW_H = 420;
const MAX_PREVIEW_W = 420;
const MAX_PHOTOS = 4;

const SUN_COLOR = '#F5A623';
const SUN_DARK = '#B9760A';
const AIR_COLOR = '#2F86EB';
const AIR_DARK = '#1E5FA8';

function downscaleToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
    img.src = url;
  });
}

let nextPhotoId = 1;
function emptyPhoto() {
  return {
    id: nextPhotoId++,
    previewUrl: null, dataUrl: null, width: 0, height: 0,
    bearingName: '', loading: false, error: '', result: null,
  };
}

// Angle (degrees) from a window's bbox centre toward the middle of the
// frame, computed in the photo's real pixel space so it isn't skewed by
// non-square aspect ratios -- a 9:16 phone photo and a 4:3 one both point
// their arrows the same visually-correct way.
function angleInto(bbox, width, height) {
  const cx = ((bbox[0] + bbox[2]) / 2) * (width || 1);
  const cy = ((bbox[1] + bbox[3]) / 2) * (height || 1);
  const dx = (width || 1) / 2 - cx;
  const dy = (height || 1) / 2 - cy;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function getsSun(w) {
  return !/little direct sun/i.test(w.sunLabel || '');
}

const DIR_LONG = {
  N: 'north', NE: 'north-east', E: 'east', SE: 'south-east',
  S: 'south', SW: 'south-west', W: 'west', NW: 'north-west',
};

// Same 3-tone system the main report's .bsr-word/.bsr-tag already use --
// Excellent/Good collapse to one tone, Marginal is the middle tone, Not
// Recommended is the bottom one, matching how the main report's own
// toneOf(score) collapses its 4-word scale into 3 colors.
function toneFor(verdict) {
  if (verdict === 'Excellent' || verdict === 'Good') return 'good';
  if (verdict === 'Marginal') return 'avg';
  if (verdict === 'Not Recommended') return 'poor';
  return 'none';
}

function monthRange(months) {
  if (!months || !months.length) return null;
  return months.length === 1 ? months[0] : `${months[0]}–${months[months.length - 1]}`;
}

// One-line synthesis across every window in this photo, built entirely
// from fields the API already returns per window -- no new estimate,
// just picking the best window's verdict and stitching real facts into
// a sentence, the same way headlineFor()/verdictSay() build sentences
// from real scores elsewhere in the report.
function roomSummaryFor(windows, crossVentilation) {
  const withVerdict = windows.filter((w) => w.verdict);
  if (!withVerdict.length) return null;

  const RANK = { Excellent: 3, Good: 2, Marginal: 1, 'Not Recommended': 0 };
  const best = [...withVerdict].sort((a, b) => (RANK[b.verdict] ?? -1) - (RANK[a.verdict] ?? -1))[0];
  const tone = toneFor(best.verdict);
  const word = best.verdict === 'Not Recommended' ? 'Poor' : best.verdict;

  const dirs = [...new Set(windows.map((w) => DIR_LONG[w.direction] || w.direction))];
  const dirList = dirs.length === 1
    ? `${dirs[0]}-facing`
    : dirs.length === 2
      ? `${dirs[0]} and ${dirs[1]}-facing`
      : `${dirs.slice(0, -1).join(', ')}, and ${dirs[dirs.length - 1]}-facing`;

  const lightPart = tone === 'good'
    ? 'this room gets strong, consistent light most of the year'
    : tone === 'avg'
      ? 'this room gets workable light for part of the year'
      : 'this room gets little direct sun most of the year';

  const runsHot = windows.some((w) => w.heatLabel === 'Can run hot, Apr–Jun afternoons');

  let line = `With ${dirList} windows, ${lightPart}${runsHot ? ', though it can run hot on April–June afternoons' : ''}.`;

  if (crossVentilation !== null) {
    line += crossVentilation
      ? ' These windows sit on different-enough walls for cross ventilation to be possible.'
      : ' Windows sit close to the same wall, so cross ventilation is unlikely from this room alone.';
  }

  return { word, tone, line };
}

// A bold, chunky arrow anchored at (xPct, yPct), rotated to `angleDeg`,
// sized off the box's own measured pixel width (`boxPx`) so it reads at
// the same visual weight whether the photo is a small phone screenshot or
// a big desktop preview -- a fixed pixel length looked lost on a wide
// photo and oversized on a small one.
function Arrow({ xPct, yPct, angleDeg, color, dark, boxPx, kind }) {
  const len = Math.round(Math.max(46, Math.min(150, boxPx * 0.24)));
  const sw = Math.max(4, Math.min(9, boxPx * 0.016));
  const headH = sw * 2.6;
  const w = len, h = headH + 4;
  const dashed = kind === 'air';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
        width: `${w}px`, height: 0, transformOrigin: '3px 50%',
        transform: `rotate(${angleDeg}deg)`, pointerEvents: 'none', zIndex: 3,
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: -h / 2, overflow: 'visible' }}>
        <line
          x1={3} y1={h / 2} x2={w - headH + 2} y2={h / 2}
          stroke={dark} strokeWidth={sw + 3} strokeLinecap="round"
          strokeDasharray={dashed ? `${sw},${sw * 2.1}` : undefined}
          opacity={0.55}
        />
        <line
          x1={3} y1={h / 2} x2={w - headH + 2} y2={h / 2}
          stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={dashed ? `${sw * 1.1},${sw * 1.9}` : undefined}
        />
        <polygon
          points={`${w - headH},${h / 2 - headH * 0.62} ${w},${h / 2} ${w - headH},${h / 2 + headH * 0.62}`}
          fill={color} stroke={dark} strokeWidth={1.5} strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// The label that actually lives ON the photo: direction + the headline
// verdict, big enough to read at a glance. Anchored at the window's own
// edge, flipped to the opposite side of the frame from where the arrow
// points so the two never sit on top of each other.
function OnPhotoLabel({ w, bbox, boxPx, sunny, index }) {
  const cx = (bbox[0] + bbox[2]) / 2;
  const fromRight = cx > 0.5;
  // Anchored just INSIDE the window's own top-left (or top-right) corner,
  // not floating above the bbox -- floating above it clips against the
  // photo's own rounded-corner mask whenever a window sits near the top
  // of the frame, which is common (most windows start well above centre).
  const fs = Math.max(11.5, Math.min(15, boxPx * 0.032));
  return (
    <div
      className={`bsr-roomphoto-onlabel${fromRight ? ' is-right' : ' is-left'}`}
      style={{
        top: `${bbox[1] * 100}%`,
        [fromRight ? 'right' : 'left']: `${(fromRight ? (1 - bbox[2]) : bbox[0]) * 100}%`,
        fontSize: `${fs}px`,
        borderColor: sunny ? SUN_COLOR : AIR_COLOR,
      }}
    >
      <span className="bsr-roomphoto-onlabel-n">{index + 1}</span>
      <strong>{w.direction}</strong>
      <span>{sunny ? 'Sun' : 'Shade'}</span>
    </div>
  );
}

function PhotoCard({ photo, onBearing, onAnalyse, onChange, onRemove, canRemove, index }) {
  const inputId = useId();
  const previewRef = useRef(null);
  const [boxPx, setBoxPx] = useState(320);
  const { previewUrl, width, height, bearingName, loading, error, result } = photo;

  // Cap the preview box's WIDTH so, given the photo's real aspect ratio,
  // its displayed height never exceeds MAX_PREVIEW_H -- see the comment
  // on MAX_PREVIEW_H above for why this beats capping height directly.
  const aspect = width && height ? width / height : 4 / 3;
  const boxW = Math.min(MAX_PREVIEW_W, aspect * MAX_PREVIEW_H);
  const boxStyle = previewUrl ? { maxWidth: `${Math.round(boxW)}px` } : undefined;

  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setBoxPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewUrl, result]);

  return (
    <div className="bsr-roomphoto-card">
      {!previewUrl && (
        <label className="bsr-roomphoto-drop" htmlFor={inputId}>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files?.[0])}
            hidden
          />
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10.5" r="1.6" />
            <path d="M21 15.5l-5.5-5-8.5 8" />
          </svg>
          <span>{index === 0 ? 'Add a photo of a room' : 'Add another photo'}</span>
        </label>
      )}

      {previewUrl && !result && (
        <div className="bsr-roomphoto-setup">
          <div className="bsr-roomphoto-preview" style={boxStyle}>
            <img src={previewUrl} alt="Room to analyse" />
            {canRemove && (
              <button type="button" className="bsr-roomphoto-remove" onClick={onRemove} aria-label="Remove this photo">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>

          <div className="bsr-roomphoto-bearing">
            <span>Which way were you facing when you took this?</span>
            <div className="bsr-unitgate-compass" role="radiogroup" aria-label="Camera facing direction">
              {FACING_OPTS.map((f) => {
                const short = FACING_SHORT[f];
                const isCardinal = short.length === 1;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={f === bearingName}
                    className={`bsr-unitgate-chip bsr-unitgate-chip--${short.toLowerCase()}${isCardinal ? ' is-cardinal' : ''}${f === bearingName ? ' on' : ''}`}
                    onClick={() => onBearing(f)}
                  >
                    {short}
                  </button>
                );
              })}
              <div className="bsr-unitgate-compass-center" aria-hidden="true">
                {bearingName ? FACING_SHORT[bearingName] : '·'}
              </div>
            </div>
          </div>

          {error && <p className="bsr-roomphoto-error">{error}</p>}

          <button
            type="button"
            className="bsr-roomphoto-go"
            disabled={!bearingName || loading}
            onClick={onAnalyse}
          >
            {loading ? 'Reading the photo…' : 'Mark up this photo'}
          </button>
        </div>
      )}

      {result && previewUrl && (
        <div className="bsr-roomphoto-result">
          {(result.windows.length > 0) && (
            <div className="bsr-roomphoto-legend">
              <span><i style={{ background: SUN_COLOR }} /> Sunlight entering</span>
              <span><i style={{ background: AIR_COLOR }} /> Airflow</span>
            </div>
          )}

          <div className="bsr-roomphoto-preview bsr-roomphoto-preview--annotated" style={boxStyle} ref={previewRef}>
            <img src={previewUrl} alt="Annotated room" />
            {result.windows.map((w, i) => {
              const cx = ((w.bbox[0] + w.bbox[2]) / 2) * 100;
              const cy = ((w.bbox[1] + w.bbox[3]) / 2) * 100;
              const angle = angleInto(w.bbox, width, height);
              const sunny = getsSun(w);
              return (
                <div key={i}>
                  <div
                    className="bsr-roomphoto-window"
                    style={{
                      left: `${w.bbox[0] * 100}%`, top: `${w.bbox[1] * 100}%`,
                      width: `${(w.bbox[2] - w.bbox[0]) * 100}%`, height: `${(w.bbox[3] - w.bbox[1]) * 100}%`,
                    }}
                  />
                  {sunny && <Arrow xPct={cx} yPct={cy} angleDeg={angle - 10} color={SUN_COLOR} dark={SUN_DARK} boxPx={boxPx} kind="sun" />}
                  <Arrow xPct={cx} yPct={cy} angleDeg={angle + 26} color={AIR_COLOR} dark={AIR_DARK} boxPx={boxPx} kind="air" />
                  <OnPhotoLabel w={w} bbox={w.bbox} boxPx={boxPx} sunny={sunny} index={i} />
                </div>
              );
            })}
          </div>

          {(() => {
            const summary = roomSummaryFor(result.windows, result.crossVentilation);
            return summary ? (
              <div className={`bsr-roomphoto-roomverdict is-${summary.tone}`}>
                <div className={`bsr-word bsr-roomphoto-roomverdict-word is-${summary.tone}`}>{summary.word}</div>
                <div className="bsr-roomphoto-roomverdict-body">
                  <span className="bsr-roomphoto-roomverdict-label">This room, overall</span>
                  <p className="bsr-roomphoto-roomverdict-line">{summary.line}</p>
                </div>
              </div>
            ) : null;
          })()}

          {result.windows.length === 0 ? (
            <p className="bsr-roomphoto-note">No window came through clearly in this photo — try one taken facing straight at a window.</p>
          ) : (
            <>
              <ul className="bsr-roomphoto-list">
                {result.windows.map((w, i) => (
                  <li key={i}>
                    <span className="bsr-roomphoto-list-badge">{i + 1}</span>
                    <div className="bsr-roomphoto-list-body">
                      <div className="bsr-roomphoto-list-headrow">
                        <p className="bsr-roomphoto-list-head">{w.direction}-facing window</p>
                        {w.verdict && (
                          <span className={`bsr-tag is-${toneFor(w.verdict)}`}>
                            {w.verdict === 'Not Recommended' ? 'Poor' : w.verdict}
                          </span>
                        )}
                      </div>

                      {w.avgUsableHours != null && (
                        <p className="bsr-roomphoto-stats">
                          <span>{w.avgUsableHours} hrs/day avg</span>
                          {monthRange(w.bestMonths) && <><span className="mut"> · </span><span>best {monthRange(w.bestMonths)}</span></>}
                          {w.peakWindow && <><span className="mut"> · </span><span>brightest {w.peakWindow}</span></>}
                        </p>
                      )}

                      {(monthRange(w.worstMonths) || w.heatLabel) && (
                        <p className="bsr-roomphoto-worst">
                          {monthRange(w.worstMonths) && <>Least light: <b>{monthRange(w.worstMonths)}</b></>}
                          {monthRange(w.worstMonths) && w.heatLabel ? ' · ' : ''}
                          {w.heatLabel}
                        </p>
                      )}

                      {(w.buildingVisible || w.roadVisible) && (
                        <p className="bsr-roomphoto-impression">
                          {w.buildingVisible && w.roadVisible
                            ? 'Looks like a building and a road through this window'
                            : w.buildingVisible
                              ? 'Looks like a building close by through this window'
                              : 'Looks like a road through this window'}
                          {' '}(from the photo, not verified)
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="bsr-roomphoto-caveat">
                Sun and heat figures are computed for this floor and each window&apos;s own direction. Arrows are illustrative, not to exact scale. Building/road mentions are a visual read of the photo, not checked against map data.
              </p>
            </>
          )}

          <button type="button" className="bsr-roomphoto-change" onClick={() => onChange(null)}>
            Try another photo
          </button>
        </div>
      )}
    </div>
  );
}

export default function RoomPhotoAnalyzer({ lat, lon, floor, tzOffset }) {
  const [photos, setPhotos] = useState([emptyPhoto()]);

  const updatePhoto = useCallback((id, patch) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));
  }, []);

  const onFile = useCallback(async (id, file) => {
    if (!file) return;
    updatePhoto(id, { error: '', result: null });
    try {
      const { dataUrl, width, height } = await downscaleToDataUrl(file);
      updatePhoto(id, { previewUrl: dataUrl, dataUrl, width, height });
    } catch {
      updatePhoto(id, { error: "Couldn't read that photo, try another one." });
    }
  }, [updatePhoto]);

  const onReset = useCallback((id) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? emptyPhoto() : p)));
  }, []);

  const onRemove = useCallback((id) => {
    setPhotos((prev) => (prev.length <= 1 ? [emptyPhoto()] : prev.filter((p) => p.id !== id)));
  }, []);

  // Takes the full photo object (not just its id) -- reading fresh state
  // back out of a setPhotos() updater as an escape hatch isn't guaranteed
  // to run synchronously, so that used to silently bail with an undefined
  // `target` and never fire the request at all. The caller already has
  // the photo in scope, so there's no need to re-read state here.
  const analyse = useCallback(async (photo) => {
    const { id, dataUrl, bearingName } = photo;
    if (!dataUrl || !bearingName) return;
    updatePhoto(id, { loading: true, error: '', result: null });
    try {
      const res = await fetch('/api/sunscout/room-photo/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          cameraBearing: FACING_DEG[bearingName],
          lat, lon, floor, tzOffset,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data) throw new Error('request-failed');
      if (data?.error === 'ai-unavailable') {
        updatePhoto(id, { error: "Photo analysis isn't configured on this deployment right now." });
      } else if (data?.error === 'detection-failed') {
        updatePhoto(id, { error: "Couldn't read that photo just now, please try again." });
      } else {
        updatePhoto(id, { result: { windows: data?.windows || [], crossVentilation: data?.crossVentilation ?? null } });
      }
    } catch {
      updatePhoto(id, { error: 'Something went wrong analysing that photo. Please try again.' });
    } finally {
      updatePhoto(id, { loading: false });
    }
  }, [updatePhoto, lat, lon, floor, tzOffset]);

  const canAddMore = photos.length < MAX_PHOTOS && photos[photos.length - 1]?.result;

  return (
    <section className="bsr-roomphoto">
      <h2>See it on your own photo</h2>
      <p className="bsr-roomphoto-lede">
        Add photos of any rooms — say which way you were facing in each one, and we&apos;ll draw where the sun
        comes in and where the air moves, with real sun and heat data for each window&apos;s own direction.
      </p>

      <div className="bsr-roomphoto-cards">
        {photos.map((photo, i) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            index={i}
            canRemove={photos.length > 1 || Boolean(photo.previewUrl)}
            onBearing={(f) => updatePhoto(photo.id, { bearingName: f })}
            onAnalyse={() => analyse(photo)}
            onChange={(file) => (file ? onFile(photo.id, file) : onReset(photo.id))}
            onRemove={() => onRemove(photo.id)}
          />
        ))}

        {canAddMore && (
          <button type="button" className="bsr-roomphoto-addcard" onClick={() => setPhotos((prev) => [...prev, emptyPhoto()])}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span>Add another photo<br />({photos.length}/{MAX_PHOTOS})</span>
          </button>
        )}
      </div>
    </section>
  );
}
