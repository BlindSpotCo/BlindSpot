// components/profile/HomeMark.js
//
// Everyone's avatar: a tiny skyline with the sun over it, generated from
// their user id -- same person, same picture, everywhere. Replaces the
// letter circle (Google's default photo for most accounts is also just a
// letter). Pure SVG, no state, so it renders on the server too.

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

// Sky / buildings pairs from the site's own palette -- warm, never neon.
const SKIES = [
  ['#F3E7CF', '#3D4116', '#AF5F30'],
  ['#E9DFC6', '#2F3314', '#6B2232'],
  ['#F1DCC4', '#3D4116', '#8A5A00'],
  ['#E4E6D2', '#2A2E12', '#AF5F30'],
  ['#EFE1D6', '#4A2A1C', '#6B2232'],
];

export default function HomeMark({ seed = 'blindspot', size = 40, className, title }) {
  const r = seeded(String(seed));
  const [sky, ink, accent] = SKIES[Math.floor(r() * SKIES.length)];
  const sunX = 14 + r() * 36;
  const sunY = 14 + r() * 10;
  // Three to four towers of different heights; the tallest one carries the
  // accent colour -- "your" building.
  const n = 3 + Math.floor(r() * 2);
  const w = 52 / n;
  const towers = Array.from({ length: n }, (_, i) => ({
    x: 6 + i * w + 1,
    w: w - 2.5,
    h: 16 + r() * 26,
  }));
  const tallest = towers.reduce((m, t, i) => (t.h > towers[m].h ? i : m), 0);
  const id = `hm${Math.floor(r() * 1e6)}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <clipPath id={id}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="64" height="64" fill={sky} />
        <circle cx={sunX} cy={sunY} r="7" fill="#F6C544" />
        <circle cx={sunX} cy={sunY} r="11" fill="#F6C544" opacity=".22" />
        {towers.map((t, i) => (
          <g key={i}>
            <rect x={t.x} y={56 - t.h} width={t.w} height={t.h + 8} fill={i === tallest ? accent : ink} opacity={i === tallest ? 1 : 0.92} />
            {/* a column of lit windows on the tallest one */}
            {i === tallest && Array.from({ length: Math.floor(t.h / 7) }, (_, k) => (
              <rect key={k} x={t.x + t.w / 2 - 1.2} y={56 - t.h + 4 + k * 7} width="2.4" height="3" fill="#F6C544" opacity=".85" />
            ))}
          </g>
        ))}
        <rect y="56" width="64" height="8" fill={ink} />
      </g>
    </svg>
  );
}
