/**
 * Shared ESLint flat-config base.
 * Extend in each package's eslint.config.js:
 *
 *   import base from '../../eslint.config.base.js';
 *   export default [...base, { ... package-specific rules ... }];
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

/** @type {import('typescript-eslint').ConfigArray} */
const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
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
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts'],
  },
);

export default base;
