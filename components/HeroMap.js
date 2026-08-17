// components/HeroMap.js
// Full-bleed city map behind the hero: a road grid with blocks between the
// streets and a river along the bottom, drawn in the site's own ink tone
// rather than a map tile service. Replaces the old faint dot-grid
// (.hero-bg) as the hero's ambient texture -- the point is that the hero
// reads as a map you just dropped a pin on, which is what the product
// actually does, instead of generic decoration.
//
// Masked to a soft ellipse so it dissolves toward the edges instead of
// ending on a hard line, and kept deliberately low-contrast: it must sit
// under the headline and the score card without competing with either.
// Purely decorative (aria-hidden). `variant="dim"` is a lower-contrast,
// river-free version used behind the property-score threshold screen
// (see globals.css .hero-map--dim) -- same grid, deliberately less
// prominent so that screen doesn't read as a clone of this hero.
export default function HeroMap({ variant }) {
  return (
    <div className={`hero-map${variant ? ` hero-map--${variant}` : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <g className="hero-map-roads">
          <path d="M0,150 H1600 M0,330 H1600 M0,520 H1600 M0,700 H1600" />
          <path d="M180,0 V900 M430,0 V900 M700,0 V900 M960,0 V900 M1230,0 V900 M1450,0 V900" />
        </g>
        <g className="hero-map-roads hero-map-roads-minor">
          <path d="M0,240 H1600 M0,420 H1600 M0,610 H1600 M0,800 H1600" />
          <path d="M300,0 V900 M560,0 V900 M830,0 V900 M1100,0 V900 M1340,0 V900" />
        </g>
        <g className="hero-map-blocks">
          <rect x="205" y="175" width="200" height="130" rx="3" />
          <rect x="455" y="175" width="220" height="130" rx="3" />
          <rect x="725" y="175" width="210" height="130" rx="3" />
          <rect x="985" y="175" width="220" height="130" rx="3" />
          <rect x="1255" y="175" width="170" height="130" rx="3" />
          <rect x="205" y="355" width="200" height="140" rx="3" />
          <rect x="455" y="355" width="220" height="140" rx="3" />
          <rect x="985" y="355" width="220" height="140" rx="3" />
          <rect x="1255" y="355" width="170" height="140" rx="3" />
          <rect x="205" y="545" width="200" height="130" rx="3" />
          <rect x="455" y="545" width="220" height="130" rx="3" />
          <rect x="725" y="545" width="210" height="130" rx="3" />
          <rect x="985" y="545" width="220" height="130" rx="3" />
          <rect x="1255" y="545" width="170" height="130" rx="3" />
        </g>
        <path
          className="hero-map-water"
          d="M0,880 C240,830 420,905 700,860 C980,815 1180,880 1600,840 L1600,900 L0,900 Z"
        />
      </svg>
    </div>
  );
}
