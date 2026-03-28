# Helper Function: format_group_id

## Overview
A helper function to format group IDs for display with a "GROUP-" prefix.

## Location
`contracts/stellar-save/src/helpers.rs`

## Function Signature
```rust
pub fn format_group_id(env: &Env, group_id: u64) -> String
```

## Parameters
- `env`: Soroban environment reference for string allocation
- `group_id`: The numeric group ID to format (u64)

## Returns
A Soroban `String` in the format `"GROUP-{id}"`

## Usage Example

```rust
use stellar_save::format_group_id;
use soroban_sdk::{Env, String};

// In your contract function
pub fn display_group(env: Env, group_id: u64) -> String {
    format_group_id(&env, group_id)
}

// Example outputs:
// format_group_id(&env, 1) -> "GROUP-1"
// format_group_id(&env, 42) -> "GROUP-42"
// format_group_id(&env, 12345) -> "GROUP-12345"
```

## Implementation Details
- Converts u64 to string representation without using std library
- Uses Soroban SDK's `Bytes` type for efficient byte manipulation
- Handles edge cases including zero and maximum u64 value
- No heap allocations beyond Soroban's managed environment

## Tests
Four comprehensive tests are included:
1. `test_format_group_id_single_digit` - Tests single digit (1)
2. `test_format_group_id_multi_digit` - Tests multi-digit number (12345)
3. `test_format_group_id_zero` - Tests zero edge case
4. `test_format_group_id_max_value` - Tests u64::MAX (18446744073709551615)

Run tests with:
```bash
cargo test format_group_id
```

## Integration
The function is exported from the main library:
```rust
pub use helpers::format_group_id;
```

You can import it directly:
```rust
use stellar_save::format_group_id;
```
