module.exports = {
  // Run ESLint with the flat config owned by each workspace.
  'backend/src/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config backend/eslint.config.mjs --quiet',
    'prettier --check',
  ],
  'backend/tests/{unit,integration,fixtures,helpers}/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config backend/eslint.config.mjs --quiet',
    'prettier --check',
  ],
  'backend/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config backend/eslint.config.mjs --quiet',
    'prettier --check',
  ],
  'backend/tests/e2e/**/*.{ts,tsx,js,jsx,mjs,cjs}': ['prettier --check'],
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
