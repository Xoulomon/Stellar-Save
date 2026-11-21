# ADR-006: Mobile App Ownership — Capacitor Web-Wrapper vs. Expo React Native

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-10-19 |
| **Issue** | [#1946](https://github.com/Xoulomon/Stellar-Save/issues/1946) |
| **Deciders** | Engineering team |

---

## Context

Two separate mobile app projects existed in the repository simultaneously:

### Option A — Capacitor-wrapped web app (`frontend/android/`, `frontend/ios/`)

The `frontend/` workspace contains a full Capacitor setup:

- `frontend/capacitor.config.ts` — Capacitor configuration (app ID `com.stellarsave.app`)
- `frontend/android/` — Android Studio project, Gradle build, Fastlane automation
- `frontend/ios/` — Xcode project, CocoaPods, Fastlane automation
- `frontend/MOBILE_README.md` — Developer guide for the Capacitor app

CI workflows:
- `.github/workflows/mobile.yml` — builds Android APK and iOS on every PR/push to `frontend/`
- `.github/workflows/mobile-release.yml` — manual release to TestFlight and Play Console

This app wraps the web frontend (React + Vite + MUI) in a Capacitor WebView. All
web features are available on mobile without duplication.

### Option B — Expo React Native app (`mobile/`)

The `mobile/` directory contained a standalone Expo (React Native + TypeScript) app:

- Expo Router with file-based navigation
- React Navigation stack and tabs
- Native Expo modules (Camera, SecureStore, LocalAuthentication)
- Maestro E2E test flows

This app had **no CI release pipeline** and received no feature work beyond initial
scaffolding. It was planned for roadmap v4.0 ("Mobile app, fiat on/off-ramps") but
never shipped.

---

## Problem

Maintaining both projects simultaneously creates confusion:

- Contributors do not know where to add mobile features.
- Bug fixes may be applied to one shell but not the other.
- CI resources are consumed building both without clear ownership.
- The `mobile/` workspace was listed in `pnpm-workspace.yaml`, creating install-time
  overhead even though nothing depended on it.

---

## Decision

**Ship the Capacitor app** (`frontend/android/`, `frontend/ios/`). It is the app
currently in production and the one that CI builds and releases.

**Archive the Expo React Native app** to `docs/archive/mobile-expo-rn/`. It is not
deleted — the work can be recovered if the team decides to invest in a native-first
rebuild — but it is not maintained as an active workspace.

---

## Rationale

| Criterion | Capacitor (chosen) | Expo React Native (archived) |
|-----------|-------------------|------------------------------|
| Currently shipped | Yes — CI builds and releases it | No |
| CI pipeline exists | Yes (`mobile.yml`, `mobile-release.yml`) | No |
| Shares web feature work | Yes — same React codebase | No — separate screens needed |
| Native-first UX possible | Limited (WebView) | Yes |
| Maintenance cost | Low — one codebase | High — duplicate all features |
| Risk to archive | None — not in production | Recoverable from git |

At the current stage of the product (v1.0), feature velocity on the web codebase
is the priority. The Capacitor wrapper delivers mobile parity at near-zero incremental
cost. A native-first Expo rebuild becomes the right investment once the core product
is stable and native UX differences justify a separate codebase.

---

## Consequences

### Positive

- Contributors have a single clear answer to "where do mobile features go?": `frontend/`.
- CI pipeline is unambiguous: `mobile.yml` tracks `frontend/**`.
- The `mobile/` workspace is no longer installed as part of `pnpm install`.

### Negative

- Native-first mobile UX (custom animations, deep Expo module integration) requires
  reverting this decision and investing in the Expo app.
- The archived Expo shell may drift from the current API/contract shape over time.

---

## Implementation

1. `mobile/` moved to `docs/archive/mobile-expo-rn/` with an `ARCHIVE_NOTICE.md`.
2. `pnpm-workspace.yaml` updated to remove the `mobile` package.
3. `docs/mobile-app-developer-guide.md` updated to reflect the Capacitor app as the
   active target and the Expo app as archived.
4. `README.md` mobile section updated accordingly.

---

## Reverting this decision

If the team decides to invest in the Expo React Native app:

1. Move `docs/archive/mobile-expo-rn/` back to `mobile/`.
2. Add `mobile` back to `pnpm-workspace.yaml`.
3. Create a CI release pipeline for Expo (`eas build`, `eas submit`).
4. Update this ADR status to "Superseded by ADR-NNN".
5. Clearly document which features are in which app during the transition period.

---

## Related decisions

- [ADR-001: Choice of Soroban Over Other Smart Contract Platforms](./ADR-001-soroban-platform-choice.md)
- [ADR-002: Sequential Payout Order](./ADR-002-sequential-payout-order.md)
