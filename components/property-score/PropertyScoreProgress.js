'use client';
// components/property-score/PropertyScoreProgress.js
// One persistent "you are here" strip for the whole property-score flow --
// and now the flow's actual navigation, not just a status readout. The
// flow itself is 4 single-screen tabs (see PropertyScoreFlow.js) instead
// of one long scroll through all four stages stacked on top of each
// other; this stepper is how you move between them, both forward (once a
// stage's own "Continue" gets you there) and back (click any stage
// you've already reached, any time).
//
// `current` is whichever SCREEN is actually on show right now -- still
// just 'location' | 'unit' | 'verdict' (3 screens -- see
// PropertyScoreFlow.js, Priorities and Location render together on one
// screen). The stepper below still shows 4 labelled steps, not 3: two
// STAGES entries ('priorities' and 'location') point at that same
// 'location' screen, so picking either one highlights both and lands you
// on the one combined screen. `done` marks real completion (ticks the
// checkmark), independent of what's currently in view. `reachable` is the
// set of stage keys allowed to be clicked into.
const SCREENS = ['location', 'unit', 'verdict'];
const STAGES = [
  { key: 'priorities', label: 'Priorities', screen: 'location' },
  { key: 'location', label: 'Location', screen: 'location' },
  { key: 'unit', label: 'Unit', screen: 'unit' },
  { key: 'verdict', label: 'Verdict', screen: 'verdict' },
];

export default function PropertyScoreProgress({ current, done = [], reachable = [], onSelect }) {
  const currentScreenPos = Math.max(0, SCREENS.indexOf(current));

  return (
    <div style={{
      position: 'sticky', top: 66, zIndex: 5, background: 'var(--bg)',
      borderBottom: '1px solid var(--line)', padding: '10px 0',
    }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => {
          const screenPos = SCREENS.indexOf(s.screen);
          const active = s.screen === current;
          const isDone = done.includes(s.key) || screenPos < currentScreenPos;
          const canGo = reachable.includes(s.key) && !active;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => canGo && onSelect?.(s.key)}
                disabled={!canGo}
                className="mono"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '4px 2px',
                  cursor: canGo ? 'pointer' : 'default',
                }}
                aria-current={active ? 'step' : undefined}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 700, flexShrink: 0,
                  background: isDone || active ? 'var(--brand)' : 'transparent',
                  color: isDone || active ? '#fff' : 'var(--text-dim)',
                  border: isDone || active ? 'none' : '1px solid var(--line)',
                }}>{isDone ? '✓' : i + 1}</span>
                <span style={{
                  fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: active ? 'var(--ink)' : (isDone ? 'var(--text-mute)' : 'var(--text-dim)'),
                  fontWeight: active ? 700 : 500,
                  textDecoration: canGo ? 'underline' : 'none', textUnderlineOffset: 3,
                  textDecorationColor: 'color-mix(in srgb, currentColor 35%, transparent)',
                }}>{s.label}</span>
              </button>
              {i < STAGES.length - 1 && (
                <div style={{ width: 40, height: 1, background: isDone ? 'var(--brand)' : 'var(--line)', margin: '0 14px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
