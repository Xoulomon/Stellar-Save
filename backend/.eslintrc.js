module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2020: true,
  },
  ignorePatterns: ['dist/', 'node_modules/'],
  rules: {
    '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true }],
  },
  overrides: [
    {
      files: ['src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/fixtures/**', '**/tests/fixtures/**', '../tests/fixtures/*', '../../tests/fixtures/*'],
                message:
                  'Production code under src/ must not import test fixtures. Use real data paths or inject a repository instead.',
              },
            ],
          },
        ],
      },
    },
  ],
};
