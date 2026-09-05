'use client';
// components/property-score/StartChooser.js
// The Start tab -- what used to be "Priorities" (persona list + entry-mode
// A/B buttons). Replaces both with one question and three doors:
// neighbourhood, unit, furnishing. Nobody is walked through a stage they
// didn't ask for; each card drops straight into its own branch.
//
// Why the persona picker is gone from here: `personaId` still exists and
// still weights the AsliVastu composite (lib/personas.js), it's just no
// longer a question we put in front of a first-time visitor. The flow
// pins it to PERSONA_ORDER[0] -- see PropertyScoreFlow.js. Nothing in the
// API contract or in saved reports changed, so /my-reports entries written
// before this still read back fine.
//
// Colour is doing real work here, not decoration: --av is AsliVastu's hue
// (the area), --ss is SunScout's (the light), and --brand is the parent
// tone, used for Furnishing because it's the one tool that isn't inherited
// from either engine. Same mapping as everywhere else in the app, so the
// card you pick and the screen you land on are the same colour.

const DOORS = [
  {
    key: 'neighbourhood',
    accent: 'var(--av)',
    eyebrow: 'THE AREA',
    title: 'Is this a good place to live?',
    blurb: 'Roads, water, power, schools, safety and air quality for the locality, scored against everywhere else in the city.',
    cta: 'Check the area',
  },
  {
    key: 'unit',
    accent: 'var(--ss)',
    eyebrow: 'THE FLAT',
    title: 'Does this flat get light and air?',
    blurb: 'Sun, shadow, heat, view and privacy for your exact floor and facing, from a 3D model of the buildings around it.',
    cta: 'Check the flat',
  },
  {
    key: 'furnishing',
    accent: 'var(--brand)',
    eyebrow: 'THE ROOMS',
    title: 'How should I lay it out?',
    blurb: 'Upload a floor plan and get room-by-room furniture and placement suggestions for the space you actually have.',
    cta: 'Plan the rooms',
  },
];

/* ── Illustrations ─────────────────────────────────────────────────────
   Drawn rather than iconned, because each one is a small picture of what
   the branch actually measures. The unit drawing is the only animated
   one: hovering or focusing that card walks the sun across and swings the
   cast shadow with it, which is the product demonstrating itself in the
   card. The other two hold still on purpose -- one moving thing reads as
   deliberate, three read as a template. */

function AreaArt({ accent }) {
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label="A street grid with one location pinned" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g fill={accent} opacity="0.13">
        <rect x="14" y="16" width="46" height="34" rx="2" />
        <rect x="76" y="16" width="34" height="34" rx="2" />
        <rect x="126" y="16" width="60" height="34" rx="2" />
        <rect x="14" y="66" width="46" height="24" rx="2" />
        <rect x="126" y="66" width="60" height="24" rx="2" />
        <rect x="14" y="106" width="34" height="20" rx="2" />
        <rect x="64" y="106" width="58" height="20" rx="2" />
        <rect x="138" y="106" width="48" height="20" rx="2" />
      </g>
      <g stroke={accent} strokeWidth="1.5" opacity="0.4" strokeLinecap="square">
        <path d="M0 58 H200" />
        <path d="M0 98 H200" />
        <path d="M68 0 V140" />
        <path d="M118 0 V140" />
      </g>
      <g transform="translate(93, 62)">
        <path d="M0 22 C0 22 -11 8 -11 -1 A11 11 0 0 1 11 -1 C11 8 0 22 0 22 Z" fill={accent} />
        <circle cx="0" cy="-1" r="4" fill="var(--paper)" />
      </g>
    </svg>
  );
}

function UnitArt({ accent }) {
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label="Sunlight falling on a building and casting a shadow" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* shadow first, so the building sits on top of it */}
      <polygon className="sc-shadow" points="62,118 108,118 152,132 18,132" fill={accent} opacity="0.16" />
      <g className="sc-sun">
        <circle cx="158" cy="30" r="13" fill="var(--ss-sun)" />
        <g stroke="var(--ss-sun)" strokeWidth="2" strokeLinecap="round" opacity="0.75">
          <path d="M158 8 V2" /><path d="M158 58 V52" />
          <path d="M180 30 H186" /><path d="M136 30 H130" />
          <path d="M174 14 L178 10" /><path d="M142 46 L138 50" />
          <path d="M174 46 L178 50" /><path d="M142 14 L138 10" />
        </g>
      </g>
      <rect x="62" y="42" width="46" height="76" fill={accent} opacity="0.16" />
      <rect x="62" y="42" width="46" height="76" fill="none" stroke={accent} strokeWidth="1.6" />
      <g fill={accent} opacity="0.5">
        <rect x="70" y="52" width="12" height="13" /><rect x="88" y="52" width="12" height="13" />
        <rect x="70" y="72" width="12" height="13" /><rect x="88" y="72" width="12" height="13" />
        <rect x="70" y="92" width="12" height="13" /><rect x="88" y="92" width="12" height="13" />
      </g>
      <path d="M8 118 H192" stroke={accent} strokeWidth="1.6" opacity="0.55" strokeLinecap="round" />
    </svg>
  );
}

function RoomsArt({ accent }) {
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label="A room plan with furniture placed in it" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x="18" y="18" width="164" height="104" fill="none" stroke={accent} strokeWidth="1.8" opacity="0.55" />
      <path d="M104 18 V122" stroke={accent} strokeWidth="1.4" opacity="0.32" />
      {/* doorway swing */}
      <path d="M18 84 A18 18 0 0 0 36 66" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.4" />
      <g fill={accent} opacity="0.2" stroke={accent} strokeOpacity="0.5" strokeWidth="1.2">
        <rect x="30" y="30" width="54" height="18" rx="3" />
        <rect x="34" y="60" width="20" height="34" rx="3" />
        <rect x="62" y="96" width="30" height="14" rx="3" />
        <rect x="118" y="34" width="48" height="42" rx="3" />
        <rect x="118" y="88" width="22" height="22" rx="3" />
      </g>
    </svg>
  );
}

const ART = { neighbourhood: AreaArt, unit: UnitArt, furnishing: RoomsArt };

export default function StartChooser({ onChoose }) {
  return (
    <div className="sc-root">
      <div className="sc-hero">
        <h2 className="sc-q">What do you need help with?</h2>
        <p className="sc-sub">
          Start wherever you like. Whatever you skip stays available on the same
          address afterwards, so nothing here locks you into a longer path than
          you wanted.
        </p>
      </div>

      <div className="sc-doors">
        {DOORS.map(d => {
          const Art = ART[d.key];
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onChoose(d.key)}
              className={`sc-door sc-door-${d.key}`}
              style={{ '--sc-accent': d.accent }}
            >
              <span className="sc-art"><Art accent={d.accent} /></span>
              <span className="mono sc-eyebrow">{d.eyebrow}</span>
              <span className="sc-title">{d.title}</span>
              <span className="sc-blurb">{d.blurb}</span>
              <span className="sc-cta">{d.cta}</span>
            </button>
          );
        })}
      </div>

      <a href="#sc-detail" className="sc-scroll-cue">
        Not sure which? Here&apos;s what each one covers
        <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
          <path d="M8 2 V13 M3 8.5 L8 13.5 L13 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>

      {/* ── The explainers below the fold. Same three subjects, alternating
          sides, for someone who scrolled instead of clicking because they
          don't yet know which of the three they need. */}
      <div className="sc-detail" id="sc-detail">
        {DOORS.map((d, i) => {
          const Art = ART[d.key];
          return (
            <section key={d.key} className={`sc-row ${i % 2 ? 'sc-row-flip' : ''}`} style={{ '--sc-accent': d.accent }}>
              <div className="sc-row-art"><Art accent={d.accent} /></div>
              <div className="sc-row-copy">
                <span className="mono sc-eyebrow">{d.eyebrow}</span>
                <h3 className="sc-row-title">{d.title}</h3>
                <p className="sc-row-body">{d.blurb}</p>
                <button type="button" onClick={() => onChoose(d.key)} className="sc-row-cta">
                  {d.cta}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <style jsx>{`
        .sc-root { max-width: 1080px; margin: 0 auto; }

        .sc-hero { max-width: 620px; margin-bottom: 34px; }
        .sc-q {
          font-size: clamp(26px, 3.6vw, 40px);
          line-height: 1.1;
          margin: 0 0 12px;
          color: var(--ink);
        }
        .sc-sub {
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--text-mute);
          margin: 0;
        }

        .sc-doors {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .sc-door {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 20px 20px 22px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-top: 3px solid var(--sc-accent);
          border-radius: var(--radius);
          cursor: pointer;
          font: inherit;
          color: inherit;
          transition: border-color .18s ease, background .18s ease;
        }
        .sc-door:hover, .sc-door:focus-visible {
          border-color: var(--sc-accent);
          background: color-mix(in srgb, var(--sc-accent) 5%, var(--paper));
        }
        .sc-door:focus-visible { outline: 2px solid var(--sc-accent); outline-offset: 3px; }

        .sc-art {
          display: block;
          width: 100%;
          margin-bottom: 16px;
          border-radius: calc(var(--radius) - 2px);
          background: color-mix(in srgb, var(--sc-accent) 6%, var(--bg-2));
          padding: 10px 12px;
        }

        .sc-eyebrow {
          font-size: 10.5px;
          letter-spacing: .14em;
          color: var(--sc-accent);
          margin-bottom: 8px;
        }
        .sc-title {
          font-size: 17px;
          font-weight: 700;
          line-height: 1.28;
          color: var(--ink);
          margin-bottom: 8px;
        }
        .sc-blurb {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--text-mute);
          margin-bottom: 16px;
        }
        .sc-cta {
          margin-top: auto;
          font-size: 13px;
          font-weight: 700;
          color: var(--sc-accent);
          border-bottom: 1.5px solid color-mix(in srgb, var(--sc-accent) 40%, transparent);
          padding-bottom: 2px;
        }

        /* The one animated moment on this screen: the sun walks and the
           shadow swings with it, only on the unit card, only on hover or
           keyboard focus. */
        .sc-door-unit :global(.sc-sun),
        .sc-door-unit :global(.sc-shadow) {
          transition: transform .55s cubic-bezier(.4, 0, .2, 1);
          transform-origin: center;
        }
        .sc-door-unit:hover :global(.sc-sun),
        .sc-door-unit:focus-visible :global(.sc-sun) {
          transform: translate(-96px, 16px);
        }
        .sc-door-unit:hover :global(.sc-shadow),
        .sc-door-unit:focus-visible :global(.sc-shadow) {
          transform: scaleX(-1) translateX(-170px);
        }

        .sc-scroll-cue {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 30px;
          font-size: 13px;
          color: var(--text-mute);
          text-decoration: none;
          border-bottom: 1px solid var(--line);
          padding-bottom: 3px;
        }
        .sc-scroll-cue:hover { color: var(--ink); border-bottom-color: var(--ink); }

        .sc-detail {
          margin-top: 84px;
          padding-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 72px;
        }

        .sc-row {
          display: grid;
          grid-template-columns: 5fr 6fr;
          gap: 44px;
          align-items: center;
        }
        .sc-row-flip .sc-row-art { order: 2; }

        .sc-row-art {
          background: color-mix(in srgb, var(--sc-accent) 7%, var(--bg-2));
          border: 1px solid var(--line-soft);
          border-radius: var(--radius);
          padding: 26px 30px;
        }

        .sc-row-copy { max-width: 46ch; }
        .sc-row-copy .sc-eyebrow { display: block; }
        .sc-row-title {
          font-size: clamp(19px, 2.1vw, 24px);
          line-height: 1.25;
          margin: 0 0 10px;
          color: var(--ink);
        }
        .sc-row-body {
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--text-mute);
          margin: 0 0 18px;
        }
        .sc-row-cta {
          font: inherit;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #fff;
          background: var(--sc-accent);
          border: none;
          border-radius: var(--radius);
          padding: 11px 20px;
          cursor: pointer;
        }
        .sc-row-cta:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

        @media (max-width: 900px) {
          .sc-doors { grid-template-columns: 1fr; gap: 14px; }
          .sc-art { max-width: 260px; }
          .sc-detail { margin-top: 60px; gap: 52px; }
          .sc-row { grid-template-columns: 1fr; gap: 22px; }
          .sc-row-flip .sc-row-art { order: 0; }
          .sc-row-art { max-width: 340px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sc-door, 
          .sc-door-unit :global(.sc-sun),
          .sc-door-unit :global(.sc-shadow) { transition: none; }
          .sc-door-unit:hover :global(.sc-sun),
          .sc-door-unit:focus-visible :global(.sc-sun),
          .sc-door-unit:hover :global(.sc-shadow),
          .sc-door-unit:focus-visible :global(.sc-shadow) { transform: none; }
        }
      `}</style>
    </div>
  );
}
