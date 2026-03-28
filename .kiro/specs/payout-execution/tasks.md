# Implementation Plan: Payout Execution

## Overview

This implementation plan breaks down the payout execution feature into discrete coding tasks. The feature implements the core fund distribution mechanism for the Stellar-Save ROSCA smart contract, orchestrating automated transfer of pooled funds to eligible recipients when a savings cycle completes.

The implementation follows a layered approach:
1. Core validation and helper functions
2. Payout execution orchestration
3. Integration with existing modules
4. Property-based testing for correctness guarantees

## Tasks

- [x] 1. Set up payout executor module structure
  - Create `src/payout_executor.rs` module file
  - Define module imports for dependencies (PoolCalculator, StorageKeyBuilder, EventEmitter, Group, PayoutRecord, MemberProfile, StellarSaveError)
  - Add module declaration to `src/lib.rs`
  - _Requirements: 11.1, 11.2, 11.3, 11.7_

- [x] 2. Implement cycle completion validation
  - [x] 2.1 Implement `validate_cycle_complete` helper function
    - Call PoolCalculator::get_pool_info to retrieve cycle data
    - Call PoolCalculator::validate_pool_ready_for_payout to verify completion
    - Return PoolInfo on success or CycleNotComplete error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 2.2 Write property test for cycle completion validation
    - **Property 1: Cycle Completion Validation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
    - Generate random groups with complete and incomplete cycles
    - Verify payout only proceeds when all members contributed and totals match

- [x] 3. Implement recipient identification and verification
  - [x] 3.1 Implement `identify_recipient` helper function
    - Iterate through group members to find member with payout_position matching current_cycle
    - Verify exactly one member has the matching position
    - Return recipient address or InvalidState error
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 3.2 Implement `verify_recipient_eligibility` helper function
    - Check recipient is current member of group
    - Verify recipient has not already received payout (check payout_recipient storage)
    - Return Ok(()) or appropriate error (NotMember, InvalidRecipient)
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 3.3 Write property test for recipient identification
    - **Property 2: Correct Recipient Identification**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - Generate random groups with various payout position configurations
    - Verify correct recipient identified for each cycle and eligibility checks work

- [x] 4. Implement payout amount calculation and balance verification
  - [x] 4.1 Implement payout amount calculation logic
    - Use PoolCalculator::calculate_payout_amount to get net payout (pool - fees)
    - Verify calculated amount is greater than zero
    - Return InvalidAmount error if amount is invalid
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 4.2 Implement contract balance verification
    - Get contract address and query current balance
    - Verify balance >= payout_amount before transfer
    - Return PayoutFailed error if insufficient balance
    - _Requirements: 3.5, 4.4_
  
  - [ ]* 4.3 Write property tests for amount calculation
    - **Property 3: Payout Amount Calculation**
    - **Validates: Requirements 3.2, 3.4**
    - Generate random pool amounts and fee configurations
    - Verify net payout equals pool - fees and rejects invalid amounts
    - **Property 4: Sufficient Balance Verification**
    - **Validates: Requirements 3.5**
    - Generate random contract balances and payout amounts
    - Verify execution only proceeds when balance is sufficient

- [x] 5. Checkpoint - Ensure helper functions compile and basic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement fund transfer execution
  - [x] 6.1 Implement `execute_transfer` helper function
    - Get contract address using env.current_contract_address()
    - Execute transfer from contract to recipient using Stellar token API
    - Handle transfer errors and return PayoutFailed on failure
    - Use checked arithmetic to prevent overflow
    - _Requirements: 4.1, 4.2, 4.3, 10.3, 10.4_
  
  - [ ]* 6.2 Write property test for successful transfer balance updates
    - **Property 5: Successful Transfer Updates Balance**
    - **Validates: Requirements 4.1**
    - Generate random payout amounts
    - Verify recipient balance increases and contract balance decreases by exact amount

- [x] 7. Implement payout record creation and storage
  - [x] 7.1 Implement `record_payout` helper function
    - Create PayoutRecord struct with all required fields (recipient, group_id, cycle, amount, timestamp)
    - Store record using StorageKeyBuilder::payout_record(group_id, cycle)
    - Store recipient address using StorageKeyBuilder::payout_recipient(group_id, cycle)
    - Validate record before storage
    - Return InternalError on storage failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 7.2 Write property test for payout record completeness
    - **Property 7: Payout Record Completeness and Consistency**
    - **Validates: Requirements 5.1, 5.3, 5.4**
    - Generate random payout executions
    - Verify records are created with all fields and retrievable via both storage keys

- [x] 8. Implement member status update
  - [x] 8.1 Implement `update_member_status` helper function
    - Load MemberProfile for recipient
    - Ensure consistency between payout_recipient storage and member queries
    - Handle storage errors and return InternalError on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 8.2 Write property test for member status update
    - **Property 8: Member Status Update After Payout**
    - **Validates: Requirements 6.1, 2.4**
    - Generate random groups and execute payouts
    - Verify recipient eligibility returns false after payout

- [x] 9. Implement event emission
  - [x] 9.1 Add event emission to payout flow
    - Call EventEmitter::emit_payout_executed with all required fields
    - Wrap event emission in error handling that continues on failure
    - Ensure events are emitted after storage operations complete
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 9.2 Write property tests for event emission
    - **Property 9: Payout Event Emission**
    - **Validates: Requirements 7.1, 7.2**
    - Verify PayoutExecuted event emitted with correct data
    - **Property 10: Event Emission Non-Critical**
    - **Validates: Requirements 7.5**
    - Simulate event emission failure and verify payout still succeeds

- [x] 10. Implement cycle advancement and group completion
  - [x] 10.1 Implement `advance_cycle_or_complete` helper function
    - Call group.advance_cycle(&env) to increment cycle
    - Check if group.is_complete() returns true
    - Save updated group to storage
    - Return InternalError on failure
    - Note: Group.advance_cycle handles status updates and GroupCompleted event emission
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ]* 10.2 Write property tests for cycle advancement
    - **Property 11: Cycle Advancement**
    - **Validates: Requirements 8.1**
    - Verify cycle increments by exactly 1 after payout
    - **Property 12: Group Completion Detection**
    - **Validates: Requirements 8.2, 8.4**
    - Generate groups at final cycle and verify completion logic

- [x] 11. Checkpoint - Ensure all helper functions work together
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement main execute_payout function
  - [x] 12.1 Implement execute_payout orchestration function
    - Add function signature: `pub fn execute_payout(env: Env, group_id: u64) -> Result<(), StellarSaveError>`
    - Load group from storage using StorageKeyBuilder::group_data
    - Validate group exists (return GroupNotFound if not)
    - Validate group status is Active (return InvalidState if not)
    - Check if payout already executed for current cycle (return InvalidState if yes)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.6, 10.7_
  
  - [x] 12.2 Wire validation steps into execute_payout
    - Call validate_cycle_complete to verify cycle ready
    - Call identify_recipient to find payout recipient
    - Call verify_recipient_eligibility to check recipient is valid
    - Calculate payout amount and verify contract balance
    - _Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5_
  
  - [x] 12.3 Wire execution steps into execute_payout
    - Call execute_transfer to send funds to recipient
    - Call record_payout to create audit record
    - Call update_member_status to mark recipient as paid
    - Call event emission (non-critical, continue on failure)
    - Call advance_cycle_or_complete to progress group state
    - Return Ok(()) on success
    - _Requirements: 4.1-4.5, 5.1-5.5, 6.1-6.5, 7.1-7.5, 8.1-8.6_
  
  - [ ]* 12.4 Write unit tests for execute_payout happy path
    - Test successful payout for 3-member group at cycle 0
    - Test successful payout for 5-member group at cycle 2
    - Test final payout that completes a group
    - _Requirements: All requirements_

- [x] 13. Implement error handling and atomicity
  - [x] 13.1 Add comprehensive error handling
    - Ensure all validation errors return immediately without state changes
    - Ensure execution errors trigger automatic rollback via Soroban
    - Use checked arithmetic operations throughout
    - Add overflow error handling for all calculations
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 13.2 Write property test for transaction atomicity
    - **Property 6: Transaction Atomicity**
    - **Validates: Requirements 4.2, 5.5, 6.4, 8.6, 10.1, 10.2, 10.5**
    - Generate random failure scenarios at various execution points
    - Verify state is unchanged after any failure
  
  - [ ]* 13.3 Write property test for overflow detection
    - **Property 16: Overflow Detection**
    - **Validates: Requirements 10.4**
    - Generate edge case values that could cause overflow
    - Verify Overflow error is returned

- [ ] 14. Implement authorization and access control tests
  - [ ]* 14.1 Write property test for permissionless execution
    - **Property 13: Permissionless Execution**
    - **Validates: Requirements 9.1, 9.2**
    - Generate random caller addresses
    - Verify any address can execute payout when conditions are met
  
  - [ ]* 14.2 Write unit tests for access control edge cases
    - Test payout execution by group creator
    - Test payout execution by recipient
    - Test payout execution by unrelated address
    - Test payout rejection when group status is not Active
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 15. Implement validation error tests
  - [ ]* 15.1 Write property test for active status requirement
    - **Property 14: Active Status Requirement**
    - **Validates: Requirements 9.4**
    - Generate groups with various statuses
    - Verify payout only succeeds for Active groups
  
  - [ ]* 15.2 Write property test for payout idempotency
    - **Property 15: Payout Idempotency**
    - **Validates: Requirements 9.5**
    - Execute payout twice for same cycle
    - Verify second attempt fails with appropriate error
  
  - [ ]* 15.3 Write property test for group existence validation
    - **Property 17: Group Existence Validation**
    - **Validates: Requirements 10.6, 10.7**
    - Generate random non-existent group IDs
    - Verify GroupNotFound error returned before any operations
  
  - [ ]* 15.4 Write unit tests for all error conditions
    - Test payout on non-existent group (GroupNotFound)
    - Test payout on Pending group (InvalidState)
    - Test payout on Completed group (InvalidState)
    - Test payout with incomplete cycle (CycleNotComplete)
    - Test payout with insufficient balance (PayoutFailed)
    - Test duplicate payout for same cycle (InvalidState)
    - Test payout with no matching recipient (InvalidState)
    - Test payout with multiple members at same position (InvalidState)
    - _Requirements: 1.3, 2.2, 3.4, 4.2, 9.4, 9.5, 10.6, 10.7_

- [ ] 16. Implement integration tests
  - [ ]* 16.1 Write integration tests for module dependencies
    - Test PoolCalculator integration (get_pool_info, validate_pool_ready_for_payout, calculate_payout_amount)
    - Test StorageKeyBuilder integration (all storage key types used)
    - Test EventEmitter integration (emit_payout_executed, emit_group_completed)
    - Test Group.advance_cycle integration
    - Test PayoutRecord creation and validation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  
  - [ ]* 16.2 Write edge case tests
    - Test payout with zero fees (v1 default)
    - Test payout for minimum group size (2 members)
    - Test payout for maximum group size
    - Test first payout in a group (cycle 0)
    - Test last payout in a group (cycle = max_members - 1)
    - _Requirements: 3.3, 8.2_

- [ ] 17. Final checkpoint - Ensure all tests pass and code is complete
  - Run all unit tests and verify they pass
  - Run all property tests with minimum 100 iterations
  - Verify test coverage meets goals (>90% line coverage, >85% branch coverage)
  - Ensure all requirements are covered by implementation
  - Ask the user if questions arise or if ready to proceed

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests should run with minimum 100 iterations to ensure correctness
- The implementation uses Rust and integrates with Soroban smart contract framework
- All helper functions should use checked arithmetic to prevent overflow
- Event emission failures should not cause transaction rollback
- The Group.advance_cycle method handles status updates and event emission automatically
