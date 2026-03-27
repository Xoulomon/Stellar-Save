# feat: Add useDebounce hook for debouncing rapidly changing values

## Description

This PR adds a comprehensive `useDebounce` hook for debouncing rapidly changing values with configurable delay, leading edge updates, and maximum wait time. This hook is essential for optimizing performance when dealing with rapidly changing values like search inputs, form validation, window resize events, or API calls.

## Features

✅ **Value Debouncing**: Delays updating the returned value until changes stop  
✅ **Configurable Delay**: Customize the debounce delay (default: 500ms)  
✅ **Leading Edge Updates**: Optional immediate update on first change  
✅ **Maximum Wait Time**: Force updates after a maximum time period  
✅ **Cancel Function**: Alternative hook with manual cancel capability  
✅ **TypeScript Support**: Fully typed with generics  
✅ **Performance Optimized**: Uses refs to avoid unnecessary re-renders  
✅ **Automatic Cleanup**: Clears timers on unmount  

## Files Added

- `frontend/src/hooks/useDebounce.ts` - Main hook implementation (242 lines)
- `frontend/src/hooks/useDebounce.README.md` - Comprehensive documentation (500+ lines)
- `frontend/src/hooks/index.ts` - Hooks barrel export
- `frontend/src/components/DebounceDemo.tsx` - Demo component (280 lines)
- `frontend/src/components/DebounceDemo.css` - Component styles (280 lines)

## Files Modified

- `frontend/src/components/index.ts` - Added DebounceDemo export
- `frontend/package.json` - Fixed JSON syntax error (merged duplicate entries)

## Usage Example

```tsx
import { useDebounce } from '../hooks/useDebounce';

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, { delay: 500 });

  useEffect(() => {
    if (debouncedSearchTerm) {
      // API call only happens 500ms after user stops typing
      searchAPI(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

## API Reference

### Hook Options

```typescript
interface UseDebounceOptions {
  delay?: number;        // Debounce delay in ms (default: 500)
  leading?: boolean;     // Update immediately on first change (default: false)
  maxWait?: number;      // Maximum time to wait before forcing update
}
```

### Main Hook

```typescript
function useDebounce<T>(value: T, options?: UseDebounceOptions): T
```

### With Cancel Function

```typescript
function useDebounceWithCancel<T>(
  value: T,
  options?: UseDebounceOptions
): { debouncedValue: T; cancel: () => void }
```

## Common Use Cases

### 1. Search Input
Reduce API calls by debouncing search queries:
```tsx
const debouncedQuery = useDebounce(query, { delay: 300 });
```

### 2. Form Validation
Avoid excessive validation checks:
```tsx
const debouncedEmail = useDebounce(email, { delay: 500 });
```

### 3. Window Resize Handler
Optimize resize event handling:
```tsx
const debouncedWidth = useDebounce(windowWidth, { delay: 200 });
```

### 4. Auto-save Feature
Auto-save with debounce and max wait:
```tsx
const debouncedContent = useDebounce(content, {
  delay: 1000,
  maxWait: 5000  // Save at least every 5 seconds
});
```

### 5. API Rate Limiting
Prevent excessive API calls:
```tsx
const debouncedCode = useDebounce(code, {
  delay: 500,
  leading: true,  // Show initial preview immediately
  maxWait: 2000   // Update at least every 2 seconds
});
```

## Demo Component

The `DebounceDemo` component provides an interactive demonstration of all hook features:

- **Basic Debounce**: Shows 500ms delay with API call counter
- **Custom Delay**: Demonstrates 1-second delay
- **Leading Edge**: Immediate update on first change
- **Max Wait**: Forces update after 2 seconds even with continuous typing
- **Cancel Functionality**: Manual cancellation of pending updates

## Implementation Details

### Performance Optimizations

- Uses `useRef` to track internal state without causing re-renders
- Uses `setTimeout(fn, 0)` to avoid synchronous setState in effects
- Automatic cleanup of all timers on unmount
- Minimal re-renders - only when debounced value actually changes

### Error Handling

The hook is designed to be error-free with:
- Proper TypeScript typing
- No ESLint warnings
- Clean timer management
- No memory leaks

### Browser Compatibility

Works in all modern browsers that support:
- React 18+
- ES6+ features
- setTimeout/clearTimeout

## Testing

- ✅ No TypeScript errors in hook implementation
- ✅ No ESLint errors or warnings
- ✅ Proper cleanup verified
- ✅ Demo component renders correctly
- ✅ All features demonstrated in demo

## Documentation

Comprehensive documentation is included in `useDebounce.README.md` with:
- Complete API reference
- Multiple usage examples for common scenarios
- Performance considerations
- Best practices and recommended delays
- Troubleshooting guide
- TypeScript examples
- Comparison with other solutions (e.g., Lodash debounce)

## Breaking Changes

None. This is a new feature addition.

## Migration Guide

Not applicable (new feature).

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex code
- [x] Documentation updated
- [x] No new warnings generated
- [x] TypeScript compilation successful
- [x] ESLint checks pass
- [x] Demo component created

## Performance Impact

**Positive Impact**:
- Reduces unnecessary re-renders
- Optimizes API calls
- Improves form validation performance
- Better handling of rapid user input

**No Negative Impact**:
- Minimal memory footprint
- No additional dependencies
- Clean timer management

## Recommended Delays

Based on use case:
- **Search inputs**: 300-500ms
- **Form validation**: 500-1000ms
- **Auto-save**: 1000-2000ms
- **Window resize**: 100-200ms
- **Scroll events**: 100-150ms

## Next Steps

After this PR is merged, the hook can be integrated into:
- Search bars across the application
- Form validation in CreateGroupForm
- Auto-save features in text editors
- Window resize handlers
- Any component with rapidly changing values

## Additional Notes

This PR also fixes a JSON syntax error in `package.json` where duplicate entries were causing build failures. The package.json has been cleaned up and merged properly.

---

**Branch**: `feature/useDebounce-hook`  
**Base**: `main`  
**Issue**: #331  
**Files Changed**: 7  
**Lines Added**: 1,300+  
**Lines Removed**: 30  

## Related Issues

Closes #331
