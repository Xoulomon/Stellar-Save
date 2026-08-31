# Load Testing — Concurrent Deposit Scenarios

This document describes the load test suite for the Stellar-Save backend, with
a focus on the concurrent deposit race-condition test.

## Overview

The load tests live in `backend/tests/load/` and are implemented with
[k6](https://k6.io/) (v0.50+). They target the staging REST API that wraps the
Stellar Soroban contract.

The primary goal is to verify that **concurrent deposit requests produce no
balance drift** — i.e., every accepted contribution is faithfully reflected in
the group's on-chain balance, with no lost updates or double-counts even when
many members submit at the same time.

## Quick Start

```bash
# Install k6
brew install k6           # macOS
# or: see https://k6.io/docs/get-started/installation/

# Run against local mock server (default)
k6 run backend/tests/load/concurrent-deposits.js

# Run against staging
BASE_URL=https://staging.stellar-save.example.com \
GROUP_ID=<group-id> \
k6 run backend/tests/load/concurrent-deposits.js
```

Full documentation, environment variables, and CI integration instructions are
in `backend/tests/load/README.md`.

## What is Tested

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| `concurrent_deposit_burst` | 20 (ramp) | 50s | Catches race conditions at peak concurrency |
| `sustained_baseline` | 5 (constant) | 60s | Baseline latency and error rate |

## Pass/Fail Criteria

| Metric | Threshold |
|--------|-----------|
| Balance drift | Must be exactly **0 stroops** |
| 99th percentile RTT | < 5 000 ms |
| Error rate | < 1 % |

Any non-zero balance drift is a **P1 bug** requiring immediate investigation.
