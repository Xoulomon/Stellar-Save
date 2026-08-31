# Mobile App Developer & Contributor Guide

This guide covers local setup, project structure, build/release, and troubleshooting for
the Stellar-Save **React Native** mobile app (planned for
[v4.0 on the roadmap](roadmap.md#v40--mobile-app--fiat-onoff-ramps)). It uses
[Expo](https://expo.dev/) to keep iOS/Android builds reproducible without requiring native
Xcode/Android Studio setup for day-to-day contribution.

> This is distinct from [mobile-app-guide.md](mobile-app-guide.md), which is the **end-user**
> guide for the existing mobile-responsive PWA (the web app, not this native app).

---

## 1. Local Setup

### Prerequisites
- Node.js (same version as [`/.env.example`](../.env.example) / root `package.json` engines)
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli` (or use `npx expo`)
- Xcode (macOS only, for the iOS simulator) or Android Studio (for the Android emulator)
- The [Expo Go](https://expo.dev/client) app on a physical device, as an alternative to a simulator

### Install and run

```bash
cd mobile
npm install
npx expo start
```

This opens the Expo developer tools in your browser. From there:
- Press `i` to launch the iOS simulator (macOS only)
- Press `a` to launch the Android emulator
- Scan the QR code with the Expo Go app to run on a physical device

### Environment configuration

The mobile app talks to the same backend and Soroban contract as the web app. Copy the root
[`.env.example`](../.env.example) conventions into `mobile/.env`, prefixed for Expo:

```bash
EXPO_PUBLIC_STELLAR_NETWORK=testnet
EXPO_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/api/v2
EXPO_PUBLIC_CONTRACT_ID=
```

Expo only exposes variables prefixed `EXPO_PUBLIC_` to client code — never put secrets here.
See [ENVIRONMENT.md](../ENVIRONMENT.md) for how this maps to the backend/contract config the
mobile app depends on.

---

## 2. Project Structure and Conventions

```
mobile/
  app/                # Screens, using Expo Router's file-based routing
    (tabs)/           # Bottom tab navigator: Home, Groups, History, Settings
    group/[id].tsx    # Dynamic route for a single group's detail screen
  components/         # Shared, presentational components
  hooks/              # Shared hooks (wallet connection, contract reads, etc.)
  lib/                 # Non-UI logic: API client, Soroban RPC client, formatting
  state/               # App-level state (see below)
  assets/
```

- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) — routes are
  derived from the `app/` directory structure, mirroring the web app's URL structure where
  practical so deep links stay consistent across platforms.
- **State management**: local component state (`useState`) for screen-local concerns;
  shared state (wallet connection, active group) lives in lightweight context providers
  under `state/`, mirroring the pattern already used in [frontend/src](../frontend/src) —
  do not introduce a new state library without discussing it first.
- **Styling**: React Native `StyleSheet`, not CSS — visual conventions should track the web
  app's design tokens where one-to-one screens exist (e.g. group cards, contribution flow).

---

## 3. Build & Release Pipeline

The app is built with [EAS Build](https://docs.expo.dev/build/introduction/) for both
platforms.

```bash
npx eas build --platform ios --profile preview      # internal TestFlight build
npx eas build --platform android --profile preview  # internal APK/AAB
npx eas build --platform all --profile production   # store-ready builds
```

Build profiles are defined in `mobile/eas.json`:
- `preview` — internal distribution for QA, signed with the internal distribution
  certificate/keystore.
- `production` — store submission build, signed with the App Store / Play Store release
  credentials.

### Signing

- **iOS**: managed via `eas credentials`, which stores the distribution certificate and
  provisioning profile on Expo's servers. Do not commit `.p12`/`.mobileprovision` files to
  the repo.
- **Android**: the release keystore is managed the same way via `eas credentials`; never
  commit the keystore or its password.

### Submitting

```bash
npx eas submit --platform ios
npx eas submit --platform android
```

Release builds should only be submitted from `main` after the corresponding web/backend
release has been verified, since the mobile app shares the same contract/backend contracts.

---

## 4. Troubleshooting

### Metro bundler won't start / stale cache
```bash
npx expo start --clear
```

### "Unable to resolve module" after pulling new dependencies
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### iOS simulator doesn't open
Confirm Xcode's command-line tools are selected: `xcode-select -p` should point at
`/Applications/Xcode.app/Contents/Developer`. Reinstall with `xcode-select --install` if not.

### Android emulator is slow or won't boot
Ensure hardware acceleration (HAXM/KVM) is enabled in Android Studio's AVD Manager — running
without it makes the emulator unusably slow.

### Wallet connection / deep link doesn't return to the app
Native deep links require the URL scheme registered in `app.json` (`expo.scheme`) to match
the scheme the wallet app redirects back to. If this drifts, wallet sign-in will silently
fail to return control to the app — verify the scheme matches the wallet integration's
configured redirect.

### EAS build fails with a credentials error
Run `npx eas credentials` and confirm the correct Apple/Google account is selected — this is
the most common cause of build failures after switching machines or team accounts.

---

## 5. Contributing

Follow the same workflow as the rest of the repo — see [CONTRIBUTING.md](../CONTRIBUTING.md)
for branch naming, commit conventions, and PR process. Mobile-specific PRs should be tested
on both a simulator/emulator and, where the change touches wallet signing or deep links, a
physical device before review.
