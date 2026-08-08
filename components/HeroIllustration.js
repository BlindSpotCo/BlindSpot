// components/HeroIllustration.js
// Decorative hero scene built from BlindSpot's own two ideas rather than a
// stock render: a building with a sun-lit face and a shadowed face
// (SunScout), the sun tracking directly overhead, and a location pin that
// drops onto the score card below it -- so the pin literally points at the
// unit the card is scoring. That's the "one pin, two answers" line the
// hero copy already makes, as a picture.
//
// LAYOUT CONTRACT -- read before changing any coordinate:
//   * viewBox is 380x340. The building sits in the RIGHT half (x 195-345)
//     with its base on the ground line at y=235.
//   * The sun sits directly above the building (cx=268), clear of the roof.
//   * The pin hangs BELOW the ground line (y 250-320) on the left. That
//     lower strip is the part that deliberately overlaps the score card:
//     .hero-illustration-wrap is absolutely positioned over the card with
//     a z-index above it (see globals.css), so the pin reads as landing on
//     the card while the building stays clear above the card's top edge.
//   * Keep the building base at/above y=235 and the pin tip at/below
//     y=300, or the two stop relating to the card correctly.
export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration-svg"
      viewBox="0 0 380 340"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M40,150 A165,165 0 0 1 268,34"
        stroke="var(--sun)"
        strokeWidth="1.5"
        strokeDasharray="3 8"
        opacity="0.5"
      />
      <circle cx="268" cy="34" r="11" fill="var(--sun)" />
      <g stroke="var(--sun)" strokeWidth="1.5" opacity="0.5">
        <line x1="268" y1="9" x2="268" y2="0" />
        <line x1="290" y1="19" x2="298" y2="11" />
        <line x1="294" y1="34" x2="306" y2="34" />
        <line x1="246" y1="19" x2="238" y2="11" />
        <line x1="242" y1="34" x2="230" y2="34" />
      </g>

      {/* Building: lit face meets shadowed face on one block. Base on the
          y=235 ground line, i.e. clear above the card's top edge. */}
      <path d="M195,235 L195,105 L262,131 L262,262 Z" fill="#E9A94A" />
      <path d="M195,105 L262,131 L318,105 L252,79 Z" fill="#F2C57C" />
      <path d="M252,79 L318,105 L318,236 L262,262 L262,131 Z" fill="var(--slate)" />

      <g fill="#F7DFB0">
        <rect x="206" y="129" width="15" height="19" rx="1" />
        <rect x="230" y="138" width="15" height="19" rx="1" />
        <rect x="206" y="161" width="15" height="19" rx="1" />
        <rect x="230" y="170" width="15" height="19" rx="1" />
        <rect x="206" y="193" width="15" height="19" rx="1" />
        <rect x="230" y="202" width="15" height="19" rx="1" />
      </g>
      <g fill="var(--paper)" opacity="0.22">
        <rect x="274" y="147" width="15" height="19" rx="1" />
        <rect x="296" y="138" width="15" height="19" rx="1" />
        <rect x="274" y="179" width="15" height="19" rx="1" />
        <rect x="296" y="170" width="15" height="19" rx="1" />
        <rect x="274" y="211" width="15" height="19" rx="1" />
        <rect x="296" y="202" width="15" height="19" rx="1" />
      </g>

      <ellipse cx="256" cy="241" rx="86" ry="9" fill="var(--ink)" opacity="0.06" />

      {/* Pin -- hangs below the ground line so it lands on the score card,
          reading as "this pin marks the unit this card is scoring".
          Drop shadow keeps it legible sitting on the card's paper. */}
      <g style={{ filter: 'drop-shadow(0 6px 10px rgba(28,24,18,0.22))' }}>
        <path
          d="M118 252c-13.3 0-24 10.6-24 23.8 0 17.8 24 41.2 24 41.2s24-23.4 24-41.2c0-13.2-10.7-23.8-24-23.8z"
          fill="var(--slate)"
        />
        <circle cx="118" cy="275" r="8.6" fill="var(--paper)" />
      </g>
    </svg>
  );
}
