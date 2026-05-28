// Stryker mutation testing configuration for the Stellar-Save frontend.
// https://stryker-mutator.io/docs/stryker-js/configuration/

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // ─── Test runner ──────────────────────────────────────────────────────────
  testRunner: 'vitest',
  vitest: {
    // Reuse the project's vitest config so globals, jsdom, and setup files
    // are all picked up automatically.
    configFile: 'vitest.config.ts',
  },

  // ─── Mutation scope ───────────────────────────────────────────────────────
  // Only mutate production source files — exclude tests, generated code,
  // assets, i18n strings, and pure type definitions.
  mutate: [
    'src/**/*.{ts,tsx}',
    // Exclusions
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test/**',
    '!src/main.tsx',          // entry point — no logic
    '!src/**/*.d.ts',
    '!src/i18n/**',           // translation strings — not logic
    '!src/assets/**',
    '!src/img/**',
    '!src/svg/**',
    '!src/types/**',          // pure type definitions
  ],

  // ─── Reporters ────────────────────────────────────────────────────────────
  reporters: ['html', 'json', 'progress', 'clear-text'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },

  // ─── Thresholds ───────────────────────────────────────────────────────────
  // Fail the run if the mutation score drops below these levels.
  thresholds: {
    high: 80,    // green  — good coverage
    low: 60,     // yellow — acceptable but needs improvement
    break: 50,   // red    — CI fails below this
  },

  // ─── Performance ──────────────────────────────────────────────────────────
  // Run mutants in parallel using all available CPU cores.
  concurrency: 4,

  // Incremental mode: only re-test mutants that changed since last run.
  // Useful for local development; disabled in CI (clean slate each run).
  incremental: false,

  // ─── Misc ─────────────────────────────────────────────────────────────────
  // Ignore mutants that are covered by a test but still survive (i.e. the
  // test doesn't assert the mutated behaviour).  Set to 'all' to also ignore
  // uncovered mutants (not recommended — they indicate missing tests).
  ignoreStatic: false,

  // Timeout factor applied on top of the baseline test run time.
  timeoutFactor: 2,
  timeoutMS: 60000,

  // Log level: 'off' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  logLevel: 'info',

  // Temp directory for mutant builds.
  tempDirName: '.stryker-tmp',
};

export default config;
