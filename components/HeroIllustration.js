// components/HeroIllustration.js
// Decorative hero scene, built out of BlindSpot's own two ideas rather
// than a generic stock render: a building with a sun-lit face and a
// shadowed face (SunScout), a location pin planted on the same ground
// line beside it (AsliVastu), and a dotted sun-path arc overhead -- the
// "one pin, two answers" idea the hero copy already states in words.
//
// LAYOUT CONTRACT (this is the thing that broke twice before):
// everything that must stay visible -- the sun, the whole building, the
// pin -- lives above y=372 in this viewBox. The card below overlaps only
// the last ~20px of the rendered SVG (see .hero-illustration-wrap's
// negative margin in globals.css), so it tucks the building's very base
// behind the card for depth WITHOUT eating the pin or anything else.
// Two earlier versions got this wrong in opposite directions: the first
// was portrait-shaped and absolutely positioned behind the card, so the
// card (about as tall as the scene) covered nearly all of it; the second
// over-corrected into a short banner that left a dead gap between the
// scene and the card. If you change the geometry here, keep the ground
// line at y~372 and keep the pin's tip above it.
export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration-svg"
      viewBox="0 0 500 400"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30,120 A200,200 0 0 1 410,70"
        stroke="var(--sun)"
        strokeWidth="1.5"
        strokeDasharray="3 8"
        opacity="0.5"
      />
      <circle cx="410" cy="70" r="10" fill="var(--sun)" />
      <g stroke="var(--sun)" strokeWidth="1.5" opacity="0.5">
        <line x1="410" y1="46" x2="410" y2="34" />
        <line x1="430" y1="56" x2="439" y2="47" />
        <line x1="434" y1="70" x2="447" y2="70" />
      </g>

      {/* Building: sun-lit face (amber) meets shadowed face (slate) on the
          same block -- SunScout's whole premise in one shape. Base sits on
          the y~372 ground line; only the last few px tuck behind the card. */}
      <path d="M230,370 L230,150 L320,185 L320,400 Z" fill="#E9A94A" />
      <path d="M230,150 L320,185 L390,155 L300,120 Z" fill="#F2C57C" />
      <path d="M300,120 L390,155 L390,372 L320,400 L320,185 Z" fill="var(--slate)" />

      <g fill="#F7DFB0">
        <rect x="243" y="178" width="19" height="24" rx="1" />
        <rect x="272" y="189" width="19" height="24" rx="1" />
        <rect x="243" y="219" width="19" height="24" rx="1" />
        <rect x="272" y="230" width="19" height="24" rx="1" />
        <rect x="243" y="260" width="19" height="24" rx="1" />
        <rect x="272" y="271" width="19" height="24" rx="1" />
        <rect x="243" y="301" width="19" height="24" rx="1" />
        <rect x="272" y="312" width="19" height="24" rx="1" />
      </g>
      <g fill="var(--paper)" opacity="0.22">
        <rect x="334" y="205" width="19" height="24" rx="1" />
        <rect x="362" y="193" width="19" height="24" rx="1" />
        <rect x="334" y="246" width="19" height="24" rx="1" />
        <rect x="362" y="234" width="19" height="24" rx="1" />
        <rect x="334" y="287" width="19" height="24" rx="1" />
        <rect x="362" y="275" width="19" height="24" rx="1" />
        <rect x="334" y="328" width="19" height="24" rx="1" />
        <rect x="362" y="316" width="19" height="24" rx="1" />
      </g>

      <ellipse cx="300" cy="376" rx="135" ry="13" fill="var(--ink)" opacity="0.06" />

      {/* Pin, standing on the same ground line as the building. Tip ends
          at y~370 -- above the card overlap, so it always stays visible. */}
      <path
        d="M150 316c-11 0-20 8.8-20 19.8 0 14.8 20 34.2 20 34.2s20-19.4 20-34.2c0-11-9-19.8-20-19.8z"
        fill="var(--slate)"
      />
      <circle cx="150" cy="335" r="7.2" fill="var(--paper)" />
    </svg>
  );
}
