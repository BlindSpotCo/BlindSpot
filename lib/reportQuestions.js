// The three optional questions that shape the full written report. They sit
// on the verdict page, beside the button that builds it, instead of in a
// pop-up that appeared after the click.
//
// "Who's this for?" and "Why are you looking?" used to be two questions that
// mostly asked the same thing (Just me / Buying to live in it, Investment /
// Buying to rent out). One goal now, mapped onto both things the server uses:
// a persona from lib/personas.js and a purpose line for the prompt.
export const GOAL_OPTIONS = [
  { key: 'own_live', label: 'Own & live in it', persona: undefined, purpose: 'buying_to_live' },
  { key: 'rent_invest', label: 'Rent out / invest', persona: 'investor', purpose: 'buying_to_rent' },
  { key: 'client', label: 'For a client / due diligence', persona: 'broker', purpose: 'researching' },
];

export const HORIZON_OPTIONS = [
  { key: 'under_3', label: 'Under 3 years' },
  { key: '3_7', label: '3-7 years' },
  { key: '10_plus', label: '10+ years' },
  { key: 'unsure', label: 'Not sure' },
];

export const PRIORITY_OPTIONS = [
  { key: 'sunlight', label: 'Sunlight' },
  { key: 'safety', label: 'Safety' },
  { key: 'schools', label: 'Schools' },
  { key: 'privacy', label: 'Noise & privacy' },
  { key: 'air', label: 'Air quality' },
  { key: 'connectivity', label: 'Commute' },
  { key: 'resale', label: 'Resale value' },
  { key: 'price', label: 'Price vs. fundamentals' },
];
export const MAX_PRIORITIES = 2;

// answers -> the fields report/analyse already accepts. Unknown or empty
// answers become undefined, which is the default report.
export function answersToRequest(answers) {
  const a = answers || {};
  const goal = GOAL_OPTIONS.find((o) => o.key === a.goal);
  const priorities = Array.isArray(a.priorities) ? a.priorities.slice(0, MAX_PRIORITIES) : [];
  const note = typeof a.note === 'string' ? a.note.trim() : '';
  return {
    personaId: goal?.persona,
    purpose: goal?.purpose,
    horizon: HORIZON_OPTIONS.some((o) => o.key === a.horizon) ? a.horizon : undefined,
    priorities: priorities.length ? priorities : undefined,
    customNote: note || undefined,
  };
}
