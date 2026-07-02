# Manual Wallet Testing Checklist

Use this checklist to verify signing flows on real devices/extensions before
a release. The automated suite in `frontend/src/test/wallet-compat/` covers
mocked flows; this document covers the cases that require a real wallet.

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

Repeat for each wallet:

- [ ] **Freighter** - click Connect Wallet, select Freighter, approve in extension popup
- [ ] **Albedo** - click Connect Wallet, select Albedo, approve in Albedo modal
- [ ] **Lobstr** - click Connect Wallet, select Lobstr, approve in extension or mobile app
- [ ] **In-App** (Capacitor) - wallet is pre-configured; tap Connect on the mobile build

Expected: connected address appears truncated (first 6 + last 4 chars) in the header.

## Sign flow

After connecting with each wallet, create a group contribution:

- [ ] **Freighter** - sign contribution XDR, extension popup appears, approve
- [ ] **Albedo** - sign contribution XDR, Albedo signing modal appears, approve
- [ ] **Lobstr** - sign contribution XDR, approve in extension or mobile app
- [ ] **In-App** - sign contribution XDR via embedded wallet, confirm prompt appears

Expected: transaction submitted successfully, contribution appears in group history.

## Reject flow

Repeat for each wallet:

- [ ] **Freighter** - click Connect, decline in extension popup; UI returns to idle
- [ ] **Albedo** - click Connect, close Albedo modal without approving; UI returns to idle
- [ ] **Lobstr** - click Connect, deny in extension; UI returns to idle
- [ ] **In-App** - tap Connect, dismiss the signing prompt; UI returns to idle

Expected: error state shown briefly (if any), button returns to "Connect Wallet" and is not disabled.

- [ ] **Sign rejection** - start a contribution, reject the signing prompt in each wallet

Expected: contribution not submitted, error toast shown, user can retry.

## Disconnect flow

After connecting with each wallet:

- [ ] **Freighter** - open wallet menu, click Disconnect; address clears, status returns to idle
- [ ] **Albedo** - click Disconnect; status returns to idle
- [ ] **Lobstr** - click Disconnect; status returns to idle
- [ ] **In-App** - tap Disconnect in profile/settings; status returns to idle

Expected: localStorage cleared (`swk_address`, `swk_wallet` keys absent), header shows Connect Wallet.

## Network mismatch

- [ ] Set Freighter to Mainnet, attempt to connect on the Testnet app
- [ ] Set Albedo to a different passphrase, attempt to sign

Expected: app shows a clear error ("wrong network" or similar), does not proceed with the transaction.

## Session restore

- [ ] Connect with any wallet, reload the page

Expected: previously connected address is restored from localStorage, status is "connected" without re-prompting.

## Mobile-specific (Capacitor build)

Run on a real device (Android + iOS):

- [ ] App opens and wallet initialises without crash
- [ ] Connect flow completes within 5 s on a mid-range device
- [ ] Sign flow completes and transaction is submitted
- [ ] Disconnect clears state and the wallet screen returns to idle
- [ ] Deep-link back to app after wallet approval works (Android intent / iOS universal link)

## Notes section

Record any wallet-specific issues found during testing:

| Wallet | Version | Issue | Severity | Workaround |
|---|---|---|---|---|
| | | | | |
