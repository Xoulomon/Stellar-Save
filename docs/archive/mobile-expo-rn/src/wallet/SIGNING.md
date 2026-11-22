# Wallet signing flow

Implements transaction signing for mobile (#997), mirroring the web
Freighter integration's `signTransaction(xdr, opts) => signedXdr` shape from
`frontend/src/wallet/types.ts`.

- `signWithLocalKeypair` — signs synchronously with the in-app keypair (see
  #996's `keyManagement.ts` for where the secret key comes from)
- `requestExternalSignature` / `handleSigningCallback` / `cancelExternalSignature`
  — SEP-7 deep-link handoff to external Stellar wallets

## Pending-state handling

The external-signing session is held in a module-level variable, not
persisted storage. That is intentional: if the app backgrounds or is killed
mid-signature, there is nothing on disk to resume, so relaunch always starts
clean at `idle` instead of resuming a stale "pending" UI. `cancelExternalSignature`
covers the explicit user-cancel path.

## Known gap

`App.tsx` needs a `Linking.addEventListener('url', ...)` wired to
`handleSigningCallback` for the callback half of the round trip — left for
the screen/UI work that consumes this module, to keep this PR scoped to the
signing primitives themselves.
