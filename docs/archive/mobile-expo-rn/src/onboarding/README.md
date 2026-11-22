# Onboarding & KYC (#998)

Multi-step onboarding: `WelcomeScreen` → `WalletSetupScreen` → `KycFormScreen` → `KycStatusScreen`.

- `kyc/kycApi.ts` — client for the existing backend KYC endpoints
  (`backend/src/routes/kyc.ts`: `POST /api/kyc/submit`, `GET /api/kyc/status`),
  plus `pollKycStatus` for polling until a terminal state
- `kyc/validation.ts` — client-side validation that blocks malformed
  submissions before they hit the backend
- `kyc/kycGate.ts` — `canAccessFiatRamp(status)`; fiat ramp screens should
  check this and redirect to `KycStatusScreen` otherwise. `pending` counts as
  "clearly in-progress" per the acceptance criteria, so it does not block
  access — only missing/`rejected`/`expired` does.
- `KycFormScreen` captures the ID document via `expo-camera`
  (`CameraView.takePictureAsync`) rather than a gallery picker, per the
  "document capture (camera)" requirement.

## Known gap

The screen wiring (navigation stack tying these four screens together, and
the fiat-ramp route guard actually calling `canAccessFiatRamp`) is left for
whoever integrates this into `mobile/src/navigation` — this PR scopes to the
onboarding screens and KYC client/validation/gating logic themselves.
