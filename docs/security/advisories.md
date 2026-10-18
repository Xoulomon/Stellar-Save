# Dependency Advisory Triage

**Status: incomplete.** Advisory tools were unavailable in the local environment
(`cargo`, `cargo-deny`, and `npm` are not installed), and no package installation
was attempted. Therefore no current Rust or Node advisory results are claimed here.
The latest audit timestamp already recorded in `deny.toml` is 2026-09-25.

## Rust

The existing `deny.toml` ignores these unmaintained-crate notices:

| Advisory | Existing rationale | Current disposition |
|----------|--------------------|---------------------|
| RUSTSEC-2024-0388 (`derivative`) | Transitive through `soroban-env-host` and arkworks 0.4; no upgrade path until the Soroban SDK moves to arkworks 0.5. | Existing informational ignore; expiry/reassessment 2026-12-31 in `deny.toml`; recheck with `cargo deny check advisories`. |
| RUSTSEC-2024-0436 (`paste`) | Transitive proc-macro dependency of arkworks 0.4 through `soroban-env-host`. | Existing informational ignore; expiry/reassessment 2026-12-31 in `deny.toml`; recheck with `cargo deny check advisories`. |

These entries describe unmaintained crates, not known vulnerabilities. Their
current advisory status and whether an upstream upgrade is available have not
been verified in this environment. The `deny.toml` expiry dates are short-term
reassessment dates, not confirmation that these advisories remain open.

## Node

The root `package.json` currently lists ignored CVEs and GHSAs under
`pnpm.auditConfig`. That suppression list is not an audit result or an
individual risk disposition; no current workspace advisory tree was available
to verify it. Each suppression needs an owner-reviewed rationale and expiry
after `npm audit` is run for the workspaces.

## Required follow-up

Run `cargo deny check advisories` and `npm audit` for each workspace in an
environment with the tools and existing lockfile dependencies available.
Disposition every reported advisory by upgrading/removing the dependency or
recording a reason and expiry in the relevant policy, then replace this
incomplete status with the verified results.
