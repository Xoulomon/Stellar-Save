module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/integration/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/tests/**'],
  coverageDirectory: 'coverage',
  // Minimum coverage gate for the backend workspace (see docs/test-coverage.md).
  // Enforced baseline at 85%+ (Issue #1535).
  coverageThreshold: {
    global: {
      lines: 85,
      functions: 85,
      branches: 85,
      statements: 85,
    },
  },
  setupFilesAfterEnv: [],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
