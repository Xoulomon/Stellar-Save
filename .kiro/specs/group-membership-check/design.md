# Design Document: Group Membership Check

## Overview

The group membership check feature provides a lightweight, gas-efficient mechanism to verify whether a given Stellar address is a member of a specific savings group. This functionality is essential for enforcing member-only operations throughout the contract and enabling external applications to query membership status without authentication.

The implementation leverages the existing storage infrastructure, specifically the `StorageKeyBuilder.member_profile` method and the persistent storage `has()` method, to perform existence checks without deserializing full member profile data. This design prioritizes performance and simplicity while maintaining consistency with the contract's storage patterns.

### Key Design Goals

1. **Performance**: Use storage `has()` method instead of `get()` to avoid unnecessary data deserialization
2. **Simplicity**: Single-purpose function with clear semantics (returns boolean)
3. **Public Access**: No authentication required, enabling external queries
4. **Consistency**: Integrate seamlessly with existing storage patterns and error handling
5. **Reliability**: Handle edge cases gracefully (non-existent groups, invalid addresses)

## Architecture

### Component Overview

The membership check feature consists of a single public function `is_member` that integrates with the existing contract architecture:

```
┌─────────────────────────────────────────────────────────┐
│                  StellarSaveContract                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Public Query Functions                  │    │
│  │  - get_group()                                  │    │
│  │  - list_groups()                                │    │
│  │  - get_member_details()                         │    │
│  │  - is_member()  ← NEW                          │    │
│  └────────────────────────────────────────────────┘    │
│                         ↓                                │
│  ┌────────────────────────────────────────────────┐    │
│  │         Storage Layer                           │    │
│  │  - StorageKeyBuilder.member_profile()          │    │
│  │  - env.storage().persistent().has()            │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Storage Layer**: Uses `StorageKeyBuilder.member_profile(group_id, address)` to construct storage keys
2. **Persistent Storage**: Calls `env.storage().persistent().has(&key)` for existence verification
3. **Member-Only Functions**: Functions like `get_member_details` can use `is_member` for validation
4. **Error Handling**: Returns `false` for non-existent groups instead of throwing errors

## Components and Interfaces

### Public Function Interface

```rust
/// Checks if a specific address is a member of a savings group.
///
/// This function performs a lightweight check to determine membership status
/// by verifying the existence of a member profile in persistent storage.
///
/// # Parameters
/// * `env` - The Soroban environment
/// * `group_id` - The unique identifier of the group
/// * `address` - The Stellar address to check
///
/// # Returns
/// Returns `true` if the address is a member, `false` otherwise.
///
/// # Examples
/// ```rust
/// // Check if an address is a member
/// let is_member = contract.is_member(env, 1, member_address);
/// if is_member {
///     // Proceed with member-only operation
/// }
/// ```
pub fn is_member(env: Env, group_id: u64, address: Address) -> bool
```

### Storage Key Construction

The function uses the existing `StorageKeyBuilder` to construct the member profile key:

```rust
let member_key = StorageKeyBuilder::member_profile(group_id, address);
```

This produces a storage key of type:
```rust
StorageKey::Member(MemberKey::Profile(group_id, address))
```

### Storage Query

The existence check is performed using the persistent storage `has()` method:

```rust
env.storage().persistent().has(&member_key)
```

This method returns:
- `true` if a member profile exists at the specified key
- `false` if no member profile exists (including non-existent groups)

## Data Models

### Input Parameters

| Parameter | Type | Description | Validation |
|-----------|------|-------------|------------|
| `env` | `Env` | Soroban environment | Provided by runtime |
| `group_id` | `u64` | Unique group identifier | No explicit validation (returns false for invalid) |
| `address` | `Address` | Stellar address to check | Validated by Soroban SDK |

### Return Value

| Type | Description |
|------|-------------|
| `bool` | `true` if address is a member, `false` otherwise |

### Storage Schema

The function queries the existing `MemberProfile` storage structure:

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberProfile {
    pub address: Address,
    pub group_id: u64,
    pub joined_at: u64,
}
```

Storage Key Pattern:
```
MEMBER_{group_id}_{address}
```

### State Transitions

The `is_member` function is read-only and does not modify any state. It queries the current state of the member profile storage.

```
┌─────────────────────────────────────────────────────────┐
│                    Storage State                         │
│                                                          │
│  Member Profile Exists?                                  │
│  ┌──────────────┐                                       │
│  │ Yes → true   │                                       │
│  │ No  → false  │                                       │
│  └──────────────┘                                       │
│                                                          │
│  No state changes occur                                  │
└─────────────────────────────────────────────────────────┘
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Storage Consistency

For any group_id and address, `is_member(env, group_id, address)` returns `true` if and only if a member profile exists in persistent storage at the key constructed by `StorageKeyBuilder.member_profile(group_id, address)`.

This is a round-trip property that ensures perfect consistency between the `is_member` query result and the actual storage state. The function should never return a false positive (claiming membership when no profile exists) or false negative (denying membership when a profile exists).

**Validates: Requirements 1.2, 1.3, 5.4**

### Property 2: Member-Only Function Integration

For any member-only function (such as `get_member_details`), when `is_member(env, group_id, address)` returns `false`, the function SHALL return `StellarSaveError::NotMember` (error code 2002).

This property ensures that all member-only operations consistently use `is_member` for authorization and handle non-members uniformly across the contract.

**Validates: Requirements 5.2**

### Example Tests

In addition to property-based tests, the following example tests should be implemented:

1. **Unauthenticated Access**: Verify that `is_member` can be called without authentication, demonstrating public query access (Validates: Requirement 3.4)

2. **Post-Join Verification**: Create a group, add a member, and verify `is_member` returns `true` for that member and `false` for non-members (Validates: Requirements 1.2, 1.3)

3. **Non-Existent Group**: Verify that `is_member` returns `false` for any address when querying a non-existent group_id (Validates: Requirement 2.1)

4. **Zero Group ID**: Verify that `is_member` returns `false` when group_id is zero (Validates: Requirement 7.2)

## Error Handling

### Error-Free Design

The `is_member` function is designed to never return errors. Instead, it returns `false` for all error conditions:

| Condition | Behavior | Rationale |
|-----------|----------|-----------|
| Non-existent group | Returns `false` | Simplifies caller logic; no member can exist in a non-existent group |
| Invalid group_id (zero) | Returns `false` | Consistent with non-existent group handling |
| Non-member address | Returns `false` | Expected behavior for membership check |
| Invalid address | Handled by Soroban SDK | SDK validates addresses before function execution |

### Integration with Error Handling

While `is_member` itself doesn't return errors, it enables proper error handling in other functions:

```rust
pub fn get_member_details(
    env: Env,
    group_id: u64,
    address: Address,
) -> Result<MemberProfile, StellarSaveError> {
    // 1. Verify group exists
    let group_key = StorageKeyBuilder::group_data(group_id);
    if !env.storage().persistent().has(&group_key) {
        return Err(StellarSaveError::GroupNotFound);
    }
    
    // 2. Use is_member for membership verification
    if !Self::is_member(env.clone(), group_id, address.clone()) {
        return Err(StellarSaveError::NotMember);
    }
    
    // 3. Retrieve member profile
    let member_key = StorageKeyBuilder::member_profile(group_id, address);
    env.storage()
        .persistent()
        .get(&member_key)
        .ok_or(StellarSaveError::NotMember)
}
```

### Edge Cases

The function handles the following edge cases gracefully:

1. **Non-existent groups**: Returns `false` without error
2. **Zero group_id**: Returns `false` (no group can have ID 0)
3. **Uninitialized storage**: Returns `false` (no member profiles exist)
4. **Concurrent queries**: Read-only operation, safe for concurrent access

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary for comprehensive correctness validation.

### Property-Based Testing

**Library**: Use `soroban-sdk`'s built-in testing utilities with custom property generators

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property using the tag format

**Property Test 1: Storage Consistency**

```rust
#[test]
fn property_storage_consistency() {
    // Feature: group-membership-check, Property 1: Storage Consistency
    // For any group_id and address, is_member returns true iff member profile exists
    
    for _ in 0..100 {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Generate random test data
        let group_id = generate_random_group_id();
        let address = Address::generate(&env);
        
        // Test case 1: No profile exists
        let result_before = client.is_member(&group_id, &address);
        let profile_exists_before = env.storage()
            .persistent()
            .has(&StorageKeyBuilder::member_profile(group_id, address.clone()));
        assert_eq!(result_before, profile_exists_before);
        
        // Test case 2: Create profile
        let member_profile = MemberProfile {
            address: address.clone(),
            group_id,
            joined_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(group_id, address.clone()), &member_profile);
        
        let result_after = client.is_member(&group_id, &address);
        let profile_exists_after = env.storage()
            .persistent()
            .has(&StorageKeyBuilder::member_profile(group_id, address.clone()));
        assert_eq!(result_after, profile_exists_after);
        assert_eq!(result_after, true);
    }
}
```

**Property Test 2: Member-Only Function Integration**

```rust
#[test]
fn property_member_only_integration() {
    // Feature: group-membership-check, Property 2: Member-Only Function Integration
    // When is_member returns false, member-only functions return NotMember error
    
    for _ in 0..100 {
        let env = Env::default();
        let contract_id = env.register_contract(None, StellarSaveContract);
        let client = StellarSaveContractClient::new(&env, &contract_id);
        
        // Generate random test data
        let group_id = generate_random_group_id();
        let address = Address::generate(&env);
        
        // Create group but don't add member
        let creator = Address::generate(&env);
        env.mock_all_auths();
        client.create_group(&creator, &100, &3600, &5);
        
        // Verify is_member returns false
        let is_member = client.is_member(&group_id, &address);
        assert_eq!(is_member, false);
        
        // Verify get_member_details returns NotMember error
        let result = client.try_get_member_details(&group_id, &address);
        match result {
            Err(Error::Contract(code)) => {
                assert_eq!(code, 2002); // NotMember error code
            }
            _ => panic!("Expected NotMember error"),
        }
    }
}
```

### Unit Testing

Unit tests focus on specific examples, edge cases, and integration scenarios:

**Test 1: Existing Member Returns True**
```rust
#[test]
fn test_is_member_existing_member() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let group_id = 1;
    let member_address = Address::generate(&env);
    
    // Create member profile
    let member_profile = MemberProfile {
        address: member_address.clone(),
        group_id,
        joined_at: env.ledger().timestamp(),
    };
    env.storage()
        .persistent()
        .set(&StorageKeyBuilder::member_profile(group_id, member_address.clone()), &member_profile);
    
    // Verify is_member returns true
    let result = client.is_member(&group_id, &member_address);
    assert_eq!(result, true);
}
```

**Test 2: Non-Member Returns False**
```rust
#[test]
fn test_is_member_non_member() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let group_id = 1;
    let non_member_address = Address::generate(&env);
    
    // Don't create any member profile
    
    // Verify is_member returns false
    let result = client.is_member(&group_id, &non_member_address);
    assert_eq!(result, false);
}
```

**Test 3: Non-Existent Group Returns False**
```rust
#[test]
fn test_is_member_non_existent_group() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let non_existent_group_id = 999;
    let address = Address::generate(&env);
    
    // Verify is_member returns false for non-existent group
    let result = client.is_member(&non_existent_group_id, &address);
    assert_eq!(result, false);
}
```

**Test 4: Zero Group ID Returns False**
```rust
#[test]
fn test_is_member_zero_group_id() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let zero_group_id = 0;
    let address = Address::generate(&env);
    
    // Verify is_member returns false for zero group_id
    let result = client.is_member(&zero_group_id, &address);
    assert_eq!(result, false);
}
```

**Test 5: Unauthenticated Access**
```rust
#[test]
fn test_is_member_no_authentication_required() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let group_id = 1;
    let address = Address::generate(&env);
    
    // Call is_member without mocking authentication
    // This should succeed without requiring auth
    let result = client.is_member(&group_id, &address);
    
    // The call should complete successfully (returns false since no member exists)
    assert_eq!(result, false);
}
```

**Test 6: Integration with get_member_details**
```rust
#[test]
fn test_get_member_details_uses_is_member() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarSaveContract);
    let client = StellarSaveContractClient::new(&env, &contract_id);
    
    let group_id = 1;
    let creator = Address::generate(&env);
    let non_member = Address::generate(&env);
    
    // Create group
    env.mock_all_auths();
    client.create_group(&creator, &100, &3600, &5);
    
    // Try to get member details for non-member
    let result = client.try_get_member_details(&group_id, &non_member);
    
    // Should return NotMember error
    match result {
        Err(Error::Contract(code)) => {
            assert_eq!(code, 2002); // NotMember error code
        }
        _ => panic!("Expected NotMember error"),
    }
}
```

### Test Coverage Goals

- **Property tests**: 100+ iterations per property (2 properties = 200+ test cases)
- **Unit tests**: 6 specific test cases covering examples and edge cases
- **Integration tests**: Verify `is_member` usage in existing functions
- **Total coverage**: All acceptance criteria validated through tests

### Performance Testing

While not part of the automated test suite, the following performance characteristics should be manually verified:

1. **Gas efficiency**: Compare gas usage of `has()` vs `get()` for membership checks
2. **Constant time**: Verify O(1) complexity regardless of group size
3. **Concurrent access**: Verify read-only operations don't cause contention

## Implementation Notes

### Implementation Steps

1. Add the `is_member` function to `StellarSaveContract` implementation
2. Update `get_member_details` to use `is_member` for validation
3. Implement property-based tests with 100+ iterations
4. Implement unit tests for edge cases and examples
5. Verify integration with existing member-only functions
6. Document the function in contract API documentation

### Code Location

- **Function implementation**: `contracts/stellar-save/src/lib.rs` (in `StellarSaveContract` impl block)
- **Tests**: `contracts/stellar-save/src/lib.rs` (in `tests` module)
- **Storage keys**: Already exists in `contracts/stellar-save/src/storage.rs`

### Dependencies

- Existing `StorageKeyBuilder.member_profile()` method
- Existing `MemberProfile` struct
- Soroban SDK persistent storage API
- Existing error types (for integration with member-only functions)

### Migration Considerations

This is a new function with no breaking changes:
- No existing storage migration required
- No changes to existing function signatures
- Backward compatible with all existing contract operations
- Can be deployed as a contract upgrade without data migration
