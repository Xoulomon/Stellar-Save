# Stellar Save Mobile

Native iOS/Android app built with Expo (React Native + TypeScript). This is
the v4.0 native mobile app, distinct from the Capacitor-based web wrapper in
`frontend/` (see `frontend/MOBILE_README.md`).

## Status

Scaffold only (#995). Wallet creation (#996), signing (#997), and onboarding/
KYC (#998) are tracked as separate follow-up issues and land as their own
PRs on top of this structure.

## Local run

```bash
cd mobile
pnpm install
pnpm start        # opens Expo Dev Tools
pnpm ios          # run in iOS simulator (requires Xcode)
pnpm android      # run in Android emulator (requires Android Studio)
```

## Project structure

```
mobile/
  App.tsx              # app entry
  src/
    navigation/         # React Navigation tree
    screens/             # screen components
  app.json              # Expo config
```

## Conventions

ESLint/Prettier extend the repo-root configs (`eslint.config.base.js`,
`.prettierrc`). Commit messages are linted by the root `commitlint.config.js`
via husky, same as `frontend/` and `backend/`.
