// components/HeroIllustration.js
// Decorative backdrop for the hero's product card, in the spirit of the
// big illustrated hero visuals other B2B sites use (a crane lowering a
// shipping container, etc.) but built out of BlindSpot's own two ideas
// instead of a generic 3D render: a building split into a sun-lit face and
// a shadowed face (SunScout), a location pin planted at its base
// (AsliVastu), and a dotted sun-path arc tying the two together -- the
// same "one pin, two answers" idea the hero copy already states in words.
//
// A wide, short "banner" composition on purpose, not a tall portrait scene
// -- it lives in its own reserved space directly above .hero-score-card
// (see .hero-illustration-wrap in globals.css), with only a small
// intentional overlap at the very bottom for depth. An earlier version
// tried to bleed a portrait-shaped scene out from behind the card instead;
// since the card is roughly as tall as that scene was, the card ended up
// covering almost the whole thing, leaving only a fragment of roof above
// it and the pin/base looking like disconnected debris below it. This
// version can't have that problem: it has its own dedicated vertical
// space, so nothing meant to be visible depends on guessing how much of
// it the card happens to cover.
//
// Pure decoration (aria-hidden). Desktop only: hidden below 900px in
// globals.css so it never has to fight the mobile hero for space.
export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration-svg"
      viewBox="0 0 520 260"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M70,100 A190,190 0 0 1 330,48"
        stroke="var(--sun)"
        strokeWidth="1.5"
        strokeDasharray="3 8"
        opacity="0.45"
      />
      <circle cx="330" cy="48" r="8" fill="var(--sun)" opacity="0.9" />
      <g stroke="var(--sun)" strokeWidth="1.5" opacity="0.45">
        <line x1="330" y1="29" x2="330" y2="19" />
        <line x1="346" y1="36" x2="354" y2="28" />
        <line x1="350" y1="48" x2="361" y2="48" />
      </g>

      {/* Building: sun-lit face (amber, left) vs shadowed face (slate, right) --
          same block, two faces, matching SunScout's whole premise. */}
      <path d="M300,240 L300,84 L346,105 L346,232 Z" fill="#E9A94A" />
      <path d="M300,84 L346,105 L382,90 L338,70 Z" fill="#F2C57C" />
      <path d="M338,70 L382,90 L382,214 L346,232 L346,105 Z" fill="var(--slate)" />

      <g fill="#F7DFB0">
        <rect x="309" y="100" width="13" height="17" rx="1" />
        <rect x="328" y="108" width="13" height="17" rx="1" />
        <rect x="309" y="130" width="13" height="17" rx="1" />
        <rect x="328" y="138" width="13" height="17" rx="1" />
        <rect x="309" y="160" width="13" height="17" rx="1" />
        <rect x="328" y="168" width="13" height="17" rx="1" />
        <rect x="309" y="190" width="13" height="17" rx="1" />
        <rect x="328" y="198" width="13" height="17" rx="1" />
      </g>
      <g fill="var(--paper)" opacity="0.22">
        <rect x="354" y="118" width="13" height="17" rx="1" />
        <rect x="368" y="112" width="13" height="17" rx="1" />
        <rect x="354" y="148" width="13" height="17" rx="1" />
        <rect x="368" y="142" width="13" height="17" rx="1" />
        <rect x="354" y="178" width="13" height="17" rx="1" />
        <rect x="368" y="172" width="13" height="17" rx="1" />
      </g>

      <ellipse cx="340" cy="244" rx="105" ry="10" fill="var(--ink)" opacity="0.05" />

      {/* Location pin, standing clear beside the building -- AsliVastu's
          half of the same "one pin" idea. Kept well above the card's
          overlap zone at the bottom so it's never partly hidden. */}
      <path
        d="M230 165c-8 0-14.5 6.4-14.5 14.4 0 10.8 14.5 25 14.5 25s14.5-14.2 14.5-25c0-8-6.5-14.4-14.5-14.4z"
        fill="var(--slate)"
      />
      <circle cx="230" cy="179.5" r="5.2" fill="var(--paper)" />
    </svg>
  );
}
