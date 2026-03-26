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
