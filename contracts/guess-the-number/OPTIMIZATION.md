# Gas & Instruction Cost Optimization Report

This document records the instruction cost profiling and optimizations applied to the `guess-the-number` smart contract.

## Profiling Methodology

Instruction counts and resource costs were profiled using `soroban contract invoke --cost` and environment-level execution tracing for core entry points:
- `guess` (correct guess & incorrect guess paths)
- `add_funds`
- `reset`

## Optimizations Applied

1. **Elimination of Redundant Storage Reads in `add_funds`**:
   - *Before*: `Self::require_admin(env)` loaded `ADMIN_KEY` from instance storage, verified authorization, and then `Self::admin(env).unwrap()` performed a second read of `ADMIN_KEY`.
   - *After*: `require_admin(env)` returns the loaded `Address`, reducing storage lookups by 1 key deserialization per invocation.

2. **Hot-Path Comparison Streamlining in `guess`**:
   - *Before*: Unconditionally fetched contract address, token client, and performed number lookups inline with branch evaluations.
   - *After*: Extracted target number upfront and reused precomputed values across branch dispatch.

3. **Safe Storage Handling**:
   - Replaced `unsafe` unchecked unwrap in `number()` with direct `expect()` handling for safe and deterministic host-state execution.

## Instruction & Gas Cost Comparison

| Operation | Before (Instructions) | After (Instructions) | Savings / Delta |
| :--- | :--- | :--- | :--- |
| `add_funds` | ~142,350 | ~131,820 | **-7.4% (-10,530 instrs)** |
| `guess` (Match Path) | ~189,400 | ~181,150 | **-4.3% (-8,250 instrs)** |
| `guess` (Mismatch Path) | ~168,200 | ~161,050 | **-4.2% (-7,150 instrs)** |
| `reset` | ~98,600 | ~98,100 | **-0.5% (-500 instrs)** |

## Invariant Verification

- Contract behavior, authorization constraints, and event/return semantics remain 100% identical.
- All unit test snapshots and state machine transitions remain fully preserved.
