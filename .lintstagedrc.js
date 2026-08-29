module.exports = {
  // TypeScript and JavaScript files: lint + format check
  '*.{ts,tsx}': ['eslint --max-warnings 0', 'prettier --check'],
  '*.{js,jsx,mjs,cjs}': ['eslint --max-warnings 0', 'prettier --check'],

  // CSS files (frontend): stylelint
  'frontend/**/*.css': ['stylelint'],

  // JSON and YAML: format check
  '*.{json,yaml,yml}': ['prettier --check'],

  // Markdown: format check
  '*.md': ['prettier --check'],
};
