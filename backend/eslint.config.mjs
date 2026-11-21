import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from '../eslint.config.base.js';

export default tseslint.config(
  ...base,
  {
    files: ['**/*.{ts,js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    // Test mocks often use mock implementations and stubs
    files: [
      '**/*.test.{ts,tsx,js,mjs,cjs}',
      '**/*.spec.{ts,tsx,js,mjs,cjs}',
      '**/test/**',
      '**/tests/**',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['src/generated/**'],
  }
);
