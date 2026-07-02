module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/generated/**',
    '!src/tests/**',
  ],
  coverageDirectory: 'coverage',
  // Minimum coverage gate for the backend workspace (see docs/test-coverage.md).
  // Conservative baseline; raise as backend test coverage grows.
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      branches: 50,
      statements: 60,
    },
  },
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};