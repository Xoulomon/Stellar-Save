import base from '../../eslint.config.base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export default [
  ...base,
  {
    // codegen / drift-check scripts are plain CommonJS Node CLIs.
    files: ['*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Output of codegen.js; regenerate instead of hand-editing.
    ignores: ['generated/**'],
  },
];
