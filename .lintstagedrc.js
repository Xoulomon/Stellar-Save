module.exports = {
  // Use each workspace's flat config explicitly because lint-staged runs at the repository root.
  // Backend files have existing warnings, so report them without blocking commits.
  'backend/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config backend/eslint.config.mjs',
    'prettier --check',
  ],
  'frontend/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config frontend/eslint.config.js --max-warnings 0',
    'prettier --check',
  ],
  'mobile/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config mobile/eslint.config.js --max-warnings 0',
    'prettier --check',
  ],

  // CSS files (frontend): stylelint
  'frontend/**/*.css': ['stylelint'],

  // JSON and YAML: format check
  '*.{json,yaml,yml}': ['prettier --check'],

  // Markdown: format check
  '*.md': ['prettier --check'],
};
