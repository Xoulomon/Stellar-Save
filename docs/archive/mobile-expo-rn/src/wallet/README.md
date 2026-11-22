# Wallet key management

Implements in-app Stellar wallet creation and key storage (#996).

- `keyManagement.ts` — `createWallet`, `importFromSecretKey`, `getActiveWallet`
- `secureStore.ts` — thin wrapper over `expo-secure-store`; the only place
  the raw secret key is ever read or written

## Security invariants

- Secret keys are written exclusively via `secureStore.ts` (Keychain on iOS,
  Keystore on Android) and are never passed to `console.*`, analytics, or
  `AsyncStorage`.
- `createWallet`/`importFromSecretKey` return the secret key once to the
  caller (for the one-time backup screen) and otherwise it stays inside
  secure storage.

## Known gap

Recovery-phrase backup/import (`importFromRecoveryPhrase`) needs a BIP-39
mnemonic library (stellar-sdk doesn't include one) — left as a follow-up,
see TODO in `keyManagement.ts`.
