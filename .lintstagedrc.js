module.exports = {
  // TypeScript and JavaScript files: lint + format check
  'frontend/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config frontend/eslint.config.js --max-warnings 0',
    'prettier --check',
  ],
  'backend/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config backend/eslint.config.mjs --max-warnings 0',
    'prettier --check',
  ],
  'mobile/**/*.{ts,tsx,js,jsx,mjs,cjs}': [
    'eslint --config mobile/eslint.config.js --max-warnings 0',
    'prettier --check',
  ],
  'packages/**/*.{ts,tsx}': [
    'eslint --config eslint.config.base.js --max-warnings 0',
    'prettier --check',
  ],
  '*.{js,jsx,mjs,cjs}': [
    'eslint --config eslint.config.base.js --global module --max-warnings 0',
    'prettier --check',
  ],

  // CSS files (frontend): stylelint
  'frontend/**/*.css': ['stylelint'],

  // JSON and YAML: format check
  '*.{json,yaml,yml}': ['prettier --check'],

  // Markdown: format check
  '*.md': ['prettier --check'],
};
