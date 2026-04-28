# useDebounce Hook

A comprehensive React hook for debouncing rapidly changing values with configurable delay, leading edge updates, and maximum wait time.

## Features

- ✅ **Value Debouncing**: Delays updating the returned value until changes stop
- ✅ **Configurable Delay**: Customize the debounce delay (default: 500ms)
- ✅ **Leading Edge Updates**: Optional immediate update on first change
- ✅ **Maximum Wait Time**: Force updates after a maximum time period
- ✅ **Cancel Function**: Alternative hook with manual cancel capability
- ✅ **TypeScript Support**: Fully typed with generics
- ✅ **Performance Optimized**: Uses refs to avoid unnecessary re-renders
- ✅ **Automatic Cleanup**: Clears timers on unmount

## Installation

The hook is already included in the project. No additional dependencies required.

## Basic Usage

### Simple Debounce

```tsx
import { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  useEffect(() => {
    // This will only run 500ms after the user stops typing
    if (debouncedSearchTerm) {
      console.log('Searching for:', debouncedSearchTerm);
      // Perform API call here
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Custom Delay

```tsx
import { useDebounce } from '../hooks/useDebounce';

function Component() {
  const [value, setValue] = useState('');
  
  // Debounce with 1 second delay
  const debouncedValue = useDebounce(value, { delay: 1000 });

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <p>Debounced: {debouncedValue}</p>
    </div>
  );
}
```

## Advanced Usage

### Leading Edge Update

Update immediately on the first change, then debounce subsequent changes:

```tsx
import { useDebounce } from '../hooks/useDebounce';

function Component() {
  const [value, setValue] = useState('');
  
  const debouncedValue = useDebounce(value, {
    delay: 500,
    leading: true  // Update immediately on first change
  });

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <p>Debounced: {debouncedValue}</p>
    </div>
  );
}
```

### Maximum Wait Time

Force an update after a maximum time period, even if changes continue:

```tsx
import { useDebounce } from '../hooks/useDebounce';

function Component() {
  const [value, setValue] = useState('');
  
  const debouncedValue = useDebounce(value, {
    delay: 500,
    maxWait: 2000  // Force update after 2 seconds max
  });

  // Even if the user types continuously, the value will update
  // at least every 2 seconds

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <p>Debounced: {debouncedValue}</p>
    </div>
  );
}
```

### With Cancel Function

Use the alternative hook when you need manual control over cancellation:

```tsx
import { useDebounceWithCancel } from '../hooks/useDebounce';

function Component() {
  const [value, setValue] = useState('');
  
  const { debouncedValue, cancel } = useDebounceWithCancel(value, {
    delay: 1000
  });

  const handleReset = () => {
    setValue('');
    cancel(); // Cancel any pending debounce
  };

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button onClick={handleReset}>Reset</button>
      <p>Debounced: {debouncedValue}</p>
    </div>
  );
}
```

## API Reference

### `useDebounce<T>(value: T, options?: UseDebounceOptions): T`

Main debounce hook that returns the debounced value.

#### Parameters

- **value** (`T`): The value to debounce
- **options** (`UseDebounceOptions`, optional): Configuration options

#### Options

```typescript
interface UseDebounceOptions {
  /**
   * The delay in milliseconds before the debounced value is updated
   * @default 500
   */
  delay?: number;

  /**
   * Whether to update the debounced value immediately on the first call
   * @default false
   */
  leading?: boolean;

  /**
   * Maximum time in milliseconds to wait before forcing an update
   * @default undefined (no maximum wait)
   */
  maxWait?: number;
}
```

#### Returns

- **T**: The debounced value

### `useDebounceWithCancel<T>(value: T, options?: UseDebounceOptions)`

Alternative hook that returns both the debounced value and a cancel function.

#### Returns

```typescript
{
  debouncedValue: T;  // The debounced value
  cancel: () => void; // Function to cancel pending debounce
}
```

## Common Use Cases

### 1. Search Input

Debounce search queries to reduce API calls:

```tsx
function SearchBar() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, { delay: 300 });

  useEffect(() => {
    if (debouncedQuery) {
      fetch(`/api/search?q=${debouncedQuery}`)
        .then(res => res.json())
        .then(data => console.log(data));
    }
  }, [debouncedQuery]);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### 2. Form Validation

Debounce validation to avoid excessive checks:

```tsx
function EmailInput() {
  const [email, setEmail] = useState('');
  const debouncedEmail = useDebounce(email, { delay: 500 });
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (debouncedEmail) {
      // Validate email format
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
      setIsValid(valid);
    }
  }, [debouncedEmail]);

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {email && !isValid && <span>Invalid email</span>}
    </div>
  );
}
```

### 3. Window Resize Handler

Debounce resize events for performance:

```tsx
function ResponsiveComponent() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const debouncedWidth = useDebounce(windowWidth, { delay: 200 });

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div>Window width: {debouncedWidth}px</div>;
}
```

### 4. Auto-save Feature

Auto-save with debounce and max wait:

```tsx
function Editor() {
  const [content, setContent] = useState('');
  const debouncedContent = useDebounce(content, {
    delay: 1000,
    maxWait: 5000  // Save at least every 5 seconds
  });

  useEffect(() => {
    if (debouncedContent) {
      // Save to backend
      fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({ content: debouncedContent })
      });
    }
  }, [debouncedContent]);

  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
    />
  );
}
```

### 5. API Rate Limiting

Prevent excessive API calls with debouncing:

```tsx
function LivePreview() {
  const [code, setCode] = useState('');
  const debouncedCode = useDebounce(code, {
    delay: 500,
    leading: true,  // Show initial preview immediately
    maxWait: 2000   // Update at least every 2 seconds
  });

  useEffect(() => {
    // Compile and preview code
    compileCode(debouncedCode);
  }, [debouncedCode]);

  return (
    <textarea
      value={code}
      onChange={(e) => setCode(e.target.value)}
    />
  );
}
```

## Performance Considerations

### Memory Usage

The hook uses refs to track internal state, which avoids unnecessary re-renders and keeps memory usage minimal.

### Timer Management

All timers are automatically cleaned up when:
- The component unmounts
- The value changes before the delay expires
- The cancel function is called (when using `useDebounceWithCancel`)

### Re-render Optimization

The hook only triggers a re-render when the debounced value actually changes, not on every input change.

## Best Practices

### 1. Choose Appropriate Delays

- **Search inputs**: 300-500ms
- **Form validation**: 500-1000ms
- **Auto-save**: 1000-2000ms
- **Window resize**: 100-200ms

### 2. Use Leading Edge for Immediate Feedback

```tsx
// Good for user interactions that need immediate response
const debouncedValue = useDebounce(value, {
  delay: 500,
  leading: true
});
```

### 3. Set Maximum Wait for Critical Updates

```tsx
// Ensure updates happen even with continuous changes
const debouncedValue = useDebounce(value, {
  delay: 1000,
  maxWait: 3000
});
```

### 4. Cancel on Unmount for Cleanup

```tsx
const { debouncedValue, cancel } = useDebounceWithCancel(value);

useEffect(() => {
  return () => cancel(); // Clean up on unmount
}, [cancel]);
```

## TypeScript Support

The hook is fully typed and works with any value type:

```tsx
// String
const debouncedString = useDebounce<string>('hello');

// Number
const debouncedNumber = useDebounce<number>(42);

// Object
interface User {
  name: string;
  email: string;
}
const debouncedUser = useDebounce<User>({ name: 'John', email: 'john@example.com' });

// Array
const debouncedArray = useDebounce<string[]>(['a', 'b', 'c']);
```

## Troubleshooting

### Value Not Updating

**Problem**: The debounced value doesn't update.

**Solution**: Ensure the delay hasn't been set too high, and check that the component isn't unmounting before the delay expires.

### Too Many Updates

**Problem**: The debounced value updates too frequently.

**Solution**: Increase the delay or add a `maxWait` option to limit update frequency.

### Memory Leaks

**Problem**: Timers not being cleaned up.

**Solution**: The hook automatically cleans up timers. If using `useDebounceWithCancel`, ensure you call `cancel()` in cleanup functions.

### Leading Edge Not Working

**Problem**: Leading edge update doesn't fire immediately.

**Solution**: Ensure `leading: true` is set in options and the value is actually changing.

## Comparison with Other Solutions

### vs. Lodash Debounce

```tsx
// Lodash (requires external dependency)
import debounce from 'lodash/debounce';
const debouncedFn = debounce(handleChange, 500);

// useDebounce (built-in, React-friendly)
const debouncedValue = useDebounce(value, { delay: 500 });
```

**Advantages of useDebounce**:
- No external dependencies
- React-friendly (works with state)
- Automatic cleanup
- TypeScript support out of the box
- Simpler API for value debouncing

## License

This hook is part of the Stellar-Save project.

## Contributing

Contributions are welcome! Please ensure:
- Code follows project style guidelines
- TypeScript types are properly defined
- Documentation is updated
- No ESLint errors

## Support

For issues or questions, please open an issue on the project repository.
