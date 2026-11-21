# Archive Notice — Expo React Native App (`mobile/`)

**Archived:** 2026-10-19  
**Issue:** [#1946](https://github.com/Xoulomon/Stellar-Save/issues/1946)  
**ADR:** [docs/adr/ADR-006-mobile-app-ownership.md](../adr/ADR-006-mobile-app-ownership.md)

## What this is

The `mobile-expo-rn/` directory is the original standalone Expo (React Native) app
that was developed as a future v4.0 roadmap item. It uses Expo Router, React
Navigation, and Expo modules.

## Why it was archived

An audit in October 2026 found two separate native mobile projects in the repository:

1. **`frontend/android/` + `frontend/ios/`** — Capacitor-wrapped version of the
   web frontend. This is the app currently built by CI (`mobile.yml`) and released
   to TestFlight / Play Console (`mobile-release.yml`). It shares the web codebase,
   meaning all web features automatically appear on mobile.

2. **`mobile/` (this directory)** — A standalone Expo React Native shell. It was
   planned for roadmap v4.0 but never shipped. It has no CI release pipeline and
   receives no feature work.

Keeping both active confused contributors about where to add mobile features.
The decision recorded in ADR-006 is to **continue shipping the Capacitor app**
(in `frontend/`) and archive this Expo shell until a concrete decision is made
to invest in a native-first rebuild.

## Restoration

If the team decides to resume the Expo app:

1. Move the directory back: `git mv docs/archive/mobile-expo-rn mobile`
2. Add it back to `pnpm-workspace.yaml`
3. Update the CI workflows
4. Revise ADR-006 to reflect the new decision
