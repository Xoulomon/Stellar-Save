// lint-staged runs from the repo root, so resolve each file's config from its
// own directory (frontend/, backend/, mobile/, packages/* or the root
// eslint.config.mjs)
// instead of only looking in the cwd. Files outside every config's scope are
// skipped silently rather than failing --max-warnings 0.
const eslint = 'eslint --flag v10_config_lookup_from_file --no-warn-ignored --max-warnings 0';

module.exports = {
  // TypeScript and JavaScript files: lint + format check
  '*.{ts,tsx}': [eslint, 'prettier --check'],
  '*.{js,jsx,mjs,cjs}': [eslint, 'prettier --check'],

  // CSS files (frontend): stylelint
  'frontend/**/*.css': ['stylelint'],

  // JSON and YAML: format check
  '*.{json,yaml,yml}': ['prettier --check'],

  // Markdown: format check
  '*.md': ['prettier --check'],
};
