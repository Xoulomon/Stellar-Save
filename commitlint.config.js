// Scope values are kept in sync with the monorepo layout defined in
// `pnpm-workspace.yaml`: the workspace packages below, plus the repo-wide
// areas that are not pnpm packages (contracts, database, docs, ci, deps,
// release). A scope is optional; when one is supplied it must be in this list.
const scopes = [
  // pnpm workspace packages
  'frontend',
  'backend',
  'mobile',
  'sdk',
  'shared-utils',
  'events-schema',
  // repo-wide areas
  'contracts',
  'database',
  'docs',
  'ci',
  'deps',
  'release',
];

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    'scope-enum': [2, 'always', scopes],
    'subject-max-length': [2, 'always', 100],
  },
};
