/**
 * Shared ESLint flat-config base.
 * Extend in each package's eslint.config.js:
 *
 *   import base from '../../eslint.config.base.js';
 *   export default [...base, { ... package-specific rules ... }];
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').ConfigArray} */
const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts'],
  },
);

export default base;
