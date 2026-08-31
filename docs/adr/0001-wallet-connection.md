# ADR-0001: Multi-Wallet Connection Architecture

| Field | Value |
|-------|-------|
| **Date** | 2026-08-28 |
| **Status** | Accepted |
| **Deciders** | Frontend team |
| **Issue** | #1462 |
| **Source files** | `frontend/src/wallet/` |

---

## Context

Stellar-Save users need to connect a Stellar wallet to interact with the ROSCA smart contract — contributing funds, triggering payouts, and signing authentication challenges. At the time this decision was made:

- **Freighter** is the most widely adopted browser extension for Stellar.
- **Albedo** is a web-based wallet and signing service that requires no extension installation.
- **Lobstr** is a popular mobile-first Stellar wallet with a browser extension.
- Hardware wallet users (Ledger, Trezor) represent a smaller but security-conscious segment.
- The `@creit.tech/stellar-wallets-kit` library provides a unified adapter layer over all major Stellar browser wallets.

The original implementation used a monolithic `WalletProvider` that mixed connection state, balance polling, and transaction signing into a single context. This caused:

- Over-rendering — any balance update re-rendered all consumers including signing UI.
- Testing difficulty — mocking the entire combined context was verbose.
- Tight coupling — switching wallets required careful ordering of state resets across concerns.

---

## Decision

Adopt a **multi-wallet, decomposed provider architecture** using `@creit.tech/stellar-wallets-kit` as the underlying adapter layer, and split the monolithic provider into three focused sub-providers composed in a single root `WalletProvider`.

### Provider tree

```
WalletProvider (root, composes all)
  └── WalletConnectionProvider   — connection lifecycle
        └── WalletBalanceProvider   — balance polling (depends on connection)
              └── WalletSigningProvider   — tx/message signing
                    └── WalletContextBridge   — legacy WalletContext shim
```

### Wallet kit initialisation

The `StellarWalletsKit` singleton is initialised once at module load time with the three supported wallet modules:

```typescript
StellarWalletsKit.init({
  modules: [new FreighterModule(), new AlbedoModule(), new LobstrModule()],
  selectedWalletId: FREIGHTER_ID,
  network: Networks.TESTNET,
});
```

The default wallet is **Freighter** (`FREIGHTER_ID`), but users can switch at runtime via `switchWallet(walletId)`.

---

## Connect / Sign / Disconnect flow

```
User clicks "Connect"
        │
        ▼
WalletConnectionProvider.connect()
  ├── StellarWalletsKit.setWallet(selectedWalletId)
  ├── StellarWalletsKit.getAddress()  ──► activeAddress
  ├── StellarWalletsKit.getNetwork()  ──► network passphrase
  ├── localStorage.setItem('swk_address', address)
  └── localStorage.setItem('swk_wallet', walletId)
        │
        ▼ (status = 'connected')
WalletBalanceProvider
  └── fetchBalance()  ──► Horizon loadAccount(activeAddress)
        │  polls every 30 s
        ▼
User initiates a transaction
        │
        ▼
WalletSigningProvider.signTransaction(xdr, opts)
  └── StellarWalletsKit.signTransaction(xdr, opts)
        │  wallet extension prompts user
        ▼ signed XDR returned to caller
        │
User clicks "Disconnect"
        │
        ▼
WalletConnectionProvider.disconnect()
  ├── StellarWalletsKit.disconnect()
  ├── clears activeAddress, network, status
  └── localStorage.removeItem('swk_address' | 'swk_wallet')
```

### Session persistence

On mount, `WalletConnectionProvider` reads `swk_address` and `swk_wallet` from `localStorage` and restores the session without requiring the user to click "Connect" again. No credentials are stored — only the public address and wallet ID.

### Balance polling

`WalletBalanceProvider` polls the Stellar Horizon API every **30 seconds** when an address is connected. The Horizon URL is selected based on the `network` passphrase returned by the wallet:

| Network passphrase contains | Horizon URL |
|-----------------------------|------------|
| `PUBLIC` or `MAINNET` | `https://horizon.stellar.org` |
| anything else | `https://horizon-testnet.stellar.org` |

---

## Supported wallets

| Wallet | Module | Type | Notes |
|--------|--------|------|-------|
| Freighter | `FreighterModule` | Browser extension | Default. Direct adapter also in `freighterAdapter.ts` for legacy use |
| Albedo | `AlbedoModule` | Web-based | No extension required |
| Lobstr | `LobstrModule` | Browser extension / mobile | Extension must be installed |
| Ledger | `hardware/ledgerAdapter.ts` | Hardware | Not yet wired into the kit; available as a standalone adapter |
| Trezor | `hardware/trezorAdapter.ts` | Hardware | Not yet wired into the kit; available as a standalone adapter |

---

## Rejected alternatives

### Alternative A: Freighter-only integration

Use the `@stellar/freighter-api` package directly (the approach in `freighterAdapter.ts`).

**Rejected because:**
- Locks out users of Albedo, Lobstr, and future wallets.
- Requires manual adapter code for every new wallet.
- Does not support graceful degradation when Freighter is not installed.

`freighterAdapter.ts` is retained as a low-level utility and for legacy compatibility but is not used as the primary connection path.

### Alternative B: WalletConnect / generic WalletConnect relay

Use a WalletConnect-style relay for mobile and desktop wallet pairing.

**Rejected because:**
- No mature WalletConnect support exists for Stellar at the time of this ADR.
- Adds relay server dependency and latency.
- `@creit.tech/stellar-wallets-kit` already covers the target wallet set.

### Alternative C: Keep the monolithic `WalletProvider`

Continue using a single combined context.

**Rejected because:**
- Over-renders all consumers on every balance tick.
- Balance polling and signing are independent concerns that should be independently replaceable.
- Splitting enables targeted mocking in tests and better tree-shaking.

---

## Consequences

### Positive

- **Separation of concerns** — connection, balance, and signing are independently testable and replaceable.
- **Multi-wallet from day one** — users can switch between Freighter, Albedo, and Lobstr without a page reload.
- **Backward compatibility** — `WalletContext` shim means no existing consumers need to change.
- **Hardware wallet path** — Ledger and Trezor adapters exist and can be wired in without architectural changes.

### Negative / trade-offs

- **Provider nesting** — four nested providers at the root of the component tree add a small amount of indirection.
- **Kit singleton** — `StellarWalletsKit` is a module-level singleton; tests that import the provider must mock the kit module.
- **No WalletConnect** — users on mobile wallets that don't have a browser extension cannot connect without switching to Albedo.

---

## Hooks reference

New code should use the narrow hooks rather than importing `WalletContext` directly:

| Hook | Provider | Use for |
|------|----------|---------|
| `useWalletConnection()` | `WalletConnectionProvider` | `connect`, `disconnect`, `switchWallet`, `activeAddress`, `status` |
| `useWalletBalance()` | `WalletBalanceProvider` | `xlmBalance`, `allBalances`, `refreshBalance` |
| `useWalletSigning()` | `WalletSigningProvider` | `signTransaction`, `signMessage` |
| `useWallet()` | combined (via `hooks/useWallet.ts`) | convenience; equivalent to all three combined |

---

## Related ADRs and documents

- [ADR-001: Soroban Platform Choice](./ADR-001-soroban-platform-choice.md)
- [Manual Wallet Testing Guide](../manual-wallet-testing.md)
- [Frontend README](../../frontend/README.md)
- [Wallet connection source](../../frontend/src/wallet/)
