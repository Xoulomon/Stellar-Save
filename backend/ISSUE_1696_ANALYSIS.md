# Issue #1696 Analysis: Unused Audit Event Types

**Date**: 2026-09-26  
**Status**: Analysis Complete  
**Findings**: Significant unused code identified for cleanup

---

## Summary

The `audit_event_log.ts` file contains event type definitions and functions that are **not used anywhere** in the codebase. This analysis documents:
- Unused event types
- Unused functions
- Historical context
- Cleanup strategy

---

## Findings

### Unused Event Types

The `AuditAction` type defines these specific event types:

```typescript
export type AuditAction =
  | 'ambassador.created'    // ❌ UNUSED
  | 'ambassador.updated'    // ❌ UNUSED
  | 'ambassador.deleted'    // ❌ UNUSED
  | 'ambassador.status_changed'  // ❌ UNUSED
  | 'aml.flagged'           // ❌ UNUSED
  | 'aml.reviewed'          // ❌ UNUSED
  | 'aml.cleared'           // ❌ UNUSED
  | 'admin.action'          // ❌ UNUSED
  | string;                 // Fallback allows any string
```

**Verification**: Grep search across entire codebase found:
- ✅ No calls to `writeAuditEvent()` with these event types
- ✅ No string literals matching `'ambassador.'` pattern
- ✅ No string literals matching `'aml.'` pattern
- ✅ No string literals matching `'admin.action'`
- ✅ Only definition location: `audit_event_log.ts` lines 15-21

### Unused Functions

1. **`writeAuditEvent(event)`** - Exported async function
   - Definition: `audit_event_log.ts:74`
   - Usage: Zero calls anywhere in codebase
   - Validation: `assertComplianceFields()` only used internally here

2. **`writeAuditEventAsync(event)`** - Exported sync function (fire-and-forget)
   - Definition: `audit_event_log.ts:107`
   - Usage: Zero calls anywhere in codebase
   - Purpose: Never materialized

3. **`assertComplianceFields(event)`** - Internal validation
   - Definition: `audit_event_log.ts:54`
   - Usage: Only called by unused `writeAuditEvent()`
   - Dependent: No external dependency

4. **`generateAuditEventId()`** - Internal ID generator
   - Definition: `audit_event_log.ts:114`
   - Usage: Only called by unused `writeAuditEvent()`
   - Dependent: No external dependency

### Used Components

✅ **Actually used**:
- `AuditActorType` type - Not directly used, but kept for API completeness
- `AuditEventInput` interface - Not directly used, but defines expected shape
- `AuditEventRecord` interface - Not directly used, but defines record shape
- Type definitions themselves - Provide documentation of audit intent

✅ **Database table** exists:
- Table: `audit_event_log` (referenced in `writeAuditEvent()` but never called)
- Current status: Empty or not populated

---

## Why This Happened

### Historical Context

The audit event log appears to be:
1. **Planned but not implemented** - Infrastructure was built in anticipation
2. **Superseded** - Other logging mechanisms (e.g., `admin_service.logAction()`) evolved instead
3. **Unused patterns** - Ambassador and AML services don't emit audit events through this interface
4. **Type declarations only** - Code exists to document intent but nothing materializes it

### Evidence

- `admin_service.ts` uses `logAction()` method directly (not audit pipeline)
- Ambassador service mutations don't call `writeAuditEvent()`
- AML service mutations don't call `writeAuditEvent()`
- No integration tests for audit event logging
- No frontend/backend services depend on audit events

---

## Cleanup Strategy

### Phase 1: Safe Removal

Remove clearly unused components:
- ❌ Remove all specific event type literals from `AuditAction` type
- ❌ Remove `writeAuditEvent()` function
- ❌ Remove `writeAuditEventAsync()` function
- ❌ Remove `assertComplianceFields()` function
- ❌ Remove `generateAuditEventId()` function

### Phase 2: Backward Compatibility

Keep these for historical/documentation purposes:
- ✅ Keep `AuditEventInput` interface (type hints for future use)
- ✅ Keep `AuditEventRecord` interface (type hints for future use)
- ✅ Keep `AuditActorType` type (type hints for future use)
- ✅ Mark removed event types as reserved (comments document what was removed)

### Phase 3: Documentation

Add clear comments explaining:
- Why specific components were removed
- Historical event types (reserved for backward compatibility)
- Future adoption path for audit logging

---

## Impact Analysis

### Breaking Changes
- **None** - Nothing in codebase depends on removed functions/types

### Backward Compatibility
- **No code calls removed functions** - Safe to remove
- **Database table exists but unused** - Can safely clean up
- **Future migrations** - Can still use table if audit logging is re-implemented

### Affected Services
- ❌ `ambassador_service.ts` - Doesn't use audit functions
- ❌ `aml_service.ts` - Doesn't use audit functions
- ❌ `admin_service.ts` - Uses different logging mechanism
- ✅ No tests import from `audit_event_log.ts`

---

## Files to Modify

1. **`backend/src/services/audit_event_log.ts`**
   - Remove unused functions
   - Simplify `AuditAction` type
   - Add backward compatibility comments
   - Keep interface definitions

---

## Test Coverage

After cleanup, tests should verify:
- ✅ Types still exportable (for documentation)
- ✅ No breaking changes to type system
- ✅ Database schema still intact (if using migrations)
- ✅ No orphaned references in codebase

---

## Conclusion

This is a **safe cleanup** with:
- ✅ Zero impact on current code
- ✅ Zero breaking changes
- ✅ Improved code maintainability
- ✅ Clearer intent of what's actually used

Estimated effort: 30-45 minutes for implementation + testing
