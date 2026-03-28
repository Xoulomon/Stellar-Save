# Requirements Document: Payout Execution

## Introduction

This document specifies the requirements for the payout execution feature in the Stellar-Save smart contract system. The feature enables automated distribution of pooled funds to eligible recipients when a savings cycle completes. In a Rotational Savings and Credit Association (ROSCA), members contribute a fixed amount each cycle, and one member receives the total pool each cycle in a predetermined order. This feature implements the core payout logic that executes these distributions.

## Glossary

- **Payout_Executor**: The contract function responsible for executing payout distributions
- **Group**: A savings circle with multiple members who contribute and receive payouts
- **Cycle**: A time period during which all members must contribute before a payout occurs
- **Recipient**: The member designated to receive the payout for a specific cycle
- **Pool**: The total amount of funds accumulated from all member contributions in a cycle
- **Payout_Position**: A member's assigned turn order (0-indexed) determining when they receive payout
- **Payout_Record**: An immutable record of a completed payout transaction
- **Member_Status**: The current state of a member's participation (contributed, received payout, etc.)
- **Contract_Balance**: The total funds held by the contract for a specific group
- **Stroops**: The smallest unit of Stellar Lumens (XLM), where 1 XLM = 10^7 stroops

## Requirements

### Requirement 1: Cycle Completion Verification

**User Story:** As a contract, I want to verify that a cycle is complete before executing payout, so that funds are only distributed when all members have contributed.

#### Acceptance Criteria

1. WHEN payout execution is initiated, THE Payout_Executor SHALL verify that all members have contributed to the current cycle
2. WHEN payout execution is initiated, THE Payout_Executor SHALL verify that the total contributions equal the expected pool amount
3. IF the cycle is not complete, THEN THE Payout_Executor SHALL return a CycleNotComplete error
4. WHEN verifying cycle completion, THE Payout_Executor SHALL use the PoolCalculator to retrieve cycle contribution data
5. THE Payout_Executor SHALL verify that the contributor count equals the member count before proceeding

### Requirement 2: Recipient Identification

**User Story:** As a contract, I want to identify the correct recipient for the current cycle, so that payouts are distributed in the proper rotation order.

#### Acceptance Criteria

1. WHEN determining the payout recipient, THE Payout_Executor SHALL retrieve the member whose payout position matches the current cycle number
2. WHEN no member has a payout position matching the current cycle, THEN THE Payout_Executor SHALL return an InvalidState error
3. THE Payout_Executor SHALL verify that the identified recipient is a current member of the group
4. THE Payout_Executor SHALL verify that the recipient has not already received a payout in this group
5. WHEN multiple members have the same payout position, THEN THE Payout_Executor SHALL return an InvalidState error

### Requirement 3: Payout Amount Calculation

**User Story:** As a contract, I want to calculate the correct payout amount, so that recipients receive the full pool minus any applicable fees.

#### Acceptance Criteria

1. WHEN calculating payout amount, THE Payout_Executor SHALL use the PoolCalculator to determine the total pool amount
2. THE Payout_Executor SHALL calculate the net payout amount by subtracting fees from the total pool
3. WHERE fees are configured as zero, THE Payout_Executor SHALL set the payout amount equal to the total pool amount
4. WHEN the calculated payout amount is less than or equal to zero, THEN THE Payout_Executor SHALL return an InvalidAmount error
5. THE Payout_Executor SHALL verify that the contract balance is sufficient to cover the payout amount

### Requirement 4: Fund Transfer Execution

**User Story:** As a contract, I want to transfer funds to the recipient, so that members receive their payout when their turn arrives.

#### Acceptance Criteria

1. WHEN executing fund transfer, THE Payout_Executor SHALL transfer the calculated payout amount to the recipient address
2. WHEN the fund transfer fails, THEN THE Payout_Executor SHALL revert all state changes and return a TransferFailed error
3. THE Payout_Executor SHALL use the Stellar token transfer mechanism to move funds from the contract to the recipient
4. THE Payout_Executor SHALL verify the contract has sufficient balance before initiating the transfer
5. WHEN the transfer succeeds, THE Payout_Executor SHALL proceed to record the payout

### Requirement 5: Payout Record Creation

**User Story:** As a contract, I want to create an immutable payout record, so that all distributions are permanently tracked for audit purposes.

#### Acceptance Criteria

1. WHEN a payout is successfully executed, THE Payout_Executor SHALL create a Payout_Record with recipient, group ID, cycle number, amount, and timestamp
2. THE Payout_Executor SHALL store the Payout_Record in persistent storage using the payout_record storage key
3. THE Payout_Executor SHALL store the recipient address using the payout_recipient storage key for the current cycle
4. THE Payout_Executor SHALL ensure the Payout_Record validates successfully before storage
5. WHEN storage operations fail, THEN THE Payout_Executor SHALL revert the transaction and return an InternalError

### Requirement 6: Member Status Update

**User Story:** As a contract, I want to update member status after payout, so that the system tracks which members have received their distribution.

#### Acceptance Criteria

1. WHEN a payout is executed, THE Payout_Executor SHALL mark the recipient as having received their payout
2. THE Payout_Executor SHALL update the member's profile to reflect payout completion
3. THE Payout_Executor SHALL ensure that subsequent payout eligibility checks for this member return false
4. WHEN updating member status fails, THEN THE Payout_Executor SHALL revert the transaction and return an InternalError
5. THE Payout_Executor SHALL maintain consistency between payout records and member status

### Requirement 7: Payout Event Emission

**User Story:** As a frontend application, I want to receive payout execution events, so that I can notify users and update the UI in real-time.

#### Acceptance Criteria

1. WHEN a payout is successfully executed, THE Payout_Executor SHALL emit a PayoutExecuted event
2. THE PayoutExecuted event SHALL contain group ID, recipient address, payout amount, cycle number, and execution timestamp
3. THE Payout_Executor SHALL emit the event after all storage operations complete successfully
4. THE Payout_Executor SHALL use the EventEmitter utility to publish the PayoutExecuted event
5. WHEN event emission fails, THE Payout_Executor SHALL continue execution without reverting (events are non-critical)

### Requirement 8: Cycle Advancement

**User Story:** As a contract, I want to advance to the next cycle after payout, so that the group can continue with the next rotation.

#### Acceptance Criteria

1. WHEN a payout is successfully executed, THE Payout_Executor SHALL increment the group's current cycle number
2. WHEN the incremented cycle number equals the maximum number of members, THE Payout_Executor SHALL mark the group as completed
3. WHEN marking a group as completed, THE Payout_Executor SHALL set the group status to Completed
4. WHEN marking a group as completed, THE Payout_Executor SHALL emit a GroupCompleted event
5. THE Payout_Executor SHALL use the advance_cycle method on the Group struct to handle cycle progression
6. WHEN cycle advancement fails, THEN THE Payout_Executor SHALL revert the transaction and return an InternalError

### Requirement 9: Authorization and Access Control

**User Story:** As a contract, I want to control who can execute payouts, so that only authorized parties can trigger fund distributions.

#### Acceptance Criteria

1. THE Payout_Executor SHALL allow any address to call the execute_payout function (permissionless execution)
2. THE Payout_Executor SHALL verify all preconditions regardless of caller identity
3. THE Payout_Executor SHALL not require authentication from the recipient or group creator
4. THE Payout_Executor SHALL prevent execution if the group status is not Active
5. THE Payout_Executor SHALL prevent execution if a payout has already been executed for the current cycle

### Requirement 10: Error Handling and Transaction Safety

**User Story:** As a contract, I want to handle errors gracefully and maintain data consistency, so that the system remains in a valid state even when operations fail.

#### Acceptance Criteria

1. WHEN any validation check fails, THEN THE Payout_Executor SHALL return an appropriate error without modifying state
2. WHEN a fund transfer fails, THEN THE Payout_Executor SHALL revert all state changes made during the transaction
3. THE Payout_Executor SHALL use checked arithmetic operations to prevent overflow errors
4. WHEN an overflow occurs during calculations, THEN THE Payout_Executor SHALL return an Overflow error
5. THE Payout_Executor SHALL ensure atomicity: either all operations succeed or all operations are reverted
6. THE Payout_Executor SHALL validate the group exists before performing any operations
7. WHEN the group is not found, THEN THE Payout_Executor SHALL return a GroupNotFound error

### Requirement 11: Integration with Existing Systems

**User Story:** As a developer, I want the payout executor to integrate seamlessly with existing contract modules, so that the feature works cohesively with the rest of the system.

#### Acceptance Criteria

1. THE Payout_Executor SHALL use the PoolCalculator module to retrieve pool information and validate cycle completion
2. THE Payout_Executor SHALL use the StorageKeyBuilder module to generate all storage keys consistently
3. THE Payout_Executor SHALL use the EventEmitter module to publish all events
4. THE Payout_Executor SHALL use the Group struct's advance_cycle method for cycle progression
5. THE Payout_Executor SHALL use the PayoutRecord struct to create and validate payout records
6. THE Payout_Executor SHALL respect the GroupStatus enum and only execute payouts when status is Active
7. THE Payout_Executor SHALL use the existing error types defined in the StellarSaveError enum
