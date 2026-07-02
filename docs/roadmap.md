<<<<<<< HEAD
# Stellar-Save Roadmap

This document outlines the planned development milestones for Stellar-Save. Timelines are estimates and subject to change based on community feedback and contributor availability.

---

## Table of Contents

- [v1.0 — Core (Current)](#v10--core-current)
- [v1.1 — Custom Token Support](#v11--custom-token-support)
- [v2.0 — Flexible Payouts & Penalties](#v20--flexible-payouts--penalties)
- [v3.0 — Enhanced Frontend UI](#v30--enhanced-frontend-ui)
- [v4.0 — Mobile App & Fiat On/Off-Ramps](#v40--mobile-app--fiat-onoff-ramps)
- [Milestone Summary](#milestone-summary)

---

## v1.0 — Core (Current)

**Status:** In Progress  
**Scope:** XLM-only rotational savings on Stellar testnet and mainnet

### Features
- Create savings groups with configurable contribution amount, cycle duration, and max members
- Join groups via Group ID
- Fixed XLM contributions per cycle
- Automatic payout to the designated member when all contributions are received
- Group lifecycle management: `Pending` → `Active` → `Completed`
- On-chain event emission for group creation, contributions, and payouts
- Basic frontend (React + Vite) with wallet connection via Freighter
- Smart contract written in Rust using the Soroban SDK

### Goals
- Prove the core rotational savings model works reliably on-chain
- Establish a clean, auditable contract codebase
- Provide a minimal but functional UI for early adopters

---

## v1.1 — Custom Token Support

**Status:** Planned  
**Scope:** Allow groups to use any Stellar asset (not just XLM)

### Features
- Accept any SEP-41 compliant token as the contribution currency
- Token selection during group creation
- Display token symbol and balance in the UI
- Validate token balances before allowing contributions

### Goals
- Open Stellar-Save to stablecoin-based savings groups (e.g. USDC on Stellar)
- Reduce volatility risk for members who prefer stable assets

---

## v2.0 — Flexible Payouts & Penalties

**Status:** Planned  
**Scope:** Improve fairness and resilience when members miss contributions

### Features
- Configurable penalty for missed contributions (e.g. small XLM fee)
- Grace period before a missed contribution is penalised
- Option for randomised or voted payout order (instead of join-order only)
- Partial payout release if a member exits early (with creator approval)
- On-chain dispute flag for unresolved contribution issues

### Goals
- Make groups more resilient to non-participating members
- Give group creators more control over payout fairness
- Reduce the risk of a single member stalling the entire group

---

## v3.0 — Enhanced Frontend UI

**Status:** Planned  
**Scope:** Significant UX improvements based on user feedback from v1.x

### Features
- Full mobile-responsive design
- Push notifications (browser) for upcoming contribution deadlines
- Group activity feed showing recent contributions and payouts
- Member profile pages with contribution history
- Dark mode support
- Improved onboarding flow for first-time users
- Internationalisation (i18n) support — starting with English, French, and Yoruba

### Goals
- Lower the barrier to entry for non-technical users
- Support communities in regions where Ajo/Esusu is culturally common

---

## v4.0 — Mobile App & Fiat On/Off-Ramps

**Status:** Future  
**Scope:** Native mobile experience and fiat integration

### Features
- React Native mobile app (iOS and Android)
- In-app wallet creation and management
- Fiat on-ramp: buy XLM or stablecoins directly within the app
- Fiat off-ramp: withdraw payout to local bank account via SEP-24/31
- Biometric authentication (Face ID / fingerprint)
- SMS/WhatsApp contribution reminders

### Goals
- Reach users who don't have desktop access
- Bridge the gap between crypto savings and traditional banking
- Enable true financial inclusion for underbanked communities

---

## Milestone Summary

| Version | Scope | Status |
|---------|-------|--------|
| v1.0 | XLM-only core contract + basic UI | In Progress |
| v1.1 | Custom token (SEP-41) support | Planned |
| v2.0 | Flexible payouts, penalties, payout order options | Planned |
| v3.0 | Enhanced UI, mobile-responsive, notifications, i18n | Planned |
| v4.0 | Mobile app, fiat on/off-ramps | Future |

---

## Contributing to the Roadmap

Have a feature idea or want to reprioritise something? Open a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions) or comment on an existing [issue](https://github.com/Xoulomon/Stellar-Save/issues). Community input directly shapes what gets built next.
=======
# Roadmap

## v1.0 — Current

- [x] ROSCA core: create group, join, contribute, payout rotation
- [x] Native XLM support via SEP-41 token interface
- [x] Automatic payout when all members contribute
- [x] Manual `execute_payout` fallback
- [x] Comprehensive test suite (17 tests)
- [x] Testnet deploy script

## v1.1 — Token Support

- [ ] Store `token` address inside `Group` at creation time
- [ ] Validate token address on every contribution and payout
- [ ] Support USDC, EURC, and any SEP-41 token
- [ ] Emit contract events for contributions and payouts

## v2.0 — Resilience & Incentives

- [ ] Configurable `timeout_ledger` per group
- [ ] `slash_member()` — eject non-contributing members after timeout, refund others
- [ ] Randomized payout order (opt-in at group creation)
- [ ] Penalty bonds: members lock a small deposit at join, forfeited on slash
- [ ] Auto-extend storage TTL on every write

## v3.0 — Frontend

- [ ] React + Freighter wallet integration
- [ ] Group discovery UI (browse open groups)
- [ ] Contribution status dashboard
- [ ] Push notifications for cycle starts
- [ ] [Design token system & dark mode](design-tokens.md) (#1173)
- [ ] [Funnel & cohort analytics](funnel-analytics.md) (#1172)

## v4.0 — Mobile & Fiat

- [ ] React Native mobile app
- [ ] Fiat on/off-ramp integration (MoneyGram, mobile money)
- [ ] Localization: Yoruba, Igbo, Hausa, Swahili, French
- [ ] QR-code invite links for group joining

## Long-term Research

- [ZK-based private contribution amounts](zk-verification.md) — prove attributes without on-chain disclosure (#1174)
- Cross-chain ROSCA groups (Stellar ↔ EVM via Axelar)
- DAO governance for contract upgrades

## Security

- [Bug Bounty & Vulnerability Disclosure](../security/BUG_BOUNTY.md) (#1175)
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
