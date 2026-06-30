# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | ✅ Active |
| Older releases | ❌ No security patches |

We currently provide security fixes only for the most recent version on `main`.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security vulnerability, open a [GitHub Security Advisory](https://github.com/Xoulomon/Stellar-Save/security/advisories/new) (private by default) or email the maintainer directly at the address on the GitHub profile.

Include in your report:
- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected component(s) and version(s)
- Any suggested mitigations (optional)

We aim to acknowledge reports within **48 hours** and provide an initial assessment within **5 business days**.

---

## Container Image Security

All production container images (backend and frontend) are scanned on every push, pull request, and weekly schedule using [Trivy](https://github.com/aquasecurity/trivy).

### CVE Policy

| Severity | Default behaviour |
|----------|------------------|
| **CRITICAL** | Blocks the build immediately |
| **HIGH** | Blocks the build immediately |
| **MEDIUM** | Reported, does not block |
| **LOW** | Reported, does not block |

The blocking threshold is configurable via `workflow_dispatch` input (`fail_on_severity`). The weekly scheduled scan always uses `HIGH` as the minimum blocking threshold.

Unfixed CVEs (no upstream patch available) are excluded from the policy gate by default (`--ignore-unfixed`) but are still reported in the Security tab for tracking.

### SBOM Artifacts

A Software Bill of Materials (SBOM) is generated for every image on every non-PR build using [Syft](https://github.com/anchore/syft):

- **Format**: CycloneDX JSON and SPDX JSON
- **Location**: GitHub Actions workflow artifacts (90-day retention) and attached to each GitHub Release
- **Attestation**: SBOM is cryptographically attested to the image digest via [cosign](https://github.com/sigstore/cosign) using keyless signing (Sigstore)

To verify an SBOM attestation:
```bash
cosign verify-attestation \
  --type cyclonedx \
  ghcr.io/xoulomon/stellar-save/backend:<tag>
```

### Scan Results

- **SARIF reports** are uploaded to the [GitHub Security / Code Scanning tab](../../security/code-scanning) after every scan.
- A **PR comment** summarising pass/fail and CVE counts is posted automatically on pull requests.
- A **weekly security report issue** is updated every Monday (see issues labelled `security-report`).

---

## Vulnerability Exception Process {#vulnerability-exception-process}

When a blocking CVE cannot be immediately fixed (e.g. no upstream patch, base image not yet updated), an exception can be requested through the formal process documented in [`docs/vulnerability-exception-process.md`](docs/vulnerability-exception-process.md).

**Summary:**
1. Open a [Vulnerability Exception issue](.github/ISSUE_TEMPLATE/vulnerability-exception.md) with full CVE details and a reachability analysis.
2. Get the required approvals (1 maintainer for HIGH; 2 maintainers for CRITICAL).
3. Add the CVE to [`.github/trivy-ignore.txt`](.github/trivy-ignore.txt) with an expiry date (max 90 days) and a reference to the approved issue.
4. The exception expires automatically — the build will re-block if not renewed or remediated.

---

## Dependency Security

- Rust dependencies are audited via `cargo audit` in the CI pipeline.
- Frontend npm dependencies are scanned via `npm audit` in the CI pipeline.
- Dependabot is configured to automatically raise PRs for outdated dependencies.

---

## Infrastructure Security

- All Stellar Soroban smart contract interactions require explicit wallet authorisation — no funds can move without the member's signature.
- No private keys are stored in this repository. Deployment uses Stellar CLI key management.
- Testnet and mainnet deployments are isolated environments.

---

## Acknowledgements

We appreciate responsible disclosure from the security community. Researchers who responsibly disclose valid vulnerabilities will be acknowledged in release notes (with their permission).
