# Governance Process and Proposal Lifecycle

**Version:** 1.0  
**Last Updated:** 2026-06-28  
**Status:** Active

## Overview

Stellar-Save uses on-chain governance to manage protocol parameters, upgrades, and major decisions. This document explains how governance works, who can participate, and how proposals move from creation to execution.

## Key Concepts

### Governors

**Who are governors?**
- Initial governors: Project founders and core contributors
- Selection criteria: Technical expertise, community trust, stake in protocol success
- Current governor set: Stored on-chain in the governance contract

**Governor responsibilities:**
- Vote on proposals
- Review code changes for security
- Participate in emergency response
- Represent community interests

**How the governor set changes:**
- **Adding governors:** Requires 75% approval from existing governors
- **Removing governors:** Requires 75% approval (excluding the governor being removed)
- **Minimum governors:** 3 (to ensure decentralization)
- **Maximum governors:** 11 (to maintain efficiency)

### Proposals

**What can be proposed?**
- Contract parameter changes (contribution limits, cycle durations)
- Contract upgrades (bug fixes, new features)
- Emergency pause/unpause of the protocol
- Treasury fund allocation
- Governor set changes

**Who can create proposals?**
- Any current governor
- Community members with sufficient stake (future feature)

## Proposal Lifecycle

### 1. Creation

A governor creates a proposal with:
- **Title:** Brief description (max 100 characters)
- **Description:** Detailed explanation with rationale
- **Action:** Specific on-chain operation to execute
- **Execution Data:** Encoded function call and parameters

**Example: Change Maximum Members**

```rust
// Proposal to increase max_members from 20 to 50
Proposal {
  title: "Increase maximum group size to 50",
  description: "Allow larger savings groups to accommodate community demand...",
  action: ProposalAction::UpdateConfig,
  data: encode_config_update({
    param: "max_members",
    new_value: 50
  })
}
```

**CLI Example:**
```bash
stellar contract invoke \
  --id GOVERNANCE_CONTRACT_ID \
  --network mainnet \
  -- create_proposal \
  --proposer GOVERNOR_ADDRESS \
  --title "Increase maximum group size to 50" \
  --description "$(cat proposal-description.md)" \
  --action UpdateConfig \
  --data "$(cat encoded-data.bin | base64)"
```

### 2. Voting Period

**Duration:** 7 days (604,800 seconds)

**Voting options:**
- **Yes:** Support the proposal
- **No:** Oppose the proposal
- **Abstain:** Counted for quorum, not for approval

**Vote weight:**
- One vote per governor (equal weight)
- Future: Weighted by stake amount

**Voting on-chain:**
```bash
stellar contract invoke \
  --id GOVERNANCE_CONTRACT_ID \
  --network mainnet \
  -- vote \
  --proposal_id 1 \
  --voter GOVERNOR_ADDRESS \
  --vote Yes
```

**Voting via frontend:**
1. Navigate to Governance page
2. Click on active proposal
3. Review details and discussion
4. Click "Vote Yes" / "Vote No" / "Abstain"
5. Sign transaction in wallet

### 3. Quorum Check

**Quorum requirement:** 51% of governors must vote (any option)

**Example:**
- Total governors: 7
- Quorum threshold: 4 governors (7 * 0.51 = 3.57, rounded up to 4)
- Votes cast: 5 (Yes: 3, No: 1, Abstain: 1)
- Quorum met: ✅ (5 ≥ 4)

**If quorum not met:**
- Proposal fails automatically after voting period
- Can be re-submitted with modifications

### 4. Approval Check

**Approval requirement:** 66% of voting governors (excluding abstentions)

**Example:**
- Yes votes: 4
- No votes: 2
- Abstain: 1 (not counted)
- Approval: 4 / (4 + 2) = 66.67% ✅

**If approval not met:**
- Proposal rejected
- Cannot be executed
- Can be re-submitted with changes

### 5. Timelock

**Purpose:** Allow community review and emergency response before execution

**Timelock duration:** 48 hours (172,800 seconds)

**What happens during timelock:**
- Proposal cannot be executed
- Community can review the code changes
- Emergency pause available if security issue found
- Governors can prepare execution environment

**Emergency cancellation:**
- Requires 75% governor approval
- Only during timelock period
- Used for critical security issues

**Example timeline:**
```
Day 0:   Proposal created
Day 7:   Voting ends (quorum: ✅, approval: ✅)
Day 7:   Timelock begins
Day 9:   Timelock ends, proposal executable
Day 16:  Execution window closes (7 days after timelock)
```

### 6. Execution

**Who can execute:**
- Any governor
- Automated keeper bot (future feature)

**Execution window:** 7 days after timelock expires

**Execution on-chain:**
```bash
stellar contract invoke \
  --id GOVERNANCE_CONTRACT_ID \
  --network mainnet \
  -- execute_proposal \
  --proposal_id 1 \
  --executor GOVERNOR_ADDRESS
```

**What happens on execution:**
- Encoded data is decoded
- Target contract function is called
- State changes are applied
- Execution event is emitted

**If not executed within window:**
- Proposal expires
- Must be re-created and re-voted

## Proposal Types

### 1. Parameter Changes

**Examples:**
- Change min/max contribution amounts
- Adjust min/max cycle durations
- Modify min/max member counts

**Encoded data structure:**
```rust
struct ParamChange {
  param_name: String,
  new_value: Value
}
```

**Impact:** Takes effect immediately on execution

**Rollback:** Requires new proposal to revert

### 2. Contract Upgrades

**Examples:**
- Bug fix releases
- New feature implementations
- Security patches

**Encoded data structure:**
```rust
struct ContractUpgrade {
  new_wasm_hash: BytesN<32>,
  migration_data: Option<Bytes>
}
```

**Safety measures:**
- WASM hash must match uploaded contract
- Audit report required for major upgrades
- Rollback plan documented in proposal

**Testing requirements:**
- Comprehensive test suite passes
- Testnet deployment and validation
- Security audit for critical changes

### 3. Emergency Actions

**Examples:**
- Pause all groups
- Unpause after incident resolution
- Emergency fund recovery

**Encoded data structure:**
```rust
enum EmergencyAction {
  PauseProtocol,
  UnpauseProtocol,
  RecoverFunds(Address)
}
```

**Reduced timelock:** 6 hours for emergency proposals

**Approval requirement:** 75% (higher than normal)

### 4. Governor Changes

**Examples:**
- Add new governor
- Remove inactive governor
- Replace compromised governor

**Encoded data structure:**
```rust
enum GovernorChange {
  Add(Address),
  Remove(Address),
  Replace { old: Address, new: Address }
}
```

**Special rules:**
- Governor being removed cannot vote
- Requires 75% approval
- Immediate effect (no timelock for removals)

## Worked Example: Parameter Change

**Scenario:** Increase maximum group size from 20 to 50 members

### Step 1: Create Proposal (Day 0)

Governor Alice creates the proposal:

```typescript
const proposalId = await governanceContract.create_proposal({
  proposer: aliceAddress,
  title: "Increase max_members to 50",
  description: `
    ## Rationale
    Current 20-member limit is too restrictive for larger communities.
    User feedback shows demand for 30-50 member groups.
    
    ## Impact
    - Allows larger savings circles
    - Increases protocol usage
    - No security concerns (tested on testnet)
    
    ## Testing
    - Testnet deployment: successful
    - Max tested: 75 members
    - Gas costs remain acceptable
  `,
  action: ProposalAction.UpdateConfig,
  data: encodeConfigUpdate({
    param: 'max_members',
    newValue: 50
  })
});

console.log('Proposal created:', proposalId);
```

**On-chain event:**
```json
{
  "type": "ProposalCreated",
  "proposalId": 1,
  "proposer": "GALICE...",
  "title": "Increase max_members to 50",
  "votingEnds": 1719590400
}
```

### Step 2: Voting (Days 0-7)

Governors cast their votes:

**Day 1 - Bob votes Yes:**
```bash
stellar contract invoke --id GOV_CONTRACT -- vote \
  --proposal_id 1 --voter GBOB... --vote Yes
```

**Day 3 - Carol votes Yes:**
```bash
stellar contract invoke --id GOV_CONTRACT -- vote \
  --proposal_id 1 --voter GCAROL... --vote Yes
```

**Day 5 - Dave votes No:**
```bash
stellar contract invoke --id GOV_CONTRACT -- vote \
  --proposal_id 1 --voter GDAVE... --vote No
```

**Day 7 - Eve votes Yes:**
```bash
stellar contract invoke --id GOV_CONTRACT -- vote \
  --proposal_id 1 --voter GEVE... --vote Yes
```

**Final tally:**
- Total governors: 7
- Voted: 5 (Alice, Bob, Carol, Dave, Eve)
- Yes: 4 (Alice, Bob, Carol, Eve)
- No: 1 (Dave)
- Abstain: 0
- Did not vote: 2

**Checks:**
- Quorum: 5/7 = 71% ✅ (need 51%)
- Approval: 4/5 = 80% ✅ (need 66%)

### Step 3: Timelock (Days 7-9)

Proposal enters 48-hour timelock:

**Day 7 event:**
```json
{
  "type": "ProposalQueued",
  "proposalId": 1,
  "executionEligible": 1719763200
}
```

**Community actions during timelock:**
- Review code changes on GitHub
- Test on testnet
- Raise concerns if any
- Prepare for execution

**No issues found → timelock expires on Day 9**

### Step 4: Execution (Day 9)

Governor Alice executes the proposal:

```bash
stellar contract invoke --id GOV_CONTRACT \
  -- execute_proposal \
  --proposal_id 1 \
  --executor GALICE...
```

**On-chain execution:**
1. Governance contract calls StellarSave contract
2. `update_config` function is invoked
3. `max_members` is set to 50
4. Configuration stored on-chain

**Execution event:**
```json
{
  "type": "ProposalExecuted",
  "proposalId": 1,
  "executor": "GALICE...",
  "result": "success"
}
```

**Verification:**
```bash
stellar contract invoke --id STELLARSAVE_CONTRACT \
  -- get_config

# Output shows max_members: 50 ✅
```

### Step 5: Effect

**Immediate impact:**
- All new groups can have up to 50 members
- Existing groups unchanged (grandfathered)
- Frontend UI updated to allow 50 max

**Monitoring:**
- Track group creation with new limits
- Monitor gas costs for large groups
- Gather user feedback

**Follow-up (if needed):**
- Adjust further if 50 still too limiting
- Revert if issues arise

## Security Considerations

### Proposal Validation

**Automatic checks:**
- Proposer is a valid governor
- Encoded data is well-formed
- Action type matches data structure
- No duplicate active proposals

**Manual review:**
- Code changes audited by governors
- Security implications discussed
- Community concerns addressed

### Timelock Rationale

**Why 48 hours?**
- Sufficient time for review
- Not so long that urgent fixes are delayed
- Balances security with agility

**Emergency override:**
- Critical security issues can be fast-tracked
- Requires 75% approval
- Fully transparent on-chain

### Execution Safety

**Who can execute?**
- Only governors (initially)
- Future: Permissionless execution after timelock

**What if execution fails?**
- Proposal remains executable
- Can be re-attempted
- Debug logs available

**Reentrancy protection:**
- Proposal marked as executed before calling target
- Cannot be executed twice

## Monitoring and Transparency

### On-Chain Events

All governance actions emit events:

```rust
pub enum GovernanceEvent {
  ProposalCreated { id, proposer, title },
  VoteCast { proposal_id, voter, vote },
  ProposalQueued { id, execution_eligible },
  ProposalExecuted { id, executor, result },
  ProposalCancelled { id, reason },
  GovernorAdded { address },
  GovernorRemoved { address },
}
```

### Off-Chain Monitoring

**Frontend dashboard:**
- Active proposals
- Voting status
- Historical proposals
- Governor activity

**Notifications:**
- Email alerts for new proposals
- Discord/Telegram bot announcements
- RSS feed for governance events

**Analytics:**
- Proposal success rate
- Average voting participation
- Time to execution
- Governor voting patterns

## Governance FAQ

### Q: Who can create proposals?
A: Currently only governors. Community proposals are planned for a future release.

### Q: What happens if no one executes an approved proposal?
A: It expires after 7 days. Any governor can execute during this window.

### Q: Can a proposal be cancelled after approval?
A: Yes, during the timelock period with 75% governor approval.

### Q: How often can the same parameter be changed?
A: No cooldown period, but frequent changes discourage community trust.

### Q: What if a malicious proposal passes?
A: Timelock allows detection. Emergency pause available. Governor reputation at stake.

### Q: Can I appeal a rejected proposal?
A: Re-submit with modifications addressing governor concerns.

### Q: How are governor keys secured?
A: Multi-sig hardware wallets recommended. Key rotation policy enforced.

### Q: What happens if a governor loses their key?
A: Governor set can vote to remove inactive governor and add replacement.

## References

- [Security Policy](../SECURITY.md)
- [Incident Response Plan](incident-response-plan.md)
- [Contract API Reference](contract-api-reference.md)
- [Threat Model](threat-model.md)

## Governance Contract Source

View the governance contract implementation:
- **Repository:** [contracts/governance](https://github.com/Xoulomon/Stellar-Save/tree/main/contracts/governance)
- **Audit Report:** [docs/security-audit-report.md](security-audit-report.md)
- **Testnet Deployment:** `CGOV...` (see [deployment.md](deployment.md))

## Changelog

### v1.0 (2026-06-28)
- Initial governance process documentation
- Defined proposal lifecycle
- Documented parameter change flow
- Established governor selection criteria
