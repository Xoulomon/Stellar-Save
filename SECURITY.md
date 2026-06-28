# Bug Bounty Program

We welcome responsible disclosure of security vulnerabilities. This document outlines our vulnerability classifications, reward tiers, and response procedures.

## Vulnerability Classifications

- **Critical**: Remote code execution, authentication bypass, data loss, significant financial impact.
- **High**: Privilege escalation, sensitive data exposure, denial of service with moderate impact.
- **Medium**: Cross-site scripting (XSS), CSRF, limited information disclosure.
- **Low**: Minor information leakage, logging issues, lack of security headers.

## Reward Tiers

| Tier          | Reward (USD) | Points |
|---------------|--------------|--------|
| Critical      | $5,000       | 500    |
| High          | $1,000       | 300    |
| Medium        | $500         | 150    |
| Low           | $100         | 50     |

Rewards are paid via stablecoin (USDC) or equivalent upon validation and fix deployment.

## Response Procedures

1. **Report Submission**: Report via email to security@stellarsave.io or through our HackerOne program.
2. **Acknowledgement**: Within 24 hours of receipt.
3. **Triage**: Vulnerability classified and validated within 48 hours.
4. **Fix Development**: Timeline based on severity:
   - Critical: 72 hours
   - High: 1 week
   - Medium: 2 weeks
   - Low: 30 days
5. **Deployment**: Fix deployed to production within 24 hours of completion.
6. **Public Disclosure**: Coordinated disclosure after fix deployment (allow 7 days minimum for users to update).

## Responsible Disclosure Policy

- Do not access or modify data not owned by you.
- Do not perform destructive tests (e.g., DoS, spam).
- Provide sufficient details to reproduce the issue.
- Allow reasonable time for fix before public disclosure.

## Rewards Distribution

Rewards are processed within 14 business days of successful fix deployment. Duplicate reports will not be rewarded (first reporter receives credit).

## Platform

We use [HackerOne](https://hackerone.com) for managing submissions. Reporters are encouraged to register there for streamlined tracking.

---

*Last updated: 2025-03-25*
