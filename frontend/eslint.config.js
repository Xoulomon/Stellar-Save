import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ── Type safety ──────────────────────────────────────────────────────────
      // Forbid `any` — forces explicit types and prevents type-safety gaps.
      // Use `unknown` + type guards, or `// eslint-disable-next-line` with a
      // comment explaining why `any` is justified (e.g. third-party untyped API).
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Dead code ────────────────────────────────────────────────────────────
      // Catch unused variables, imports, and parameters.
      // Prefix with `_` to explicitly mark intentionally unused identifiers.
      'no-unused-vars': 'off',                         // disabled in favour of TS-aware rule
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',        // _param — intentionally unused arg
          varsIgnorePattern: '^_',        // _local — intentionally unused var
          caughtErrorsIgnorePattern: '^_', // catch (_err) { ... }
          ignoreRestSiblings: true,       // const { used, ...rest } = obj
        },
      ],
    },
  },
])
