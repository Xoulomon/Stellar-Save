/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Flaky tests are quarantined via the `quarantine` project below instead of
  // being deleted, so they can be fixed and re-enabled without losing coverage.
  testPathIgnorePatterns: ['/node_modules/', '/tests/quarantine/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  projects: [
    {
      displayName: 'default',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts', '**/*.test.tsx'],
      testPathIgnorePatterns: ['/node_modules/', '/tests/quarantine/'],
    },
    {
      // Quarantined flaky tests. Run explicitly with:
      //   npx jest --selectProjects quarantine
      // They are excluded from the default run so CI stays green while the
      // underlying flakiness is investigated.
      displayName: 'quarantine',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/quarantine'],
      testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    },
  ],
};
