import base from '../eslint.config.base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export default [
  ...base,
  {
    ignores: ['.expo/**', 'android/**', 'ios/**'],
  },
];
