# Node/JS Dependency Security Review (`pnpm audit`)

This is the Node/JS counterpart to [`deny.toml`](../deny.toml) (cargo-deny) for the
Rust contracts. It covers every pnpm workspace in
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml): `backend`, `frontend`, `mobile`
and `packages/*`, plus the root.

`pnpm-lock.yaml` is the canonical lockfile, so audits run against it and not
against the legacy per-package `package-lock.json` files.

## Policy

| Severity        | Required action                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Critical / High | Fix (upgrade or override) **before merge**, or record an explicit accepted-risk exception (below) with a justification. |
| Moderate / Low  | Triage at each review; fix opportunistically (Dependabot / next upgrade). No exception entry required.                  |

The gate is `pnpm audit --audit-level=high`, which must exit `0`.

## Review process

Run this at least monthly, before every release, and whenever Dependabot
raises a security alert against `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm audit                         # full report, all severities
pnpm audit --audit-level=high      # gate: must exit 0
pnpm audit --json > pnpm-audit.json   # attach to the review PR
```

For each high/critical finding:

1. **Locate** the chain that pulls it in: `pnpm why -r <package>`.
2. **Fix, preferring the least invasive option:**
   1. Upgrade the direct dependency that pulls it in (in the owning workspace's `package.json`).
   2. If the parent's semver range already allows the patched version but the lockfile is stale, refresh the lockfile.
   3. If the parent pins a vulnerable version but the patched release is API-compatible,
      add a **version-range-scoped** override in root `package.json` → `pnpm.overrides`
      (for example `"axios@<1.18.0": "^1.18.0"`), so only vulnerable resolutions move.
      Never add an unscoped override that could silently cross a major version.
3. **Accept** only when no compatible fix exists. Add the GHSA ID to
   `pnpm.auditConfig.ignoreGhsas` and its CVE ID to `pnpm.auditConfig.ignoreCves`
   in root `package.json`. pnpm 9.0.0, the version pinned in `packageManager`,
   only reads `ignoreCves`, so keep both lists in sync. Then add a row to the
   accepted-risk register below with a justification and removal condition.
   `package.json` cannot hold comments, so this register is the source of truth
   for the reasons, the same role as the `reason` field in `deny.toml`.
4. **Verify**: build, typecheck and test the affected workspaces, and exercise any
   upgraded runtime package directly.
5. **Prune**: remove overrides and ignore entries once upstream ships the fix.
   Each entry below lists its removal condition.

## Overrides in effect

Each override is scoped to the vulnerable range and targets an API-compatible
patched release.

| Override                                                | Advisories fixed                                                                        | Pulled in by                                           | Remove when                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `adm-zip@<0.6.1` → `^0.6.1`                             | GHSA-7q85-xj36-vmfc                                                                     | `@percy/core`                                          | Percy lockfile resolves ≥0.6.1              |
| `axios@<1.18.0` → `^1.18.0`                             | 12 high + 18 moderate + 1 low (prototype pollution, SSRF, proxy credential leak, ReDoS) | `@stellar/stellar-sdk@15` (pins `1.15.0`), wallets-kit | stellar-sdk ≥17 adopted in backend/sdk      |
| `toml@<4.2.0` → `^4.2.0`                                | GHSA-v5mp-jgw5-2x6j, GHSA-82x6-q7mm-w9cf                                                | `@stellar/stellar-sdk` (stellar.toml resolver)         | stellar-sdk ≥17 (switched to `smol-toml`)   |
| `lodash@<4.18.0` → `^4.18.1`                            | GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh, GHSA-xxjr-mmjv-4gpg                           | `@nestjs/config@3`, `@graphql-codegen/*`               | Parents require ≥4.18                       |
| `sharp@<0.35.4` → `^0.35.4`                             | GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c                                                | `vite-imagetools@9`                                    | `vite-imagetools` ≥10 (needs Node 22 in CI) |
| `deepmerge-ts@<8.0.0` → `^8.0.2`                        | GHSA-ggr8-5vv4-36mx                                                                     | `prisma@6` → `@prisma/config`                          | Prisma CLI upgraded to 7.x                  |
| `tmp@<0.2.6` → `^0.2.6`                                 | GHSA-ph9p-34f9-6g65, GHSA-52f5-9888-hmc6                                                | `@stryker-mutator/core` → `external-editor`            | Stryker upgraded                            |
| `immutable@<3.8.4` → `^3.8.4`                           | GHSA-wf6x-7x77-mvgw, GHSA-v56q-mh7h-f735, GHSA-xvcm-6775-5m9r                           | `@ardatan/relay-compiler` (graphql-codegen)            | Codegen upgraded                            |
| `fast-uri@>=3.0.0 <3.1.6` → `^3.1.6`                    | 5 high (host confusion / SSRF)                                                          | `ajv@8` (stylelint, Percy)                             | Lockfile resolves ≥3.1.6 naturally          |
| `nanoid@<3.3.18` → `^3.3.18`                            | GHSA-2v37-7h3g-55p8                                                                     | `postcss`                                              | Lockfile resolves ≥3.3.18 naturally         |
| `semver@>=7.0.0 <7.5.2` → `^7.5.2`                      | GHSA-c2qf-rxjj-qqgw                                                                     | legacy tooling                                         | No 7.x <7.5.2 left in tree                  |
| `brace-expansion` (1.x / 2.x / 5.x lines)               | GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895                                                | `minimatch` (jest, eslint, glob)                       | Lockfile resolves patched lines naturally   |
| `js-yaml` (3.x / 4.x lines)                             | GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh                                                | `cosmiconfig` (commitlint, stylelint, metro)           | Lockfile resolves patched lines naturally   |
| `postcss@<8.5.23` → `^8.5.23`                           | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 (+2 moderate)                                  | `@expo/metro-config` (pins `~8.4`)                     | Expo SDK upgrade                            |
| `@xmldom/xmldom` (0.7/0.8 → `^0.8.15`, 0.9 → `^0.9.12`) | 24 high + 4 moderate (XML injection, ReDoS)                                             | Expo config plugins (`@expo/plist`, `plist`)           | Expo SDK upgrade                            |

## Accepted-risk register

Each GHSA below is listed in `pnpm.auditConfig.ignoreGhsas`, and its CVE (see
[GHSA → CVE mapping](#ghsa--cve-mapping)) in `pnpm.auditConfig.ignoreCves`. All of them are
**build-time or dev-only tooling**. None ships in the web bundle, the backend
runtime, or the mobile app binary.

| GHSA(s)                                                                                                                                                                                     | Package (version)     | Sev.           | Pulled in by                                                             | Why no fix now                                                                                                                                                                                | Why the risk is acceptable                                                                                                                                                                                                        | Remove when                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| GHSA-23hp-3jrh-7fpw, GHSA-34x7-hfp2-rc4v, GHSA-83g3-92jg-28cx, GHSA-8qq5-rm4j-mr97, GHSA-8x88-c5mf-7j5w, GHSA-9ppj-qmqm-q256, GHSA-qffp-2rhf-9h96, GHSA-r292-9mhp-454m, GHSA-r6q2-hw4h-h46w | `tar` 6.2.1           | 1 crit, 8 high | `mobile` → `expo@51` → `@expo/cli@0.18`                                  | Fixed only in `tar` 7.x. `@expo/cli@0.18` calls `require("tar").default.extract(...)`, and `tar` 7 has no `default` export (verified), so an override would break `expo` template extraction. | Used only by the Expo CLI on developer and CI machines, as a **fallback** when the native `tar` binary fails, to unpack npm-registry tarballs (templates). No user-supplied archives are processed, and nothing ships in the app. | Mobile upgrades to an Expo SDK whose `@expo/cli` depends on `tar` ≥7.5.21. |
| GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr                                                                                                                                                    | `image-size` 1.2.1    | high           | `mobile` → `react-native@0.74` → `metro@0.80`                            | Fixed only in 2.x, which changed the API (no file-path input). An override would break Metro's asset pipeline.                                                                                | DoS (infinite loop) on malformed ICNS/JXL/HEIF images. Metro only sizes image assets committed to this repo, at bundle time. There is no runtime exposure.                                                                        | React Native / Metro upgrade that uses `image-size` ≥2.0.3.                |
| GHSA-7pqw-9j4j-h8q3, GHSA-jmr9-qjv8-65gv                                                                                                                                                    | `extract-zip` 2.0.1   | high           | `frontend` (dev) → `pa11y-ci@4` → `puppeteer@24` → `@puppeteer/browsers` | **No patched release exists** (advisory `patched: <0.0.0`). This is the latest puppeteer.                                                                                                     | Used only to unzip the Chrome build that Puppeteer downloads over HTTPS from Google's CDN, during local or CI a11y runs. No attacker-controlled archives are processed.                                                           | Upstream patch, or puppeteer drops `extract-zip`.                          |
| GHSA-wgrm-67xf-hhpq                                                                                                                                                                         | `pdfjs-dist` 2.16.105 | high           | `frontend` (dev) → `@percy/cli@1.32` → `@percy/core` → `@percy/cli-pdf`  | Percy's latest release pins 2.x. The fix is 4.x (ESM-only, breaking API).                                                                                                                     | Loaded only to render **PDF** snapshots inside Percy's headless browser. This project only runs `percy exec` against its own UI (`test:visual*`), so no untrusted PDFs are ever opened.                                           | Percy ships `@percy/cli-pdf` with `pdfjs-dist` ≥4.2.67.                    |

### GHSA → CVE mapping

| GHSA                | CVE            | GHSA                | CVE            |
| ------------------- | -------------- | ------------------- | -------------- |
| GHSA-23hp-3jrh-7fpw | CVE-2026-59873 | GHSA-r292-9mhp-454m | CVE-2026-73566 |
| GHSA-34x7-hfp2-rc4v | CVE-2026-24842 | GHSA-r6q2-hw4h-h46w | CVE-2026-23950 |
| GHSA-83g3-92jg-28cx | CVE-2026-26960 | GHSA-5p2g-fcmc-qvqq | CVE-2025-71329 |
| GHSA-8qq5-rm4j-mr97 | CVE-2026-23745 | GHSA-w3rx-r6r6-pgpr | CVE-2025-71330 |
| GHSA-8x88-c5mf-7j5w | CVE-2026-59874 | GHSA-7pqw-9j4j-h8q3 | CVE-2026-19693 |
| GHSA-9ppj-qmqm-q256 | CVE-2026-31802 | GHSA-jmr9-qjv8-65gv | CVE-2026-56876 |
| GHSA-qffp-2rhf-9h96 | CVE-2026-29786 | GHSA-wgrm-67xf-hhpq | CVE-2024-4367  |

## Audit report: 2026-09-25 (issue #1754)

Command: `pnpm audit` at the repo root, pnpm 9, 2,900+ resolved packages.

| Severity | Before | After (open) | After (accepted, ignored) |
| -------- | -----: | -----------: | ------------------------: |
| Critical |      2 |            0 |                         1 |
| High     |     85 |            0 |                        13 |
| Moderate |     60 |           19 |                         — |
| Low      |      9 |            6 |                         — |

`pnpm audit --audit-level=high` now exits `0`.

### Direct upgrades

| Workspace                  | Change                                                                                                                                                                                    | Advisories resolved                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `frontend`, `packages/sdk` | `vitest`, `@vitest/ui`, `@vitest/coverage-v8` `^2.1` → `^3.2.6`. This also moves the bundled `vite` from 5.4 to the workspace's `vite` 7.                                                 | **Critical** GHSA-5xrq-8626-4rwp (Vitest UI file read/exec), `vite` GHSA-fx2h-pf6j-xcff      |
| `frontend`                 | `react-router-dom` → `^7.18.2`                                                                                                                                                            | GHSA-qwww-vcr4-c8h2                                                                          |
| `frontend`                 | `pa11y-ci` `^3.1.0` → `^4.1.1` (puppeteer 9 → 24)                                                                                                                                         | `semver`, `lodash`, old puppeteer chain                                                      |
| `frontend`                 | `@percy/cli` → `^1.32.11`                                                                                                                                                                 | `image-size` 1.0.2 (GHSA-w3rx-r6r6-pgpr)                                                     |
| `frontend`                 | Removed unused `lighthouse-ci` (a different package from `@lhci/cli`, which the `lhci` script and CI actually call via `npx`)                                                             | `lodash.set` GHSA-p6mc-m468-83gw (no patch exists)                                           |
| `backend`                  | OpenTelemetry to the 2.x line: `sdk-node`/`exporter-trace-otlp-http` `^0.222`, `auto-instrumentations-node` `^0.80`, `resources`/`sdk-trace-base` `^2.11`, `semantic-conventions` `^1.43` | GHSA-q7rr-3cgh-j5r3 (Prometheus exporter crash), GHSA-45rx-2jwx-cxfr (Jaeger propagator DoS) |

The OTel upgrade also aligns the packages with `backend/src/tracing.ts`, which
already used the 2.x-only `resourceFromAttributes` API.

### Remaining moderate/low (triaged, not gated)

- **dev tooling:** `vitest`/`@vitest/mocker` 3.2 (fix in 4.x major), `turbo` 2.5 (fix in 2.9), `@babel/core`, `ajv`, `file-type`, `decode-uri-component`, `stream-json`.
- **backend runtime majors:** `@apollo/server` 4 → 5, `@nestjs/core` 10 → 11, `qs` via `express`. Each needs a major-version migration, so they go through the Dependabot major-update review path in [dependency-update-policy.md](./dependency-update-policy.md).
- **mobile (Expo 51):** `tar` moderates, `uuid`, `joi`, `send`, `fast-xml-parser`. All are resolved by the same Expo SDK upgrade tracked above.
- `elliptic` (low, no fix available).
