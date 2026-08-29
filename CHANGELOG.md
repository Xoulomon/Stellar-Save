# Changelog — Stellar-Save (monorepo)

All notable changes to the Stellar-Save project are documented here.

This is the **root changelog**. Each package maintains its own detailed
changelog; this file provides a high-level cross-package summary and links
to the per-package files.

> **Auto-generation:** This file is updated automatically from
> [Conventional Commits](https://www.conventionalcommits.org/) on every tagged
> release by `.github/workflows/changelog.yml`. See
> [docs/changelog.md](docs/changelog.md) for the commit format and local-usage
> instructions.

---

## Per-package changelogs

| Package | Location | Current version |
|---------|----------|----------------|
| Smart contracts (`stellar-save`) | [`contracts/stellar-save/CHANGELOG.md`](contracts/stellar-save/CHANGELOG.md) | 0.1.0 |
| Backend service | [`backend/CHANGELOG.md`](backend/CHANGELOG.md) | 1.0.0 |
| Frontend SPA | [`frontend/CHANGELOG.md`](frontend/CHANGELOG.md) | 0.1.0 |

---

## [Unreleased]

_No cross-package unreleased changes tracked yet._

---

## [0.1.0] — 2026-08-28

Initial release of the full Stellar-Save monorepo.

### Highlights

- **Smart contract** (`contracts/stellar-save` v0.1.0): Core ROSCA logic
  deployed on Stellar Soroban — group creation, member join, XLM
  contributions, automatic payout rotation, emergency pause, and storage
  schema v2 migration (reentrancy guard + XLM token-config backfill). See
  [`contracts/stellar-save/CHANGELOG.md`](contracts/stellar-save/CHANGELOG.md).

- **Backend** (`backend` v1.0.0): Node.js/Express REST + GraphQL API with
  dual-version routing (v1 deprecated, v2 current), contract event indexer,
  notification/fraud-detection/analytics services, admin API cleanup (5
  unused endpoints removed, 7 new endpoints added), and full observability
  stack. See [`backend/CHANGELOG.md`](backend/CHANGELOG.md).

- **Frontend** (`frontend` v0.1.0): React 19 + MUI v7 SPA with React Query,
  multi-wallet support (Freighter, Lobstr, Albedo), PWA/offline mode,
  internationalisation, deep linking, and WCAG 2.1 AA accessibility. See
  [`frontend/CHANGELOG.md`](frontend/CHANGELOG.md).

### Breaking changes / deprecations

| Issue | Package | What is deprecated | Removal target |
|-------|---------|-------------------|---------------|
| #4 | contracts | Storage schema v1 (no `TokenConfig` backfill, no pause/reentrancy) | Removed post-migration |
| #37 | backend | API v1 (`/api/v1/*`) | 2027-01-01 |
| #37 | backend | 5 unused admin scaffold endpoints (`/admin/reconciliation/*`, `/admin/fraud/*`) | Removed in this release |
| #56 | contracts | `contribute()` two-argument overload | v0.2.0 |
| #56 | frontend | `useMembers` / `useLeaderboard` hand-rolled cache pattern | Future release |

---

<!-- CHANGELOG ENTRIES ARE INSERTED BELOW BY CI -->
