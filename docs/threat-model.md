# Threat Model

## 1. Introduction
This threat model is designed for EVM smart contracts (Solidity) and evaluates significant attack vectors and mitigations. It assumes a production-grade DeFi or token contract using OpenZeppelin patterns and upgradeable proxies.

## 2. Common EVM Attack Vectors

### 2.1 Reentrancy
- Description: An external call to an attacker-controlled contract re-enters the vulnerable function before state updates are finalized.
- Example: `withdraw` function updates balance after ETH transfer.
- Impact: Funds drained, invariant violation, leveraged attacks.
- Mitigations:
  - Checks-Effects-Interactions pattern.
  - `nonReentrant` modifier from OpenZeppelin `ReentrancyGuard`.
  - Use `transfer`/`send` for small fixed stipend or pull patterns.

### 2.2 Front-running (MEV)
- Description: Adversary reorders transactions in the mempool to gain profit by exploiting price-sensitive operations.
- Common targets: `swap`, `liquidate`, `mint`, `redeem`, `oracle updates`.
- Mitigations:
  - Use time-weighted average price (TWAP) or oracle-signed data.
  - Use commit-reveal or auction mechanisms.
  - Optimize gas to avoid miners dropping transactions.
  - Protect from sandwich attacks via slippage controls.

### 2.3 Integer Over/Underflow
- Description: Arithmetic overflow/underflow when using unchecked math on uints/ints.
- Solidity >=0.8 has built-in overflow checks by default, but unchecked blocks and inline assembly can bypass.
- Mitigations:
  - Prefer `SafeMath` semantics if using older compiler versions.
  - Avoid unchecked loops and manual casts.
  - Add explicit bounds checks for array indices and multiplications.

### 2.4 Denial of Service (DoS)
- Description: Contract logic can be blocked by one or more malicious actors (e.g., gas exhaustion, locked states, blocklist). 
- Variants:
  - DoS with block gas limit (e.g., unbounded iteration over user array).
  - Starvation attacks (e.g., set a high fee that prevents calls).
- Mitigations:
  - Avoid unbounded loops; use pagination or checkpoints.
  - Design for single-user failure to not break global operation.
  - Use `require` guards and break up operations into multiple transactions.

## 3. Access Control

### 3.1 Role-Based Access Control (OpenZeppelin)
- Use `AccessControl` or `AccessControlEnumerable`.
- Define roles as `bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");`.
- Setup roles with `grantRole` and `revokeRole`.
- Ensure at least one `DEFAULT_ADMIN_ROLE` holder for recovery, but use MultiSig for high-value contracts.
- Example:
  - `hasRole(ADMIN_ROLE, msg.sender)` guard.
  - `onlyRole` modifier usage.

### 3.2 Common pitfalls
- Never use `tx.origin` for auth.
- Enforce least privilege, separate `PAUSER_ROLE`, `UPGRADER_ROLE`, `MINTER_ROLE`.
- Protect role renouncement paths and emergency admin key compromise.

## 4. Fund Safety

### 4.1 Slippage Protection
- Provide slippage / max price impact parameters in functions that execute swaps or pricing-sensitive operations.
- Validate on-chain prices with oracle oracles such as Chainlink.
- `require(amountOut >= minAmountOut, "Slippage exceeded")`.

### 4.2 Pull-over-Push Patterns
- Description: avoid sending ETH/tokens to arbitrary user-controlled addresses in same function; instead record entitlements and let users withdraw.
- Benefits: prevents reentrancy, failed transfer due to gas/stipend constraints, and reduces atomic risk.
- Example: `pendingWithdrawals[user] += amount;` followed by user calling `withdraw()`.

## 5. Emergency Procedures

### 5.1 Circuit Breakers / Pausing
- Use `Pausable` from OpenZeppelin.
- Implement `pause()` and `unpause()` guarded by `PAUSER_ROLE`.
- Add `whenNotPaused` and `whenPaused` to critical operational methods.
- Include a `isPaused()` public view.

### 5.2 Emergency Withdrawal
- Add emergency `rescueTokens` / `rescueETH` function with strict access control and timelock.
- Log events: `EmergencyPause`, `EmergencyUnpause`, `RescueTokens`.

## 6. Security Best Practices
- Code review and static analysis by two or more peers.
- Keep contract size manageable, avoid enormous logic in single contract.
- Use immutable state and constants when possible.
- Minimize trust assumptions, design robust invariants.
- Include comprehensive unit tests and fuzz testing.
- Establish bug bounty and responsible disclosure policy.

## 7. Audit Recommendations
- Slither: static analysis and invariant checking; run `slither . --solc-remaps ...`.
- MythX / Certora / VeriSol: deeper semantic analysis.
- Echidna: property-based fuzzing to catch assertion violations.
- Foundry `forge test --fuzz` plus `forge coverage`.
- Formal verification of core invariants (balance conservation, role invariants) through tools such as Scribble with `yul` formalization.
- Third-party audit briefing: supply detailed architecture, state machine, and threat model.
