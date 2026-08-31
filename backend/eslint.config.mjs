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
    ignores: ['dist', 'coverage', 'src/generated/**'],
  },
);
