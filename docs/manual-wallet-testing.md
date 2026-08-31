# Manual Wallet Testing Checklist

Use this checklist to verify signing flows on real devices/extensions before
a release. The automated suite in `frontend/src/test/wallet-compat/` covers
mocked flows; this document covers the cases that require a real wallet.

> **Automation status** — Items labelled **✅ AUTOMATED** are covered by
> `frontend/e2e/wallet-automation.spec.ts` and run in CI via the Playwright
> E2E suite. Items labelled **🔲 MANUAL** require a real wallet extension,
> mobile device, or hardware device and **must be run by a human before every
> release**. Do not skip MANUAL items.

## Supported wallets

| Wallet | Environment | Notes |
|---|---|---|
| Freighter | Browser extension (Chrome/Firefox/Brave) | Primary wallet |
| Albedo | Web-based (no extension required) | Works on all browsers |
| Lobstr | Mobile app + browser extension | Check both paths |
| In-App | Embedded WebView (Capacitor mobile build) | Android + iOS |

## Pre-requisites

- [ ] Testnet account funded via Friendbot (`https://friendbot.stellar.org?addr=<address>`)
- [ ] Backend running locally or pointing to staging
- [ ] Correct network set in each wallet (Testnet)

## Connect flow

> **✅ AUTOMATED (mock)** — `wallet-automation.spec.ts › AUTOMATED – Connect flow`
> covers mock wallet inject, address in header, and localStorage persistence.
>
> 🔲 **MANUAL (real extension required)** — the items below require a real
> browser extension popup and cannot be automated without a real wallet.

Repeat for each wallet:

- [ ] 🔲 **MANUAL** — **Freighter** — click Connect Wallet, select Freighter, approve in extension popup
- [ ] 🔲 **MANUAL** — **Albedo** — click Connect Wallet, select Albedo, approve in Albedo modal
- [ ] 🔲 **MANUAL** — **Lobstr** — click Connect Wallet, select Lobstr, approve in extension or mobile app
- [ ] 🔲 **MANUAL** — **In-App** (Capacitor) — wallet is pre-configured; tap Connect on the mobile build

Expected: connected address appears truncated (first 6 + last 4 chars) in the header.

## Sign flow

After connecting with each wallet, create a group contribution:

> 🔲 **MANUAL (all items)** — Sign flows require the real wallet extension or
> device to present and sign an XDR payload. Cannot be automated without a
> browser extension under Playwright's control.

- [ ] 🔲 **MANUAL** — **Freighter** — sign contribution XDR, extension popup appears, approve
- [ ] 🔲 **MANUAL** — **Albedo** — sign contribution XDR, Albedo signing modal appears, approve
- [ ] 🔲 **MANUAL** — **Lobstr** — sign contribution XDR, approve in extension or mobile app
- [ ] 🔲 **MANUAL** — **In-App** — sign contribution XDR via embedded wallet, confirm prompt appears

Expected: transaction submitted successfully, contribution appears in group history.

## Reject flow

> **✅ AUTOMATED (mock)** — `wallet-automation.spec.ts › AUTOMATED – Reject flow`
> verifies that button returns to idle and address is not shown after rejection.
>
> 🔲 **MANUAL** — The real-extension popups below require a human to click
> "Cancel" / "Deny" inside the wallet UI.

Repeat for each wallet:

- [ ] 🔲 **MANUAL** — **Freighter** — click Connect, decline in extension popup; UI returns to idle
- [ ] 🔲 **MANUAL** — **Albedo** — click Connect, close Albedo modal without approving; UI returns to idle
- [ ] 🔲 **MANUAL** — **Lobstr** — click Connect, deny in extension; UI returns to idle
- [ ] 🔲 **MANUAL** — **In-App** — tap Connect, dismiss the signing prompt; UI returns to idle

Expected: error state shown briefly (if any), button returns to "Connect Wallet" and is not disabled.

- [ ] 🔲 **MANUAL** — **Sign rejection** — start a contribution, reject the signing prompt in each wallet

Expected: contribution not submitted, error toast shown, user can retry.

## Disconnect flow

> **✅ AUTOMATED (mock)** — `wallet-automation.spec.ts › AUTOMATED – Disconnect flow`
> verifies that `localStorage` keys `swk_address` / `swk_wallet` are cleared
> and the Connect Wallet button returns.
>
> 🔲 **MANUAL** — Real-extension variants below are manual only.

After connecting with each wallet:

- [ ] 🔲 **MANUAL** — **Freighter** — open wallet menu, click Disconnect; address clears, status returns to idle
- [ ] 🔲 **MANUAL** — **Albedo** — click Disconnect; status returns to idle
- [ ] 🔲 **MANUAL** — **Lobstr** — click Disconnect; status returns to idle
- [ ] 🔲 **MANUAL** — **In-App** — tap Disconnect in profile/settings; status returns to idle

Expected: localStorage cleared (`swk_address`, `swk_wallet` keys absent), header shows Connect Wallet.

## Network mismatch

> **✅ AUTOMATED (mock)** — `wallet-automation.spec.ts › AUTOMATED – Network mismatch`
> injects a wrong-passphrase mock and asserts the app either shows an error or
> refuses to show the connected address.
>
> 🔲 **MANUAL** — Real wallet network-switch steps below require the human to
> configure the wallet extension to a different network.

- [ ] 🔲 **MANUAL** — Set Freighter to Mainnet, attempt to connect on the Testnet app
- [ ] 🔲 **MANUAL** — Set Albedo to a different passphrase, attempt to sign

Expected: app shows a clear error ("wrong network" or similar), does not proceed with the transaction.

## Session restore

> **✅ AUTOMATED** — `wallet-automation.spec.ts › AUTOMATED – Session restore`
> seeds `localStorage` with wallet keys and verifies the address is restored
> on reload without re-prompting. Also verifies that a clean session shows the
> Connect Wallet button.

- [x] ✅ **AUTOMATED** — Connect with any wallet, reload the page

Expected: previously connected address is restored from localStorage, status is "connected" without re-prompting.

## Mobile-specific (Capacitor build)

> 🔲 **MANUAL (all items)** — Requires a real Android or iOS device running the
> Capacitor build. Cannot be automated via Playwright in the standard CI
> environment.

Run on a real device (Android + iOS):

- [ ] 🔲 **MANUAL** — App opens and wallet initialises without crash
- [ ] 🔲 **MANUAL** — Connect flow completes within 5 s on a mid-range device
- [ ] 🔲 **MANUAL** — Sign flow completes and transaction is submitted
- [ ] 🔲 **MANUAL** — Disconnect clears state and the wallet screen returns to idle
- [ ] 🔲 **MANUAL** — Deep-link back to app after wallet approval works (Android intent / iOS universal link)

## Automated test reference

The following E2E tests cover the automatable subset of this checklist:

| Test suite | File | Checklist section |
|---|---|---|
| `AUTOMATED – Connect flow` | `frontend/e2e/wallet-automation.spec.ts` | Connect flow |
| `AUTOMATED – Reject flow` | `frontend/e2e/wallet-automation.spec.ts` | Reject flow |
| `AUTOMATED – Disconnect flow` | `frontend/e2e/wallet-automation.spec.ts` | Disconnect flow |
| `AUTOMATED – Session restore` | `frontend/e2e/wallet-automation.spec.ts` | Session restore |
| `AUTOMATED – Network mismatch` | `frontend/e2e/wallet-automation.spec.ts` | Network mismatch |
| `AUTOMATED – Deliberate-break test` | `frontend/e2e/wallet-automation.spec.ts` | (detection gate) |

Run automated tests:

```bash
cd frontend && npx playwright test e2e/wallet-automation.spec.ts
```

## Notes section

Record any wallet-specific issues found during testing:

| Wallet | Version | Issue | Severity | Workaround |
|---|---|---|---|---|
| | | | | |
