# Storage Key Encoding

Issue #1517. Records the storage-key layout before and after flattening
`StorageKey`, and the footprint that change removes.

## The problem

Keys were a two-level enum:

```rust
StorageKey::Group(GroupKey::Data(group_id))
StorageKey::Contribution(ContributionKey::Individual(group_id, cycle, address))
```

A `#[contracttype]` enum with payload is encoded by the host as an `ScVec` whose
first element is an `ScSymbol` discriminant and whose remaining elements are the
payload. Nesting one inside another therefore produces a vector containing a
symbol and *another vector*, which itself contains a symbol and the payload:

```
Vec[ Symbol("Group"), Vec[ Symbol("Data"), U64(id) ] ]
```

Every key the contract touched carried two discriminant symbols, two vectors and
one level of indirection. The outer symbol was pure overhead: it told the host
nothing the inner symbol did not already imply, since no two inner variant names
were shared across categories.

Several discriminants were also long enough to leave the host's small-symbol
representation. Soroban packs a `Symbol` of **nine characters or fewer** into an
immediate 64-bit value; anything longer is allocated as a separate host object
with its own reference. `Contribution`, `PayoutPositionIndex`,
`AmountChangeVoteCount`, `TotalContributions`, `LastGroupCreation` and thirteen
others all crossed that line, so those keys allocated symbol objects on every
single access.

## The change

One flat enum, 54 variants, every name nine characters or shorter:

```rust
StorageKey::Grp(group_id)
StorageKey::Contrib(group_id, cycle, address)
```

```
Vec[ Symbol("Grp"), U64(id) ]
```

Construction still goes exclusively through `StorageKeyBuilder`, whose function
signatures are unchanged, so no call site outside `storage.rs` names a variant.
The only edits elsewhere were four modules that pattern-matched the enum
directly: `migrations/v1_to_v2.rs`, `migration_tests.rs`,
`migration_matrix_tests.rs` and `upgrade_tests.rs`.

## Footprint

Counting the host-side elements that make up one key. "Objects" counts values
that cannot be held as an immediate: each vector, plus each symbol longer than
nine characters.

| Key | Before | After | Vectors saved | Symbol objects saved |
|---|---|---|---|---|
| `group_data(id)` | `Vec[Sym"Group", Vec[Sym"Data", u64]]` | `Vec[Sym"Grp", u64]` | 1 of 2 | 0 |
| `group_token_config(id)` | `Vec[Sym"Group", Vec[Sym"TokenConfig", u64]]` | `Vec[Sym"GrpTok", u64]` | 1 of 2 | 1 |
| `contribution_individual(id, c, addr)` | `Vec[Sym"Contribution", Vec[Sym"Individual", u64, u32, Address]]` | `Vec[Sym"Contrib", u64, u32, Address]` | 1 of 2 | 2 |
| `member_total_contributions(id, addr)` | `Vec[Sym"Member", Vec[Sym"TotalContributions", u64, Address]]` | `Vec[Sym"MbrTotC", u64, Address]` | 1 of 2 | 1 |
| `group_payout_position_index(id, pos)` | `Vec[Sym"Group", Vec[Sym"PayoutPositionIndex", u64, u32]]` | `Vec[Sym"GrpPosIx", u64, u32]` | 1 of 2 | 1 |
| `next_group_id()` | `Vec[Sym"Counter", Sym"NextGroupId"]` | `Sym"CntNextG"` | 1 of 1 | 1 |
| `contract_config()` | `Vec[Sym"Counter", Sym"ContractConfig"]` | `Sym"Config"` | 1 of 1 | 1 |
| `reentrancy_guard()` | `Vec[Sym"Counter", Sym"ReentrancyGuard"]` | `Sym"Guard"` | 1 of 1 | 1 |

Across all 54 variants:

| Measure | Before | After |
|---|---|---|
| Discriminant symbols per key | 2 | 1 |
| Vectors per key (payload variants) | 2 | 1 |
| Vectors per key (unit variants) | 1 | 0 |
| Names exceeding the 9-char small-symbol threshold | 18 | 0 |
| Unit variants encoding as a bare immediate | 0 | 9 |

Every key in the contract loses one vector and one symbol. The nine global
singletons - `CntNextG`, `CntTotG`, `CntActG`, `CntTotM`, `CntVer`, `Config`,
`Guard`, `EmrgPause`, `StoreVer`, `AlwdToks` - lose their vector entirely and
encode as a single immediate value.

The saving scales with entry count, and the entry count is dominated by the
per-member-per-cycle keys. `estimated_overhead_per_member()` puts a member at
four entries per group and `estimated_overhead_per_cycle()` puts a cycle at
three; a 20-member group running 20 cycles therefore holds roughly
`20 x 4 + 20 x 3 + 11 = 151` entries, each one now a shorter key.

## Behaviour

Unchanged. Same builder signatures, same set of keys, same values, same
categories, same ordering semantics (`PartialOrd`/`Ord` still derive over the
enum, and `test_storage_key_ordering` still holds). `STORAGE_VERSION` stays at
`2` - see the constant's doc comment.

## Deployment note

This is an encoding change, not a data change: it alters how a key is written,
not what is stored under it. An instance already carrying data under the nested
encoding cannot read it back through the flat encoding. Deploying this over live
data needs a re-key migration (`migrate_v2_to_v3`) that reads each entry under
its old key and rewrites it under the new one, paired with a `STORAGE_VERSION`
bump. That migration is out of scope for this issue and is **not** included here.
`STORAGE_VERSION` was deliberately left at `2` so no instance is mislabelled as
migrated in the meantime.

## Tests

`storage.rs`:

| Test | Guards |
|---|---|
| `every_variant_name_fits_a_small_symbol` | No variant name crosses the 9-char threshold |
| `variant_names_are_unique` | Flattening did not merge two categories onto one name |
| `keys_from_different_categories_never_collide` | Category separation survives losing the outer discriminant |
| `unit_variants_carry_no_payload` | The nine singletons stay payload-free |
| `builders_are_the_only_construction_surface_needed` | Every builder round-trips its arguments |

The pre-existing suite (`test_group_key_builders`, `test_member_key_builders`,
`test_contribution_key_builders`, `test_payout_key_builders`,
`test_counter_key_builders`, `test_user_key_builders`, the uniqueness tests and
`test_storage_key_ordering`) was updated to the flat variants and otherwise
asserts exactly what it did before.
