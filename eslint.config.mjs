/**
 * Root ESLint config.
 *
 * Covers only the repo-level tooling files (this config, the shared base,
 * commitlint and lint-staged configs). Each workspace (frontend, backend,
 * mobile, packages/*) owns its own `eslint.config.*` that spreads the shared
 * base; the pre-commit hook resolves it per file via ESLint's
 * `v10_config_lookup_from_file` flag.
 */
import base from './eslint.config.base.js';

export default [
  ...base,
  {
    files: ['.lintstagedrc.js', 'commitlint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
  {
    // Everything below the root is linted by the nearest workspace config.
    ignores: ['*/**'],
  },
];
