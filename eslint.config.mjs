// `npm run lint` had no config to run against (ESLint 9 needs a flat
// config), so it errored out before checking anything.
import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    rules: {
      // React Compiler advisories. The flagged effects reset or sync state
      // on purpose (a new address, a new run); rewriting them all is a
      // behaviour change, so they stay visible as warnings, not errors.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'scripts/**', 'public/**'] },
];

export default config;
