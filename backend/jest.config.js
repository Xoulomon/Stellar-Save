module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.ts'],
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
  // `@stellar-save/shared-utils` ships ESM (tsconfig `module: ESNext`) but this
  // suite runs as CommonJS, so resolve the package to its TypeScript sources and
  // let ts-jest transform them. Mapping to the source also means the workspace
  // package does not need building before backend tests run.
  moduleNameMapper: {
    '^@stellar-save/shared-utils$': '<rootDir>/../packages/shared-utils/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Disable type-checking during test runs so that pre-existing TypeScript
        // errors in source files (e.g. missing Prisma generated types, insurance.ts
        // param types) do not block the test suite from compiling.  The
        // ts-jest transformer still transpiles correctly; type safety is enforced
        // separately via `npm run typecheck` / `tsc --noEmit`.
        diagnostics: false,
      },
    ],
  },
};
