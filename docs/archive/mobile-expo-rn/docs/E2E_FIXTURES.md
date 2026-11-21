# E2E Test Fixtures & Mock Data

This document describes all fixture data, mock configuration, and environment
variables required to run the Maestro onboarding E2E flows.

---

## Test User Fixtures

### KYC form fields (happy path)

Used in `onboarding_kyc_form.yaml` and `onboarding_full.yaml`.

| Field | Value |
|-------|-------|
| Full name | `Ada Okafor` |
| Date of birth | `1990-09-25` (YYYY-MM-DD) |
| Country | `NG` (ISO 3166-1 alpha-2 for Nigeria) |
| Document image | Camera capture (mock/real depending on environment — see below) |

### Wallet import fixture

Used in `onboarding_wallet_setup.yaml` (import path).

| Field | Value |
|-------|-------|
| Secret key | `SCZANGBA5RLMQ7OXHD68DROGQUMASY7JX7WBWZAJZCCPVXZJHM7AYFN` |
| Derived public key | `GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3` |
| Network | Testnet |

> **Security note**: These are dedicated test-only keypairs funded on
> Stellar testnet. They must never be used on mainnet. Rotate them if they
> appear in any mainnet context.

### PIN fixture

Used in `onboarding_biometric_auth.yaml`.

| Field | Value |
|-------|-------|
| PIN | `1234` |

The test PIN is stored via the real `savePin()` flow during the first-run
onboarding sequence. For flows that skip onboarding, seed the PIN by launching
the app with the `MAESTRO_TEST_PIN=1234` environment variable; the app's test
shim calls `savePin` before rendering the auth gate.

---

## Environment Variables

The following environment variables are consumed by the app's **E2E test shim**
(loaded only in `__DEV__` + `MAESTRO_TESTING=true` builds). They allow Maestro
flows to seed state without tapping through the full flow every time.

| Variable | Values | Effect |
|----------|--------|--------|
| `MAESTRO_TESTING` | `true` | Activates the E2E shim layer |
| `MAESTRO_BIOMETRIC_AVAILABLE` | `true` / `false` | Overrides `checkBiometricSupport()` result |
| `MAESTRO_KYC_STATUS` | `pending` / `approved` / `rejected` / `expired` | Seeds `KycStatusScreen` without a real API call |
| `MAESTRO_TEST_PIN` | `1234` | Pre-seeds the PIN via `savePin()` before auth gate renders |
| `MAESTRO_SKIP_WALLET_SETUP` | `true` | Skips wallet creation and goes straight to KYC form |

These variables are passed via Maestro's `launchApp.env` block:

```yaml
- launchApp:
    clearState: true
    env:
      MAESTRO_TESTING: "true"
      MAESTRO_KYC_STATUS: "approved"
```

---

## Document Capture Behaviour by Environment

### Local emulator (Android AVD / iOS Simulator)

The `expo-camera` module returns a real photo taken by the virtual camera.
The AVD default scene is a striped test pattern — this is fine for E2E
purposes; the KYC backend mock accepts any non-empty base64 string.

Set the AVD camera to "VirtualScene" in the emulator's Extended Controls
(`... → Camera → Back Camera → VirtualScene`) for the most realistic test.

### CI (headless / no camera)

When running in a CI environment where no camera is available, the app's E2E
shim replaces `CameraView.takePictureAsync` with a stub that returns a 1×1
transparent PNG encoded as base64. This keeps the flow working end-to-end
without hardware.

Enable the stub by setting:
```yaml
    env:
      MAESTRO_TESTING: "true"
```

The shim is in `mobile/src/lib/e2eShim.ts` (loaded only when
`MAESTRO_TESTING === 'true'`).

### Real device

Approve the camera permission dialog when it appears. Point the camera at any
flat surface — the photo is submitted to the KYC mock server which accepts all
non-empty images.

---

## Backend Mock Server

The onboarding flows hit the KYC endpoint at:

```
POST /api/kyc/submit
GET  /api/kyc/status
```

For local and CI runs, use the included mock server:

```bash
# Start the mock backend (from the repo root)
node mobile/scripts/mock-kyc-server.js
```

The mock server:
- Accepts all `POST /api/kyc/submit` requests and returns `{ status: "pending" }`
- Returns the status configured by `MAESTRO_KYC_STATUS` (or `pending` by default)
  on `GET /api/kyc/status`
- Runs on `http://localhost:3001` — set `EXPO_PUBLIC_API_URL=http://localhost:3001`
  in `mobile/.env.test`

---

## KYC API Test Credentials

| Field | Value |
|-------|-------|
| API base URL | `http://localhost:3001` (mock) / `https://staging.stellar-save.example.com` (staging) |
| Auth token | `test-jwt-token-for-e2e` (accepted by mock server) |
| User ID | `e2e-test-user-onboarding` |

---

## Testnet Account

For flows that require a funded testnet account:

```
Public key:  GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3
Secret key:  SCZANGBA5RLMQ7OXHD68DROGQUMASY7JX7WBWZAJZCCPVXZJHM7AYFN
Network:     Testnet (https://horizon-testnet.stellar.org)
Balance:     10 000 XLM (pre-funded via Friendbot)
```

To re-fund if the balance drops:
```bash
curl "https://friendbot.stellar.org?addr=GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3"
```

---

## testID Reference

The table below maps Maestro `id:` selectors to React Native `testID` props
and the component that owns them. If a screen component is updated, ensure
these testIDs remain stable.

### WelcomeScreen

| `testID` | Component | Notes |
|----------|-----------|-------|
| `welcome-screen` | `WelcomeScreen` root `View` | |
| `get-started-button` | `Pressable` "Get started" | |

### WalletSetupScreen

| `testID` | Component | Notes |
|----------|-----------|-------|
| `wallet-setup-screen` | `WalletSetupScreen` root `View` | |
| `create-wallet-button` | `Pressable` "Create a new wallet" | |
| `import-wallet-button` | `Pressable` "Import existing wallet" | |
| `wallet-setup-done` | Success indicator shown after async wallet creation | |
| `import-wallet-screen` | Root `View` of import screen | |
| `secret-key-input` | `TextInput` for secret key | |
| `import-wallet-confirm-button` | `Pressable` "Import" | |

### KycFormScreen

| `testID` | Component | Notes |
|----------|-----------|-------|
| `kyc-form-screen` | `KycFormScreen` root `View` | |
| `kyc-full-name-input` | `TextInput` `placeholder="Full name"` | |
| `kyc-dob-input` | `TextInput` `placeholder="Date of birth (YYYY-MM-DD)"` | |
| `kyc-country-input` | `TextInput` `placeholder="Country (e.g. US)"` | |
| `kyc-capture-document-button` | `Pressable` "Capture ID document" | |
| `kyc-camera-viewfinder` | `CameraView` | Visible after permission granted |
| `kyc-enable-camera-button` | `Pressable` "Enable camera" | Shown when permission denied |
| `kyc-submit-button` | `Pressable` "Submit" | |
| `kyc-submitting-indicator` | `ActivityIndicator` | Visible during API call |
| `kyc-error-full-name` | `Text` error for fullName | |
| `kyc-error-dob` | `Text` error for dateOfBirth | |
| `kyc-error-country` | `Text` error for country | |
| `kyc-error-document` | `Text` error for documentImageBase64 | |

### KycStatusScreen

| `testID` | Component | Notes |
|----------|-----------|-------|
| `kyc-status-screen` | `KycStatusScreen` root `View` | |
| `kyc-status-title` | `Text` title | Content varies by status |
| `kyc-status-body` | `Text` body | Content varies by status |
| `continue-to-app-button` | `Pressable` (pending/approved) | |
| `kyc-resubmit-button` | `Pressable` (rejected/expired) | |

### AuthGate / PinScreen

| `testID` | Component | Notes |
|----------|-----------|-------|
| `pin-screen` | `PinScreen` root `View` | |
| `pin-key-0` … `pin-key-9` | `TouchableOpacity` number pad keys | |
| `pin-key-backspace` | `TouchableOpacity` "⌫" | |
| `pin-error-message` | `Text` error display | |
| `pin-dot-0-empty` … `pin-dot-3-empty` | Unfilled dot indicators | |

---

## Adding New Fixtures

1. Add the fixture value to this file under the relevant section.
2. If the fixture is an environment variable, add it to the table in
   "Environment Variables" and implement handling in `src/lib/e2eShim.ts`.
3. Reference the fixture in the relevant `.yaml` flow with a comment pointing
   back to this document: `# fixture: see mobile/docs/E2E_FIXTURES.md`.
4. If the fixture involves a testID not yet in the component, add it in
   the same PR that adds the flow step — keep testIDs and flows in sync.
