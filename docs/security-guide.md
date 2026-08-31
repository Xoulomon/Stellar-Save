ut# Stellar-Save Security Guide

This guide covers security best practices for everyone who interacts with Stellar-Save — from end users managing their savings groups to developers building on or contributing to the protocol.

> **Reporting a vulnerability?** Do not open a public issue. Use [GitHub Private Security Advisories](https://github.com/Xoulomon/Stellar-Save/security/advisories/new). See [SECURITY.md](../SECURITY.md) for the full disclosure policy.

---

## Table of Contents

- [Wallet Security](#wallet-security)
- [Smart Contract Security](#smart-contract-security)
- [Common Scams and How to Avoid Them](#common-scams-and-how-to-avoid-them)
- [Incident Response](#incident-response)
- [Security Checklist](#security-checklist)
- [Review and Audit Status](#review-and-audit-status)

---

## Wallet Security

Your Stellar wallet is the only key to your funds. If your private key or seed phrase is compromised, no smart contract protection can recover your money.

### Protect your seed phrase

- Write it down on paper and store it somewhere physically secure (e.g. a safe). Do not photograph it or store it in cloud notes, email, or messaging apps.
- Never type your seed phrase into any website, browser extension prompt, or app that you did not deliberately open yourself.
- No legitimate Stellar-Save interface, support channel, or maintainer will ever ask for your seed phrase.

### Use a hardware wallet for mainnet

For any meaningful amount of XLM, use a hardware wallet (Ledger or Trezor) with Freighter or Ledger Live. Hardware wallets sign transactions in an isolated environment — even if your computer is compromised, your private key stays on the device.

- Testnet experimentation: a software wallet (Freighter browser extension) is fine
- Mainnet with real funds: hardware wallet strongly recommended

### Verify before you sign

Every transaction you sign moves real funds. Before approving:

1. Check the **contract ID** matches the official Stellar-Save deployment (published in the repository's `environments.toml` and release notes)
2. Check the **function name** — legitimate operations are `contribute`, `join_group`, `execute_payout`, `pause_group`, `unpause_group`
3. Check the **amount** — Stellar-Save never requires you to send more than your group's `contribution_amount`
4. Use [Stellar Laboratory](https://laboratory.stellar.org) to inspect any transaction XDR before signing if you are unsure

### Keep software up to date

- Update Freighter, Ledger firmware, and your browser regularly
- Only install wallet extensions from official sources (Chrome Web Store / Firefox Add-ons, verified publisher)
- Be cautious of wallet extensions that request broad permissions

### Separate wallets for separate purposes

Use a dedicated wallet address for Stellar-Save groups rather than your primary holding address. This limits exposure if a group interaction goes wrong.

---

## Smart Contract Security

### How the contract protects funds

The Stellar-Save Soroban contract includes the following protections:

| Protection | Implementation |
|---|---|
| Reentrancy guard | Applied to `transfer_payout()` — prevents recursive calls during fund transfer |
| Overflow checks | `overflow-checks = true` in the release profile (`Cargo.toml`) |
| Panic = abort | `panic = "abort"` prevents stack-unwinding exploits |
| Atomic storage | All state changes are committed atomically — no partial updates |
| Authorization checks | Every privileged operation verifies the caller via `env.invoker()` |
| Creator-only pause | `pause_group` / `unpause_group` restricted to the group creator |
| Rate limiting | Group creation and joins are rate-limited to prevent spam |
| Emergency withdrawal | Members can reclaim pro-rata funds after 2× cycle duration of inactivity |

### Authorization model

- **Group creator**: can pause/unpause the group and configure parameters at creation time
- **Members**: can contribute and, when it is their turn, receive the payout
- **Anyone**: can call `execute_payout` — the contract validates eligibility internally; there is no privileged executor

There is no global admin key that can move user funds. The contract is non-upgradeable once deployed — what you audit is what runs.

### Storage and data integrity

On-chain storage keys are namespaced per group and per member using `StorageKeyBuilder`. There is no shared mutable state between groups — a bug or attack in one group cannot affect another.

### Known limitations

- **No oracle**: cycle deadlines use Stellar ledger timestamps. These are reliable but cannot be manipulated by users.
- **No slippage protection**: contributions are in exact XLM amounts; there is no price-sensitive swap logic.
- **Group size**: very large groups (>50 members) may approach Soroban instruction limits. The recommended maximum is 20 members.
- **No upgrade path**: the contract is immutable. If a critical bug is found, the mitigation is to pause affected groups and deploy a new contract version. Existing groups would need to migrate manually.

### For developers integrating with the contract

- Always call `get_group()` and validate the returned state before building a transaction
- Use `get_contribution_status(group_id, cycle)` to check what is owed before calling `contribute()`
- Subscribe to Soroban events (`PayoutExecuted`, `ContributionReceived`, `ContractPaused`) for real-time monitoring rather than polling storage
- Test all integrations on testnet before mainnet. Use a separate funded testnet identity

---

## Common Scams and How to Avoid Them

Blockchain savings platforms attract social engineering attacks. These are the most common patterns targeting ROSCA users.

### Fake group invitations

**How it works**: A scammer creates a group with a very attractive contribution amount or promises guaranteed returns. They collect contributions from early members and disappear before the payout rotation reaches them.

**How to avoid it**:
- Only join groups where you personally know and trust the creator and other members
- Call `get_group(group_id)` and inspect the creator address before joining
- Check the creator's on-chain history using [Stellar Expert](https://stellar.expert) — look for prior group activity
- Legitimate ROSCAs do not promise returns beyond the pooled contributions

### Impersonation of the Stellar-Save team

**How it works**: Someone contacts you via Telegram, Discord, or email claiming to be a Stellar-Save maintainer. They ask you to send funds to a "recovery address", share your seed phrase, or approve a transaction to "verify your wallet".

**How to avoid it**:
- The Stellar-Save team will never DM you first asking for funds or credentials
- All official communication happens through GitHub Issues, GitHub Discussions, and the official Telegram channel listed in the README
- If someone claims to be a maintainer, verify by checking their GitHub profile and contribution history

### Phishing sites

**How it works**: A fake website mimics the Stellar-Save frontend. It prompts you to connect your wallet and then requests approval for a malicious transaction.

**How to avoid it**:
- Bookmark the official frontend URL and always navigate from your bookmark
- Check the browser address bar carefully — phishing sites often use lookalike domains (e.g. `stellar-save.io` vs `stellarsave.app`)
- Freighter will show the contract ID being called — verify it matches the official deployment before approving
- If a site asks for your seed phrase, close it immediately

### "Admin" requests to send funds

**How it works**: A scammer in a group chat claims to be the group admin and asks members to send funds directly to a wallet address "to fix a problem" or "to speed up the payout".

**How to avoid it**:
- All contributions go through the smart contract, never to a personal wallet address
- The contract enforces the exact contribution amount — no one can legitimately ask you to send more
- If someone in your group is asking for direct transfers, treat it as a scam and alert other members

### Malicious contract clones

**How it works**: A scammer deploys a contract that looks like Stellar-Save but has a backdoor allowing them to drain funds.

**How to avoid it**:
- Always verify the contract ID against the official deployment listed in the repository
- The official contract IDs for each network are published in `environments.toml` and in release notes
- You can inspect any Soroban contract's WASM on [Stellar Expert](https://stellar.expert) and compare it against the published build

---

## Incident Response

This section covers what to do when something goes wrong — for users experiencing a problem and for developers responding to a security event.

### For users

#### My contribution was not recorded

1. Check the transaction on [Stellar Expert](https://stellar.expert) using your wallet address — confirm it was submitted and succeeded
2. Call `get_contribution_status(group_id, cycle_number)` to check the on-chain record
3. If the transaction succeeded but the contract state is wrong, open a GitHub issue with the transaction hash

#### I missed a contribution deadline

- Missing a contribution delays the payout for the entire group for that cycle
- You can still contribute in the next cycle — call `contribute(group_id, member, amount)` when the next cycle opens
- Your position in the payout rotation is not affected by a missed cycle

#### My group is stalled (no one is contributing)

1. Call `get_missed_contributions(group_id, current_cycle)` to identify who has not contributed
2. Contact those members directly
3. If the group has been inactive for 2× the cycle duration, any member who has not yet received a payout can call `emergency_withdraw()` to reclaim their pro-rata contributions

#### I think the contract has been paused

- Call `get_group(group_id)` and check the `paused` field
- A paused group cannot accept contributions or execute payouts, but funds are safe
- Only the group creator can pause or unpause — contact them directly

#### I suspect fraud or a scam

1. Do not send any more funds
2. Document everything: transaction hashes, wallet addresses, screenshots of communications
3. Open a GitHub issue (for contract-level issues) or report to the Stellar community
4. If funds have been stolen, report to relevant local authorities — blockchain transactions are traceable

### For developers and maintainers

The full operational incident response process is documented in [docs/incident-response-plan.md](incident-response-plan.md). Summary:

| Severity | Definition | Response time |
|---|---|---|
| P1 — Critical | Funds at risk or contract failure | 15 minutes |
| P2 — High | Degraded service, data loss risk | 1 hour |
| P3 — Medium | Partial degradation | 4 hours |
| P4 — Low | Minor issue, no user impact | Next business day |

**Immediate steps for a P1 security event**:

1. Do not discuss details publicly until contained
2. Pause affected groups:
   ```bash
   bash scripts/dr_recover.sh pause-all-groups
   ```
3. Open a [GitHub Private Security Advisory](https://github.com/Xoulomon/Stellar-Save/security/advisories/new)
4. Assess whether a contract rollback or new deployment is needed
5. Communicate to users via the status page — do not leave them without information

For key compromise, contract rollback, and data recovery procedures see the runbooks in `docs/runbooks/`.

---

## Security Checklist

### For users before joining or creating a group

- [ ] I verified the contract ID against the official deployment in `environments.toml`
- [ ] I inspected the group parameters with `get_group(group_id)` before joining
- [ ] I know and trust the group creator and other members
- [ ] I am using a hardware wallet (or understand the risk of using a software wallet)
- [ ] My seed phrase is stored securely offline and I have not shared it with anyone
- [ ] I have tested the flow on testnet before using mainnet

### For users during active participation

- [ ] I contribute the exact required amount — no more, no less
- [ ] I monitor my group's cycle status with `get_contribution_status()`
- [ ] I have noted the contribution deadline for each cycle
- [ ] I have not shared my private key or seed phrase with anyone claiming to be support

### For developers before deploying

- [ ] `cargo audit` passes with no critical or high advisories
- [ ] `npm audit` passes with no critical or high advisories
- [ ] All contract tests pass: `cargo test -p stellar-save`
- [ ] Semgrep and CodeQL scans are clean (check the Security tab)
- [ ] Contract ID is published in `environments.toml` and release notes
- [ ] Emergency pause has been tested on testnet
- [ ] Monitoring alerts are configured for `ContractPaused` and `PayoutExecuted` events

### For developers before merging a security-sensitive PR

- [ ] The change has been reviewed by at least two maintainers
- [ ] New authorization paths are covered by tests
- [ ] No new `unwrap()` or `expect()` calls on untrusted input
- [ ] No new `panic!` calls in contract code — use `ContractError` variants
- [ ] Storage key changes are backward-compatible or include a migration
- [ ] The PR does not introduce new external dependencies without review

---

## Review and Audit Status

### Automated scanning (runs on every PR and push)

| Tool | Scope |
|---|---|
| Semgrep | SAST — Rust and TypeScript |
| CodeQL | SAST — JavaScript/TypeScript |
| Snyk | Dependency CVEs (npm + Cargo) |
| cargo-audit | Rust advisory database |
| npm audit | Node advisory database |
| Gitleaks | Secret detection |
| Dependabot | Automated dependency updates |

PRs targeting `main` are blocked from merging if any critical or high severity finding is detected.

### Manual review

The contract has been reviewed internally. A third-party audit is recommended before any significant mainnet deployment. If you are a security researcher and have found an issue, please follow the responsible disclosure process in [SECURITY.md](../SECURITY.md).

### Fuzz testing

Property-based and fuzz tests live in `contracts/stellar-save/src/fuzz_tests.rs`. Run them with:

```bash
cargo test -p stellar-save fuzz
```

The fuzzing strategy is documented in [docs/fuzzing-strategy.md](fuzzing-strategy.md).

---

*For questions about this guide, open a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions). For vulnerabilities, use [GitHub Private Security Advisories](https://github.com/Xoulomon/Stellar-Save/security/advisories/new).*
