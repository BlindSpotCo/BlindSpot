'use client';
// components/trends/TrendChart.js
//
// Two sizes of the same single-series line:
//  - <Sparkline>: a tiny inline glance that sits in a score row and opens
//    the full chart. Shape only, no numbers.
//  - <TrendChart>: the full chart -- first/last labels, the high and low
//    called out, a reference line where one exists (India's PM2.5 limit),
//    and a hover/tap readout for any point.
//
// One series, one colour (the half's own accent passed in), so no legend:
// the caption names it. Text stays in ink colours, never the series colour.
// Past values only -- there is deliberately no extension of the line, no
// trend-fit, nothing that reads as a forecast.

import { useId, useMemo, useState } from 'react';
import { fmt } from '@/lib/trends/series';

function scale(points, w, h, pad, reference) {
  const vs = points.map((p) => p.v).filter(Number.isFinite);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (reference && Number.isFinite(reference.v)) { lo = Math.min(lo, reference.v); hi = Math.max(hi, reference.v); }
  // Small differences shouldn't fill the whole height and look dramatic;
  // pad the range by a quarter, and at least by a sliver of the level.
  const span = hi - lo;
  const padV = Math.max(span * 0.25, Math.abs(hi) * 0.03, 0.5);
  lo -= padV; hi += padV;
  if (Math.min(...vs) >= 0 && lo < 0) lo = 0;
  const n = points.length;
  const x = (i) => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i / (n - 1)) * (w - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  return { x, y };
}

const pathOf = (points, x, y) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

export function Sparkline({ series, color = 'currentColor', width = 64, height = 22 }) {
  const pts = series?.points || [];
  if (pts.length < 2) return null;
  const { x, y } = scale(pts, width, height, { l: 2, r: 4, t: 3, b: 3 });
  const last = pts.length - 1;
  return (
    <svg className="trend-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={pathOf(pts, x, y)} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(pts[last].v)} r="2.4" fill={color} />
    </svg>
  );
}

export function TrendChart({ series, color = '#AF5F30', height = 150 }) {
  const id = useId();
  const pts = useMemo(() => series?.points || [], [series]);
  const [active, setActive] = useState(null);
  if (pts.length < 2) return null;

  const W = 640, H = height;
  const pad = { l: 10, r: 10, t: 22, b: 24 };
  const { x, y } = scale(pts, W, H, pad, series.reference);
  const d = series.decimals ?? 0;
  const unit = series.unit === '%' || series.unit?.startsWith('°') ? series.unit : ` ${series.unit}`;
  const last = pts.length - 1;
  let hi = 0, lo = 0;
  pts.forEach((p, i) => { if (p.v > pts[hi].v) hi = i; if (p.v < pts[lo].v) lo = i; });
  // Label: last point always; high and low when they're not the last one
  // and not crowding each other.
  const labelled = new Set([last]);
  if (last - hi > 1) labelled.add(hi);
  if (last - lo > 1 && Math.abs(lo - hi) > 1) labelled.add(lo);
  // Year axis: first and last only (and the middle on long monthly runs).
  const ticks = pts.length > 14 ? [0, Math.floor(last / 2), last] : [0, last];

  const pickFrom = (clientX, el) => {
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const dd = Math.abs(x(i) - sx); if (dd < bd) { bd = dd; best = i; } }
    setActive(best);
  };

  const a = active != null ? pts[active] : null;
  const ref = series.reference;

  return (
    <figure className="trend-chart">
      <figcaption id={`${id}-cap`} className="trend-cap">{series.caption}</figcaption>
      <div className="trend-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${id}-cap`}
          aria-describedby={`${id}-sum`}
          onPointerMove={(e) => pickFrom(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pickFrom(e.clientX, e.currentTarget)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
        >
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="trend-axis" />
          {ref && Number.isFinite(ref.v) && (
            <line x1={pad.l} x2={W - pad.r} y1={y(ref.v)} y2={y(ref.v)} className="trend-ref" />
          )}
          <path d={pathOf(pts, x, y)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {a && <line x1={x(active)} x2={x(active)} y1={pad.t - 6} y2={H - pad.b} className="trend-cross" />}
        </svg>
        {/* Dots and text sit in HTML over the SVG, so they keep their shape
            and size when the chart stretches to the column width. */}
        {pts.map((p, i) => (labelled.has(i) || i === active) ? (
          <span
            key={`d${i}`}
            className={`trend-dot${i === active ? ' is-active' : ''}`}
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.v) / H) * 100}%`, background: color }}
          />
        ) : null)}
        {[...labelled].filter((i) => i !== active).map((i) => (
          <span
            key={`l${i}`}
            className={`trend-val${i === last ? ' is-last' : i === 0 ? ' is-first' : ''}`}
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(pts[i].v) / H) * 100}%` }}
          >
            {fmt(pts[i].v, d)}
          </span>
        ))}
        {a && (
          <span className={`trend-tip${active > last * 0.7 ? ' is-left' : active < last * 0.3 ? ' is-right' : ''}`} style={{ left: `${(x(active) / W) * 100}%` }}>
            <strong>{fmt(a.v, d)}{unit}</strong> {a.x}
          </span>
        )}
        {ref && Number.isFinite(ref.v) && (
          <span className="trend-ref-label" style={{ top: `${(y(ref.v) / H) * 100}%` }}>{ref.label}</span>
        )}
        {ticks.map((i) => (
          <span key={`t${i}`} className={`trend-tick${i === 0 ? ' is-first' : i === last ? ' is-last' : ''}`} style={{ left: `${(x(i) / W) * 100}%` }}>{pts[i].x}</span>
        ))}
      </div>
      <div id={`${id}-sum`} className="trend-words">
        {series.summary && <p>{series.summary}</p>}
        {series.detail && <p className="trend-detail">{series.detail}</p>}
        <p className="trend-src">{series.source}. {series.note}</p>
      </div>
      {/* The same numbers as a table, for screen readers. */}
      <table className="trend-sr">
        <caption>{series.caption}</caption>
        <tbody>{pts.map((p) => <tr key={p.x}><th scope="row">{p.x}</th><td>{fmt(p.v, d)}{unit}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
