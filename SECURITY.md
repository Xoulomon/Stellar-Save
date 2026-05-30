# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅        |
| develop | ✅        |
| others  | ❌        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities via [GitHub Private Security Advisories](https://github.com/Xoulomon/Stellar-Save/security/advisories/new).

Include:
- Description and impact
- Steps to reproduce
- Affected component (contract, frontend, backend)
- Suggested fix (optional)

You will receive an acknowledgment within **48 hours** and a resolution timeline within **7 days**.

## Automated Security Scanning

This repository runs the following checks on every PR and push:

| Tool | Scope | Trigger |
|------|-------|---------|
| **Semgrep** | SAST — Rust & TypeScript | Push / PR / Weekly |
| **CodeQL** | SAST — JavaScript/TypeScript | Push / PR / Weekly |
| **Snyk** | Dependency CVEs (npm + Cargo) | Push / PR / Weekly |
| **Dependabot** | Automated dependency updates | Weekly |
| **cargo-audit** | Rust advisory database | Push / PR |
| **npm audit** | Node advisory database | Push / PR |
| **Gitleaks** | Secret detection | Push / PR |

### Security Gate

PRs targeting `main` or `develop` are **blocked** from merging if any **critical** or **high** severity finding is detected. Findings are visible in the repository's [Security tab](../../security/code-scanning).

## Secrets Management

- Never commit secrets, private keys, or mnemonics
- Use GitHub Actions secrets for CI credentials (`SNYK_TOKEN`, `SEMGREP_APP_TOKEN`)
- `.env` files are git-ignored; use `.env.example` as a template
- Stellar private keys must never appear in source code or logs

## Smart Contract Security

The Soroban contract implements the following protections:

- **Reentrancy guard** on `transfer_payout()`
- **Admin-only** pause/unpause and configuration
- **Rate limiting** on group creation and joins
- **Atomic storage** updates to prevent partial state
- **Overflow checks** enabled in release profile (`overflow-checks = true`)
- **Panic = abort** to prevent unwinding exploits

See [docs/threat-model.md](docs/threat-model.md) for the full threat model.

## Dependency Policy

- Pin exact versions in `Cargo.toml` and `package.json`
- Review Dependabot PRs weekly; merge security patches within **48 hours**
- Run `cargo audit` and `npm audit` locally before releasing

## Incident Response

1. Maintainer confirms and assesses severity
2. Patch developed on a private branch
3. Coordinated disclosure after patch is ready
4. Release published with security advisory
5. CVE requested if applicable
