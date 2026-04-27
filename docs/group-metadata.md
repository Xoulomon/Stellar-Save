# Group Metadata Feature

## Overview

The Group Metadata feature allows group creators to add human-readable metadata to make groups more discoverable and understandable. This includes a name, description, and optional image URL.

## Features

### Metadata Fields

- **Name** (3-50 characters, required)
  - Human-readable identifier for the group
  - Used for discovery and identification
  - Must be between 3 and 50 characters

- **Description** (0-500 characters, optional)
  - Detailed explanation of the group's purpose and goals
  - Can be empty (0 characters)
  - Maximum 500 characters

- **Image URL** (optional)
  - URL to an image representing the group
  - Used for visual identification in the UI
  - No length restriction

## Smart Contract Changes

### Group Struct

Added three new fields to the `Group` struct:

```rust
pub struct Group {
    // ... existing fields ...
    pub name: String,
    pub description: String,
    pub image_url: String,
}
```

### New Function: `update_group_metadata`

Updates the metadata of an existing group.

**Signature:**
```rust
pub fn update_group_metadata(
    env: Env,
    group_id: u64,
    caller: Address,
    name: String,
    description: String,
    image_url: String,
) -> Result<(), StellarSaveError>
```

**Validation:**
- Caller must be the group creator
- Name must be 3-50 characters
- Description must be 0-500 characters
- Returns `InvalidMetadata` error if validation fails
- Returns `Unauthorized` if caller is not the creator
- Returns `GroupNotFound` if group doesn't exist

**Event:**
Emits `GroupMetadataUpdated` event on success containing:
- `group_id`: The group being updated
- `updated_by`: The address that updated the metadata
- `name`: New group name
- `description`: New group description
- `image_url`: New image URL
- `updated_at`: Timestamp of the update

### New Error Type

Added `InvalidMetadata` error (code 1004) for metadata validation failures.

## Frontend Changes

### Type Updates

Updated `PublicGroup` interface to include:
```typescript
interface PublicGroup {
  // ... existing fields ...
  imageUrl?: string;
}
```

### Component Updates

#### GroupCard Component
- Displays group image if provided
- Shows description with text truncation (2 lines max)
- Responsive image sizing (200px height)

#### CreateGroupForm Component
- Added image URL input field (optional)
- Updated description validation to allow 0-500 characters
- Displays metadata in review step

### Styling

Added CSS classes for metadata display:
- `.group-card-image`: Container for group image
- `.group-card-description`: Container for description text
- Image uses `object-fit: cover` for consistent sizing
- Description uses `-webkit-line-clamp` for text truncation

## Usage Examples

### Smart Contract

```rust
// Update group metadata
StellarSaveContract::update_group_metadata(
    env,
    group_id,
    creator_address,
    String::from_small_str("Community Savings"),
    String::from_small_str("A group dedicated to community savings"),
    String::from_small_str("https://example.com/image.png"),
)?;
```

### Frontend

```typescript
// Create group with metadata
const groupData: GroupData = {
  name: "Weekly Savings",
  description: "Save together every week",
  image_url: "https://example.com/savings.png",
  contribution_amount: 1_000_000, // stroops
  cycle_duration: 604800, // 1 week
  max_members: 10,
  min_members: 2,
};

await createGroup(groupData);
```

## Testing

### Contract Tests

Seven comprehensive tests verify metadata functionality:

1. **test_update_group_metadata_success** - Happy path
2. **test_update_group_metadata_name_too_short** - Name validation (min)
3. **test_update_group_metadata_name_too_long** - Name validation (max)
4. **test_update_group_metadata_description_too_long** - Description validation
5. **test_update_group_metadata_unauthorized** - Authorization check
6. **test_update_group_metadata_group_not_found** - Group existence check
7. **test_update_group_metadata_empty_description_valid** - Optional description

### Frontend Tests

Type validation tests ensure:
- Metadata fields are properly typed
- Optional fields work correctly
- Length constraints are enforced

## Backward Compatibility

- Metadata fields are initialized as empty strings for existing groups
- Metadata is optional - groups can function without it
- No breaking changes to existing group functionality

## Security Considerations

- Only group creators can update metadata
- Metadata is stored on-chain and is public
- No sensitive information should be stored in metadata
- Image URLs are not validated - clients should handle invalid URLs gracefully

## Future Enhancements

- Metadata update history/audit trail
- Metadata search and filtering
- Rich text descriptions
- Multiple images per group
- Metadata versioning
