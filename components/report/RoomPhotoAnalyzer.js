'use client';
// components/report/RoomPhotoAnalyzer.js
//
// "Give me a photo of a room" -- next to the visit checklist. Asks for one
// extra thing besides the photo: which way the camera was facing, via the
// same compass control as the floor/facing gate (reuses its CSS classes on
// purpose, not a new control to learn). Without that bearing, nothing here
// can know which window is which, so the compass answer is required, not
// optional -- see app/api/sunscout/room-photo/analyse/route.js for why.
//
// Every arrow drawn on the photo comes back already computed server-side:
// this component only positions the labels the API returns, it never
// invents a direction or a sun figure of its own.

import { useState, useRef, useCallback } from 'react';

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

export default function RoomPhotoAnalyzer({ lat, lon, floor, tzOffset }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingDataUrl, setPendingDataUrl] = useState(null);
  const [bearingName, setBearingName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { windows, crossVentilation }
  const fileInputRef = useRef(null);

  const onFile = useCallback(async (file) => {
    if (!file) return;
    setResult(null);
    setError('');
    try {
      const { dataUrl } = await downscaleToDataUrl(file);
      setPendingDataUrl(dataUrl);
      setPreviewUrl(dataUrl);
    } catch {
      setError("Couldn't read that photo, try another one.");
    }
  }, []);

  const analyse = useCallback(async () => {
    if (!pendingDataUrl || !bearingName) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/sunscout/room-photo/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: pendingDataUrl,
          cameraBearing: FACING_DEG[bearingName],
          lat, lon, floor, tzOffset,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data) throw new Error('request-failed');
      if (data?.error === 'ai-unavailable') {
        setError("Photo analysis isn't configured on this deployment right now.");
      } else if (data?.error === 'detection-failed') {
        setError("Couldn't read that photo just now, please try again.");
      } else {
        setResult({ windows: data?.windows || [], crossVentilation: data?.crossVentilation ?? null });
      }
    } catch {
      setError('Something went wrong analysing that photo. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pendingDataUrl, bearingName, lat, lon, floor, tzOffset]);

  const reset = useCallback(() => {
    setPreviewUrl(null);
    setPendingDataUrl(null);
    setBearingName('');
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <section className="bsr-roomphoto">
      <h2>See it on your own photo</h2>
      <p className="bsr-roomphoto-lede">
        Add a photo of a room -- say which way you were facing when you took it, and we'll mark up
        the windows with real sun and heat data for that exact direction.
      </p>

      {!previewUrl && (
        <label className="bsr-roomphoto-drop">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            hidden
          />
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10.5" r="1.6" />
            <path d="M21 15.5l-5.5-5-8.5 8" />
          </svg>
          <span>Add a photo of a room</span>
        </label>
      )}

      {previewUrl && !result && (
        <div className="bsr-roomphoto-setup">
          <div className="bsr-roomphoto-preview">
            <img src={previewUrl} alt="Room to analyse" />
            <button type="button" className="bsr-roomphoto-change" onClick={reset}>Change photo</button>
          </div>

          <div className="bsr-roomphoto-bearing">
            <span>Which way were you facing when you took this?</span>
            {/* Same compass control as the floor/facing gate -- reused
                classes on purpose, not restyled, so it reads as the same
                control rather than a new thing to learn. */}
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
                    onClick={() => setBearingName(f)}
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
            onClick={analyse}
          >
            {loading ? 'Reading the photo…' : 'Mark up this photo'}
          </button>
        </div>
      )}

      {result && previewUrl && (
        <div className="bsr-roomphoto-result">
          <div className="bsr-roomphoto-preview bsr-roomphoto-preview--annotated">
            <img src={previewUrl} alt="Annotated room" />
            {result.windows.map((w, i) => {
              const left = w.bbox[0] * 100;
              const top = w.bbox[1] * 100;
              const width = (w.bbox[2] - w.bbox[0]) * 100;
              const height = (w.bbox[3] - w.bbox[1]) * 100;
              return (
                <div key={i} className="bsr-roomphoto-window" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
                  <span className="bsr-roomphoto-tag">
                    <strong>{w.direction}-facing window</strong>
                    <span>{w.sunLabel}</span>
                    {w.heatLabel && <span>{w.heatLabel}</span>}
                    {(w.buildingVisible || w.roadVisible) && (
                      <span className="bsr-roomphoto-impression">
                        {w.buildingVisible && w.roadVisible
                          ? 'Looks like a building and a road through this window'
                          : w.buildingVisible
                            ? 'Looks like a building close by through this window'
                            : 'Looks like a road through this window'}
                        {' '}(from the photo, not verified)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {result.windows.length === 0 ? (
            <p className="bsr-roomphoto-note">No window came through clearly in this photo -- try one taken facing straight at a window.</p>
          ) : (
            <>
              {result.crossVentilation !== null && (
                <p className="bsr-roomphoto-note">
                  {result.crossVentilation
                    ? 'These windows sit on different-enough walls for cross ventilation to be possible.'
                    : 'These windows are close to the same wall, so cross ventilation is unlikely from this room alone.'}
                </p>
              )}
              <p className="bsr-roomphoto-caveat">
                Sun and heat figures are computed for this floor and each window's own direction. Building/road mentions are a visual read of the photo, not checked against map data.
              </p>
            </>
          )}

          <button type="button" className="bsr-roomphoto-change" onClick={reset}>Try another photo</button>
        </div>
      )}
    </section>
  );
}
