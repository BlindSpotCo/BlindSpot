// components/HeroIllustration.js
// Decorative backdrop for the hero's product card, in the spirit of the
// big illustrated hero visuals other B2B sites use (a crane lowering a
// shipping container, etc.) but built out of BlindSpot's own two ideas
// instead of a generic 3D render: a building split into a sun-lit face and
// a shadowed face (SunScout), a location pin planted at its base
// (AsliVastu), and a dotted sun-path arc tying the two together -- the
// same "one pin, two answers" idea the hero copy already states in words.
//
// Pure decoration (aria-hidden), sits absolutely positioned behind
// .hero-score-card in .hero-visual -- the real card is unchanged and
// still the only thing carrying actual product data. Desktop only: hidden
// below 900px in globals.css so it never has to fight the mobile hero for
// space (see .hero-illustration's media query there).
export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration-svg"
      viewBox="0 0 560 560"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M90,120 A210,210 0 0 1 470,120"
        stroke="var(--sun)"
        strokeWidth="1.5"
        strokeDasharray="3 8"
        opacity="0.45"
      />
      <circle cx="470" cy="120" r="9" fill="var(--sun)" opacity="0.9" />
      <g stroke="var(--sun)" strokeWidth="1.5" opacity="0.45">
        <line x1="470" y1="99" x2="470" y2="88" />
        <line x1="487" y1="107" x2="495" y2="99" />
        <line x1="491" y1="120" x2="503" y2="120" />
      </g>

      {/* Building: sun-lit face (amber, left) vs shadowed face (slate, right) --
          same block, two faces, matching SunScout's whole premise. */}
      <path d="M270,460 L270,190 L360,228 L360,500 Z" fill="#E9A94A" />
      <path d="M270,190 L360,228 L432,200 L342,162 Z" fill="#F2C57C" />
      <path d="M342,162 L432,200 L432,470 L360,500 L360,228 Z" fill="var(--slate)" />

      <g fill="#F7DFB0">
        <rect x="284" y="218" width="17" height="22" rx="1" />
        <rect x="310" y="229" width="17" height="22" rx="1" />
        <rect x="284" y="258" width="17" height="22" rx="1" />
        <rect x="310" y="269" width="17" height="22" rx="1" />
        <rect x="284" y="298" width="17" height="22" rx="1" />
        <rect x="310" y="309" width="17" height="22" rx="1" />
        <rect x="284" y="338" width="17" height="22" rx="1" />
        <rect x="310" y="349" width="17" height="22" rx="1" />
        <rect x="284" y="378" width="17" height="22" rx="1" />
        <rect x="310" y="389" width="17" height="22" rx="1" />
      </g>
      <g fill="var(--paper)" opacity="0.22">
        <rect x="375" y="243" width="17" height="22" rx="1" />
        <rect x="400" y="233" width="17" height="22" rx="1" />
        <rect x="375" y="283" width="17" height="22" rx="1" />
        <rect x="400" y="273" width="17" height="22" rx="1" />
        <rect x="375" y="323" width="17" height="22" rx="1" />
        <rect x="400" y="313" width="17" height="22" rx="1" />
        <rect x="375" y="363" width="17" height="22" rx="1" />
        <rect x="400" y="353" width="17" height="22" rx="1" />
        <rect x="375" y="403" width="17" height="22" rx="1" />
        <rect x="400" y="393" width="17" height="22" rx="1" />
      </g>

      <ellipse cx="350" cy="512" rx="140" ry="14" fill="var(--ink)" opacity="0.05" />

      {/* Location pin, planted at the building's base -- AsliVastu's half
          of the same "one pin" idea. */}
      <path
        d="M210 452c-10.5 0-19 8.4-19 18.9 0 14.1 19 32.6 19 32.6s19-18.5 19-32.6c0-10.5-8.5-18.9-19-18.9z"
        fill="var(--slate)"
      />
      <circle cx="210" cy="470" r="6.8" fill="var(--paper)" />
    </svg>
  );
}
