// components/HeroIllustration.js
// Hero scene: a building with a sun-lit face and a shadowed face
// (SunScout), the sun directly overhead, and a location pin that drops
// onto the score card below -- so the pin reads as marking the exact unit
// the card is scoring. On load, a dotted trail draws out from the
// building and the pin lands at the end of it (animation lives in
// globals.css: .hero-trail / .hero-pin-g).
//
// LAYOUT CONTRACT -- read before changing any coordinate:
//   * viewBox 380x320. Building occupies x 165-345 (the RIGHT side), with
//     its base on the ground line at y=235.
//   * Sun sits directly above the building at cx=258, and NOTHING may sit
//     above y=15. `.hero` has overflow:hidden, and the illustration is
//     positioned ~185px above the card's top edge -- the scene's total
//     height above the ground line is what decides whether the sun gets
//     clipped off the top of the hero. It has been clipped twice before.
//     If you make the building taller or the sun higher, you MUST also
//     re-check .hero-illustration-wrap's `top` in globals.css against the
//     hero's own padding-top, or the sun silently disappears again.
//   * Pin hangs below the ground line (y 250-318): that lower strip is
//     what deliberately overlaps the card.
export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration-svg"
      viewBox="0 0 380 320"
      fill="none"
      aria-hidden="true"
    >
      <g className="hero-sun-g">
        {/* var(--ss-sun), not var(--sun) -- this is exactly the "illustration
            fill only" token, and it's set to match the building's own
            #E9A94A lit-face yellow directly below, so the sun and the
            building read as one consistent light source instead of two
            different yellows. var(--sun) is the text/icon-safe SunScout
            colour used elsewhere on the page; keep that one for UI, not
            this illustration. */}
        <circle cx="258" cy="36" r="13" fill="var(--ss-sun)" />
        <g stroke="var(--ss-sun)" strokeWidth="1.8" strokeLinecap="round" opacity="0.55">
          <line x1="258" y1="15" x2="258" y2="6" />
          <line x1="258" y1="66" x2="258" y2="57" />
          <line x1="279" y1="36" x2="288" y2="36" />
          <line x1="237" y1="36" x2="228" y2="36" />
          <line x1="273" y1="21" x2="279" y2="15" />
          <line x1="243" y1="51" x2="237" y2="57" />
          <line x1="273" y1="51" x2="279" y2="57" />
          <line x1="243" y1="21" x2="237" y2="15" />
        </g>
      </g>

      {/* Building: lit face meets shadowed face on one block. */}
      <path d="M165,235 L165,110 L250,140 L250,270 Z" fill="#E9A94A" />
      <path d="M165,110 L250,140 L345,108 L258,78 Z" fill="#F2C57C" />
      <path d="M258,78 L345,108 L345,238 L250,270 L250,140 Z" fill="var(--slate)" />

      <g fill="#F7DFB0">
        <rect x="179" y="140" width="18" height="23" rx="1" />
        <rect x="211" y="151" width="18" height="23" rx="1" />
        <rect x="179" y="177" width="18" height="23" rx="1" />
        <rect x="211" y="188" width="18" height="23" rx="1" />
      </g>
      <g fill="var(--paper)" opacity="0.22">
        <rect x="268" y="126" width="18" height="23" rx="1" />
        <rect x="302" y="114" width="18" height="23" rx="1" />
        <rect x="268" y="163" width="18" height="23" rx="1" />
        <rect x="302" y="151" width="18" height="23" rx="1" />
        <rect x="268" y="200" width="18" height="23" rx="1" />
        <rect x="302" y="188" width="18" height="23" rx="1" />
      </g>

      <ellipse cx="250" cy="243" rx="105" ry="11" fill="var(--ink)" opacity="0.06" />

      {/* Dotted trail, building -> pin. Revealed right-to-left on load. */}
      <path
        className="hero-trail"
        d="M222,244 Q170,256 116,250"
        stroke="var(--slate)"
        strokeWidth="1.8"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* Pin -- drops in at the end of the trail, landing on the card.
          var(--av), not var(--slate)/var(--brand) -- the pin is red on
          request, and --av is now wine/red-family since the dominant/
          AsliVastu colour swap, so this stays inside the token system
          rather than introducing a new hardcoded hex. If this reads as
          too muted a red once you see it live, that's a shade call on
          --av itself (it's meant to double as AsliVastu's colour
          elsewhere), not something to fix by hardcoding a brighter red
          just here. */}
      <g className="hero-pin-g" style={{ filter: 'drop-shadow(0 7px 11px rgba(28,24,18,0.24))' }}>
        <path
          d="M110 250c-14 0-25.4 11.2-25.4 25.2 0 18.8 25.4 43.6 25.4 43.6s25.4-24.8 25.4-43.6c0-14-11.4-25.2-25.4-25.2z"
          fill="var(--av)"
        />
        <circle cx="110" cy="274" r="9" fill="var(--paper)" />
      </g>
    </svg>
  );
}
