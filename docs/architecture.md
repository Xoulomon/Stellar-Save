<<<<<<< HEAD
# Stellar-Save Architecture Documentation

## Overview

**Stellar-Save** is a decentralized Rotating Savings and Credit Association (ROSCA) platform built on the **Stellar blockchain** using **Soroban smart contracts**.

The system enables groups of people to save together transparently and securely without relying on a central authority. Contributions are made via Stellar payments, and payouts are automated through smart contract logic when a member's turn arrives.

### Goals
- Full transparency and auditability of all transactions
- Low-cost, fast operations using Stellar network
- Trust-minimized ROSCA mechanics via Soroban smart contracts
- Friendly, accessible frontend for non-technical users
- Mobile-responsive React application

## High-Level Architecture

**Core Layers:**

1. **Frontend** — React + TypeScript SPA
2. **Blockchain Layer** — Stellar + Soroban (Rust smart contracts)
3. **Data Layer** — On-chain storage + optional off-chain indexing
4. **Wallet Integration** — Freighter, Lobstr, or other Stellar wallets

## ROSCA Mechanics on Stellar

### Traditional ROSCA vs Stellar-Save

| Aspect               | Traditional ROSCA          | Stellar-Save (On-Chain)                  |
|----------------------|----------------------------|------------------------------------------|
| Trust Model          | High (based on relationships) | Low (enforced by smart contract)       |
| Contribution         | Cash / Bank transfer       | Stellar assets (XLM, USDC, etc.)        |
| Payout               | Manual handover            | Automatic via contract invocation       |
| Transparency         | Low                        | Full on-chain auditability              |
| Cost                 | Variable                   | Very low (~0.00001 XLM per tx)          |

### Smart Contract Design (Soroban)

The core logic lives in one or more Soroban contracts:

- **ROSCA Contract** — Manages group creation, membership, contribution schedule, payout rotation, and escrow
- **Escrow / Vault** — Holds contributed funds until payout is due
- **Token Handling** — Supports native XLM and custom Stellar assets

Key on-chain operations:
- `create_group()`
- `join_group()`
- `contribute()`
- `claim_payout()`
- `distribute()` (automated or triggered)

## Data Flow

1. **User connects wallet** → Frontend gets public key
2. **User creates/joins group** → Frontend calls Soroban contract
3. **Contribution** → User signs transaction → Funds move to escrow contract
4. **Payout cycle** → When turn arrives, authorized user (or anyone) invokes `claim_payout()`
5. **Events emitted** → Frontend listens to Stellar events for real-time updates
6. **History** → Frontend queries Horizon or indexed data for transaction history

**Frontend → Contract Interaction**:
- React components call Soroban client (`@soroban-client`)
- Transactions are built, signed by user's wallet, and submitted to Stellar network
- Results are parsed and reflected in UI state

## State Management

- **Local UI State**: React `useState` + `useReducer` for modals, forms, filters
- **Global App State**: Context API or Zustand (lightweight)
- **Blockchain State**: 
  - Real-time via Stellar Horizon streams / Soroban events
  - Cached with React Query / TanStack Query for performance
- **Persistent Data**: Mostly on-chain; off-chain only for UI preferences

## Frontend Architecture

- **Routing**: React Router with lazy loading
- **UI Library**: Material-UI (MUI) + custom `AppButton`, `AppCard`, etc.
- **Pages**: Home, Dashboard, Groups, Group Detail, History, About, 404
- **Components**: Reusable under `src/components/`
- **Hooks**: Custom hooks for transactions, groups, wallet connection
- **Styling**: MUI theming + Tailwind where needed

## Future Considerations

- Off-chain indexing service (for faster queries)
- Multi-sig group administration
- Yield-bearing ROSCAs (integrating with Stellar liquidity pools)
- Mobile app (React Native)
- Governance module for platform parameters
=======
# Architecture Overview

## What is Stellar-Save?

Stellar-Save implements a **Rotating Savings and Credit Association (ROSCA)** — known as *Ajo* or *Esusu* in West Africa — on the Stellar network using Soroban smart contracts.

Members pool equal contributions each cycle. One member receives the entire pool per cycle, rotating through all members until everyone has been paid once.

## High-Level Flow

```
[create_group] → group created, status=Active, cycle=0

[join_group × N] → when N == max_members, cycle advances to 1

     ┌───────────────────────────────┐
     │  Each Cycle                   │
     │                               │
     │  contribute() × max_members   │
     │      ↓ all contributed?       │
     │  execute_payout() (auto)      │
     │      ↓ payout to member[i]    │
     │  payout_index++, cycle++      │
     └───────────────────────────────┘
         (repeat max_members times)

[is_complete] → true when payout_index == max_members
```

## Contract Structure

```
contracts/stellar-save/
├── Cargo.toml
└── src/
    ├── lib.rs      — contract entry point, all public functions
    ├── types.rs    — Group, GroupStatus, DataKey
    ├── error.rs    — Error enum
    └── xlm.rs      — token transfer helper
```

## Key Design Decisions

**Single contract, multiple groups**
All ROSCA groups live inside one deployed contract. Groups are identified by an auto-incrementing `u64` ID.

**Automatic payout**
`contribute()` checks after each contribution whether all members have contributed for the current cycle. If so, it fires the payout immediately — no separate keeper/cron job required.

**Manual payout fallback**
`execute_payout()` is exposed publicly so anyone can trigger a payout manually once all contributions are confirmed, useful for off-chain tooling.

**Token agnostic**
The `token` address is passed per invocation rather than stored in the group, supporting any SEP-41 compatible asset. XLM is supported out of the box.

**No slashing / no timeouts (v1)**
This version has no penalty for missing contributions. Roadmap v2.0 adds configurable timeout + slashing mechanics.

## State Machine

```
Active (cycle=0, no members)
  → Active (cycle=0, some members joined)
    → Active (cycle=1, group full, running)
      → Active (cycle=N, intermediate cycles)
        → Complete (all payouts done)
```

Transitions:
- `join_group` fills the group → triggers `cycle=1`
- `contribute` (all in) → triggers payout → increments cycle
- Last payout → `status = Complete`
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
