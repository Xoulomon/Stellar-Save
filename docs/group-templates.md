# Group Templates

Stellar-Save ships with five predefined group templates that cover the most common ROSCA savings patterns. Instead of manually specifying cycle duration and member count, you pick a template and only supply the contribution amount.

## Available Templates

| ID | Name               | Cycle Duration | Max Members | Total Duration  |
|----|--------------------|---------------|-------------|-----------------|
| 1  | Weekly Saver       | 7 days        | 10          | ~10 weeks       |
| 2  | Biweekly Saver     | 14 days       | 8           | ~16 weeks       |
| 3  | Monthly Pool       | 30 days       | 12          | ~12 months      |
| 4  | Quarterly Circle   | 90 days       | 4           | ~12 months      |
| 5  | Annual Pool        | 365 days      | 5           | ~5 years        |

## API

### `list_templates(env) -> Vec<GroupTemplate>`

Returns all available templates. Use this to display template options to users before group creation.

```rust
let templates = list_templates(&env);
for t in templates.iter() {
    // t.id, t.name, t.cycle_duration, t.max_members, t.description
}
```

### `get_template(env, template_id) -> ContractResult<GroupTemplate>`

Fetches a single template by ID. Returns `StellarSaveError::TemplateNotFound` (code 5001) if the ID is invalid.

```rust
let template = get_template(&env, 3)?; // Quarterly Circle
```

### `create_group_from_template(env, template_id, group_id, creator, contribution_amount, created_at) -> ContractResult<Group>`

Creates a `Group` using the template's `cycle_duration` and `max_members`. You only need to provide:

- `template_id` — one of the IDs from the table above
- `group_id` — unique sequential ID for the new group
- `creator` — `Address` of the group creator
- `contribution_amount` — amount in stroops each member pays per cycle (1 XLM = 10,000,000 stroops)
- `created_at` — Unix timestamp in seconds

```rust
// Create a Monthly Pool where each member contributes 10 XLM
let group = create_group_from_template(
    &env,
    TEMPLATE_MONTHLY_POOL, // 3
    next_group_id,
    creator_address,
    100_000_000, // 10 XLM in stroops
    env.ledger().timestamp(),
)?;
```

## Error Handling

| Error                          | Code | Cause                                      |
|-------------------------------|------|--------------------------------------------|
| `StellarSaveError::TemplateNotFound` | 5001 | `template_id` does not match any template |
| `StellarSaveError::InvalidAmount`    | 3001 | `contribution_amount` is zero or negative  |

## Choosing a Template

- **Weekly Saver** — best for tight-knit groups that want frequent payouts and short commitment windows.
- **Biweekly Saver** — a middle ground; slightly larger pools with a manageable cadence.
- **Monthly Pool** — the most common Ajo/Esusu pattern; 12 members each receive one month's pool per year.
- **Quarterly Circle** — suitable for larger contribution amounts where members prefer less frequent cycles.
- **Annual Pool** — long-term savings commitment; ideal for capital accumulation over multiple years.

## Custom Groups

If none of the templates fit your needs, use `Group::new()` directly to specify any `cycle_duration` and `max_members` values:

```rust
let group = Group::new(
    group_id,
    creator,
    contribution_amount,
    custom_cycle_duration, // seconds
    custom_max_members,
    created_at,
);
```
