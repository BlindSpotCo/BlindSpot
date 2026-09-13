'use client';
// components/compare/SunStrip.js
//
// Two charts, both answering "how does the light change through the year",
// at two different jobs.
//
// SunStrip is one property's twelve months as bars -- magnitude over time,
// one series, so it needs no legend: the card it sits in names it. It lives
// inside the property card because the shape of a year is the thing people
// recognise instantly ("this place dies in December") long before they read
// an average.
//
// SunLines overlays every property on one scale -- that is a comparison of
// change over time, which is a line's job, not a bar's. Series are direct-
// labelled at the right edge as well as coloured, because colour alone is
// never allowed to carry identity.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D'];

const hoursOf = (monthly, name) => {
  const m = monthly?.find((x) => x.month === name);
  const v = m ? Number(m.usableHours) : NaN;
  return Number.isFinite(v) ? v : null;
};

export function SunStrip({ monthly, color, max = 8 }) {
  if (!Array.isArray(monthly) || !monthly.length) return null;
  const rated = MONTHS.map((m) => ({ month: m.slice(0, 3), v: hoursOf(monthly, m) })).filter((x) => x.v != null);
  if (!rated.length) return null;
  const peak = rated.reduce((a, c) => (c.v > a.v ? c : a));
  const trough = rated.reduce((a, c) => (c.v < a.v ? c : a));
  const W = 168, H = 42, n = 12;
  const slot = W / n, bw = slot - 2;            // 2px surface gap between bars

  return (
    <div className="sun-strip">
      <svg viewBox={`0 0 ${W} ${H + 11}`} width="100%" height="53" role="img"
           aria-label={`Direct sun by month: best ${peak.month} at ${peak.v.toFixed(1)} hours a day, worst ${trough.month} at ${trough.v.toFixed(1)}`}>
        {MONTHS.map((name, i) => {
          const v = hoursOf(monthly, name);
          const h = v == null ? 0 : Math.max(1.5, (Math.min(v, max) / max) * H);
          const x = i * slot + 1;
          return (
            <g key={name}>
              <rect x={x} y={0} width={bw} height={H} className="sun-strip-track" />
              {/* Rounded data-end anchored to the baseline, per mark spec. */}
              <rect x={x} y={H - h} width={bw} height={h} rx={1.6} fill={color}>
                <title>{`${name}: ${v == null ? 'no data' : `${v.toFixed(1)} h/day`}`}</title>
              </rect>
            </g>
          );
        })}
        {SHORT.map((s, i) => (
          <text key={i} x={i * slot + slot / 2} y={H + 9} textAnchor="middle" className="sun-strip-tick">{s}</text>
        ))}
      </svg>
      {/* The month letters already say which month is which, so the key
          spends itself on the two numbers that matter instead: the best
          month and the worst. A bar chart of a year is read for its shape;
          the extremes are what the shape is about. */}
      <span className="sun-strip-key">
        {peak.month} {peak.v.toFixed(1)}h · {trough.month} {trough.v.toFixed(1)}h
      </span>
    </div>
  );
}

export function SunLines({ series }) {
  // series: [{ label, color, monthly }]
  const usable = series.filter((s) => Array.isArray(s.monthly) && s.monthly.length);
  if (usable.length < 2) return null;

  const W = 620, H = 250, PAD_L = 34, PAD_R = 46, PAD_T = 14, PAD_B = 28;
  const peak = Math.max(4, ...usable.flatMap((s) => s.monthly.map((m) => Number(m.usableHours) || 0)));
  const max = Math.ceil(peak);                  // every gridline names a value the data reaches
  const px = (i) => PAD_L + (i / 11) * (W - PAD_L - PAD_R);
  const py = (v) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const ticks = [0, max / 2, max];

  return (
    <figure className="sun-lines">
      <figcaption>
        <strong>Direct sun through the year</strong>
        <span>Hours a day on this flat&apos;s facade, at its floor</span>
      </figcaption>
      <div className="sun-lines-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="250" role="img"
             aria-label="Hours of direct sun per day, by month, for each property">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={py(t)} y2={py(t)} className="sl-grid" />
              <text x={PAD_L - 7} y={py(t) + 3.5} textAnchor="end" className="sl-axis">{t % 1 ? t.toFixed(1) : t}</text>
            </g>
          ))}
          {SHORT.map((s, i) => (
            <text key={i} x={px(i)} y={H - 8} textAnchor="middle" className="sl-axis">{s}</text>
          ))}
          {usable.map((s) => {
            const pts = MONTHS.map((name, i) => {
              const v = hoursOf(s.monthly, name);
              return v == null ? null : `${px(i)},${py(v)}`;
            }).filter(Boolean).join(' ');
            const lastV = hoursOf(s.monthly, 'December');
            return (
              <g key={s.label}>
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2"
                          strokeLinejoin="round" strokeLinecap="round" />
                {lastV != null && (
                  <>
                    <circle cx={px(11)} cy={py(lastV)} r="3.5" fill={s.color} className="sl-end" />
                    {/* Direct label: identity never rests on colour alone. */}
                    <text x={px(11) + 9} y={py(lastV) + 3.5} className="sl-lab" fill={s.color}>{s.label}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
