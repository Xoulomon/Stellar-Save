/**
 * Shared ESLint flat-config base for every workspace (frontend, backend, mobile,
 * packages/sdk, packages/shared-utils, packages/events-schema).
 *
 * This is the single source of truth for the recommended presets, shared
 * rules, and common ignores. Workspace configs spread it first and add only
 * genuine overrides (runtime globals, framework plugins, stricter severities):
 *
 *   import base from '../eslint.config.base.js';
 *   export default [...base, { ... workspace-specific overrides ... }];
 *
 * The full rule list is documented in CONTRIBUTING.md ("ESLint configuration").
 * Keep the two in sync when changing a rule here.
 *
 * Do not re-apply `js.configs.recommended` / `tseslint.configs.recommended`
 * in a workspace: doing so resets the tuned rule options below to their
 * preset defaults.
 */
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').ConfigArray} */
const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // `fixToUnknown` makes `eslint --fix` rewrite `any` to `unknown`.
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true }],
      // Prefix deliberately unused bindings with `_` to opt out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // Use the workspace logger (frontend/src/utils/logger.ts,
      // backend/src/lib/logger.ts) or process.stdout/stderr in CLI scripts.
      // Only logger modules may disable this rule inline.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'import/no-cycle': ['error'],
      // Import grouping convention (external → internal → parent/sibling → index → type):
      //  1. builtin      Node built-ins (fs, path, ...)
      //  2. external     third-party packages (react, @mui, ...)
      //  3. internal     TS path aliases / workspace imports
      //  4. parent/sibling  relative imports (../, ./)
      //  5. index        index files
      //  6. object, type
      // Each group is separated by a blank line; within a group imports are
      // alphabetized ascending, case-insensitively.
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    // Test files and test runners report progress on stdout by design.
    files: [
      '**/*.test.{ts,tsx,js,mjs,cjs}',
      '**/*.spec.{ts,tsx,js,mjs,cjs}',
      '**/*.e2e.{ts,tsx}',
      '**/test/**',
      '**/tests/**',
      '**/tests-e2e/**',
      '**/e2e/**',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts'],
  }
);

export default base;
