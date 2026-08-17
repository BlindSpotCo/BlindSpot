'use client';
// components/property-score/SideDataStrip.js
// Thin live readouts fixed in the property-score flow's side gutters,
// visible only on genuinely wide viewports (see .ps-side-strip in
// globals.css, min-width:1700px) -- a widened 1400px content column
// plus the persona weights panel already close most of the empty-space
// gap on a normal 1440-1600px laptop, so this only shows where real
// margin is actually left over.
//
// Cycles real scored localities pulled from the same /api/av-localities
// endpoint LocalityPicker already calls -- same rule as the rest of
// AsliVastu: no invented copy standing in for real data, same idea as
// the homepage hero's rotating coordinate readout (app/page.js).

import { useEffect, useRef, useState } from 'react';

export default function SideDataStrip() {
  const [pool, setPool] = useState([]);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    fetch('/api/av-localities')
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(data => {
        const all = Object.values(data.cities || {}).flat();
        setPool(all);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pool.length < 2 || !leftRef.current || !rightRef.current) return;
    let i = Math.floor(Math.random() * pool.length);
    let j = (i + Math.floor(pool.length / 2)) % pool.length;

    const line = (r) => `${r.pin_code} · ${r.name} · ${r.nqi_composite}`;
    const paint = () => {
      leftRef.current.textContent = line(pool[i]);
      rightRef.current.textContent = line(pool[j]);
    };
    paint();

    const timer = setInterval(() => {
      i = (i + 1) % pool.length;
      j = (j + 1) % pool.length;
      leftRef.current.style.opacity = 0;
      rightRef.current.style.opacity = 0;
      setTimeout(() => {
        paint();
        leftRef.current.style.opacity = 1;
        rightRef.current.style.opacity = 1;
      }, 260);
    }, 3800);
    return () => clearInterval(timer);
  }, [pool]);

  if (!pool.length) return null;

  return (
    <>
      <div className="ps-side-strip ps-side-strip-left" aria-hidden="true">
        <span className="ps-side-strip-dot" />
        <span ref={leftRef} className="mono" />
      </div>
      <div className="ps-side-strip ps-side-strip-right" aria-hidden="true">
        <span className="ps-side-strip-dot" />
        <span ref={rightRef} className="mono" />
      </div>
    </>
  );
}
