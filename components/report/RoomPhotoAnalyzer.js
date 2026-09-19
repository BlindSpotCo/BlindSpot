'use client';
// components/report/RoomPhotoAnalyzer.js
//
// "Give me a photo of a room" -- next to the visit checklist. Add as many
// room photos as you want (capped at MAX_PHOTOS so one report doesn't turn
// into an unbounded pile of Gemini calls); each one asks for the one thing
// it actually needs besides the photo -- which way the camera was facing --
// via the same compass control as the floor/facing gate.
//
// Every number drawn on a photo comes back already computed server-side
// (see app/api/sunscout/room-photo/analyse/route.js): this component's own
// job is purely presentational -- draw a yellow arrow where the API says
// sunlight comes in, a blue arrow where it says air moves, and spell the
// rest out as real, readable text underneath rather than tiny labels
// crammed onto the photo itself.

import { useState, useRef, useCallback, useId } from 'react';

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
const MAX_PREVIEW_W = 640;
const MAX_PHOTOS = 4;

const SUN_COLOR = '#F2A93B';
const AIR_COLOR = '#3B82C4';

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

// A short, fixed-length arrow anchored at (xPct, yPct) inside the preview
// box, rotated to point wherever `angleDeg` says. Angle is computed from
// the ORIGINAL photo's pixel dimensions (not the 0-100 viewBox), so it
// stays visually correct regardless of the photo's own aspect ratio --
// see angleInto() below.
function Arrow({ xPct, yPct, angleDeg, color, length, dashed }) {
  const w = length, h = 16;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', left: `${xPct}%`, top: `${yPct}%`,
        width: `${w}px`, height: 0, transformOrigin: '2px 50%',
        transform: `rotate(${angleDeg}deg)`, pointerEvents: 'none',
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: -h / 2, overflow: 'visible' }}>
        <line
          x1={2} y1={h / 2} x2={w - 9} y2={h / 2}
          stroke={color} strokeWidth={3.2} strokeLinecap="round"
          strokeDasharray={dashed ? '1,5' : undefined}
          style={{ filter: `drop-shadow(0 0 2px rgba(0,0,0,.45))` }}
        />
        <polygon points={`${w - 12},${h / 2 - 5} ${w - 1},${h / 2} ${w - 12},${h / 2 + 5}`} fill={color}
          style={{ filter: `drop-shadow(0 0 2px rgba(0,0,0,.45))` }} />
      </svg>
    </div>
  );
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

function PhotoCard({ photo, onBearing, onAnalyse, onChange, onRemove, canRemove, index }) {
  const inputId = useId();
  const { previewUrl, width, height, bearingName, loading, error, result } = photo;

  // Cap the preview box's WIDTH so, given the photo's real aspect ratio,
  // its displayed height never exceeds MAX_PREVIEW_H -- see the comment
  // on MAX_PREVIEW_H above for why this beats capping height directly.
  const aspect = width && height ? width / height : 4 / 3;
  const boxW = Math.min(MAX_PREVIEW_W, aspect * MAX_PREVIEW_H);
  const boxStyle = previewUrl ? { maxWidth: `${Math.round(boxW)}px` } : undefined;

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

          <div className="bsr-roomphoto-preview bsr-roomphoto-preview--annotated" style={boxStyle}>
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
                  {sunny && <Arrow xPct={cx} yPct={cy} angleDeg={angle} color={SUN_COLOR} length={54} />}
                  <Arrow xPct={cx} yPct={cy} angleDeg={angle + 16} color={AIR_COLOR} length={38} dashed />
                  <span className="bsr-roomphoto-badge" style={{ left: `${w.bbox[0] * 100}%`, top: `${w.bbox[1] * 100}%` }}>
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {result.windows.length === 0 ? (
            <p className="bsr-roomphoto-note">No window came through clearly in this photo — try one taken facing straight at a window.</p>
          ) : (
            <>
              <ul className="bsr-roomphoto-list">
                {result.windows.map((w, i) => (
                  <li key={i}>
                    <span className="bsr-roomphoto-list-badge">{i + 1}</span>
                    <div>
                      <p className="bsr-roomphoto-list-head">{w.direction}-facing window</p>
                      <p>{w.sunLabel}{w.heatLabel ? ` · ${w.heatLabel}` : ''}</p>
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

              {result.crossVentilation !== null && (
                <p className="bsr-roomphoto-note">
                  {result.crossVentilation
                    ? 'These windows sit on different-enough walls for cross ventilation to be possible.'
                    : 'These windows are close to the same wall, so cross ventilation is unlikely from this room alone.'}
                </p>
              )}
              <p className="bsr-roomphoto-caveat">
                Sun and heat figures are computed for this floor and each window's own direction. Arrows are illustrative, not to exact scale. Building/road mentions are a visual read of the photo, not checked against map data.
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
        Add photos of any rooms — say which way you were facing in each one, and we'll draw where the sun
        comes in and where the air moves, with real sun and heat data for each window's own direction.
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
      </div>

      {canAddMore && (
        <button type="button" className="bsr-roomphoto-add" onClick={() => setPhotos((prev) => [...prev, emptyPhoto()])}>
          + Add another photo ({photos.length}/{MAX_PHOTOS})
        </button>
      )}
    </section>
  );
}
