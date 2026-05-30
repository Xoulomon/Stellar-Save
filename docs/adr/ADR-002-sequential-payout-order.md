# ADR-002: Sequential Payout Order Default Design Decision

**Status**: Accepted  
**Date**: 2026-05-29  
**Author**: Stellar-Save Team  
**Deciders**: Product & Architecture Team

## Context

In a ROSCA, members take turns receiving the full pool of contributions. The order in which members receive payouts is a critical design decision that affects:
- User expectations and fairness perception
- Contract complexity and gas costs
- Flexibility for different use cases
- Predictability and planning

The team needed to decide on the default payout order mechanism while allowing for future flexibility.

### Alternatives Considered

1. **Sequential Order (Chosen)**
   - Members receive payouts in the order they joined
   - Deterministic and predictable
   - Simple to implement and verify
   - Gas efficient

2. **Random Order**
   - Each cycle, a random member is selected
   - Adds element of chance
   - More complex randomness implementation
   - Higher gas costs
   - Harder to predict and plan

3. **Auction-Based**
   - Members bid for payout position
   - Highest bidder receives payout
   - Maximizes value extraction
   - Complex contract logic
   - Potential for gaming and manipulation

4. **Flexible/Configurable**
   - Group creator chooses order mechanism
   - Maximum flexibility
   - Significant complexity
   - Harder to audit and verify
   - Potential for unfair configurations

## Decision

**The default payout order is sequential based on join order.**

Members receive payouts in the order they joined the group. This is the default behavior, with potential for configurable alternatives in future versions.

## Rationale

### 1. **Simplicity and Predictability**
- Members know exactly when they will receive their payout
- No surprises or randomness
- Easy to explain to non-technical users
- **Impact**: Builds trust and confidence in the system
- **Benefit**: Reduces support burden and user confusion

### 2. **Fairness Perception**
- "First in, first out" is universally understood
- Aligns with traditional ROSCA practices in many cultures
- No perception of favoritism or manipulation
- **Impact**: Increases adoption in communities
- **Benefit**: Matches user expectations from offline ROSCAs

### 3. **Gas Efficiency**
- No randomness oracle needed
- No complex sorting or selection logic
- Minimal storage overhead (just track current position)
- **Impact**: Lower transaction costs
- **Benefit**: More funds go to members, less to gas fees

### 4. **Auditability**
- Trivial to verify payout order on-chain
- Anyone can predict future payouts
- No hidden logic or complexity
- **Impact**: Increases transparency
- **Benefit**: Easier security audits and community verification

### 5. **Alignment with Traditional ROSCAs**
- Most traditional ROSCAs use sequential order
- Familiar to target users in Africa and diaspora communities
- Reduces friction for adoption
- **Impact**: Faster user onboarding
- **Benefit**: Leverages existing mental models

### 6. **Contract Simplicity**
- Reduces attack surface
- Fewer edge cases to handle
- Easier to test and verify
- **Impact**: Fewer bugs and vulnerabilities
- **Benefit**: Safer handling of user funds

## Consequences

### Positive
- ✅ Extremely simple to implement and understand
- ✅ Lowest gas costs of all alternatives
- ✅ Matches user expectations from traditional ROSCAs
- ✅ Trivial to audit and verify
- ✅ No randomness oracle dependencies
- ✅ Predictable payout timing enables planning

### Negative
- ❌ No flexibility for different use cases
- ❌ Early joiners always get paid first (potential fairness concern)
- ❌ No mechanism to reward active members or penalize inactive ones
- ❌ Cannot accommodate "priority" members

### Mitigation
- Document the sequential order clearly in UI
- Allow group creators to set custom join order in future versions
- Implement optional "random order" mode in v2.0
- Provide tools for groups to manually adjust order if needed

## Implementation Details

### Storage
```rust
// Track current payout position
payout_position: {group_id} → u32

// Track member join order
member_join_order: {group_id} → Vec<Address>
```

### Payout Logic
```rust
fn get_next_payout_recipient(group_id: u64) -> Address {
    let position = storage.get(payout_position_key(group_id))?;
    let members = storage.get(member_join_order_key(group_id))?;
    members[position % members.len()]
}
```

### Cycle Advancement
After each payout, increment position:
```rust
fn advance_payout_position(group_id: u64) {
    let current = storage.get(payout_position_key(group_id))?;
    storage.set(payout_position_key(group_id), current + 1);
}
```

## Future Considerations

- **v2.0**: Add configurable payout order (random, auction, custom)
- **v2.0**: Allow mid-cycle order adjustments with group consensus
- **v3.0**: Implement weighted payout (based on contribution amount)
- **v3.0**: Support priority members with guaranteed early payouts

## Related Decisions

- ADR-001: Choice of Soroban platform
- ADR-003: Backend event indexing approach

## References

- [Traditional ROSCA Practices](https://en.wikipedia.org/wiki/Rotating_savings_and_credit_association)
- [Stellar-Save Architecture](../architecture.md)
- [Contract Implementation](../../contracts/stellar-save/src/payout.rs)
