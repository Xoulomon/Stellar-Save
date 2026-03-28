# SearchBar Component

A reusable search bar component with debouncing, search icon, clear button, and loading state.

## Features

- Search icon (magnifying glass)
- Clear button (X icon) - appears when input has value
- Debounced search callback
- Loading state with spinner
- Customizable placeholder
- Default value support
- Custom className support
- Fully accessible with ARIA labels

## Usage

```tsx
import { SearchBar } from './components';

function MyComponent() {
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (query: string) => {
    setIsSearching(true);
    // Perform search operation
    console.log('Searching for:', query);
    // After search completes
    setIsSearching(false);
  };

  return (
    <SearchBar
      placeholder="Search items..."
      onSearch={handleSearch}
      loading={isSearching}
      debounceMs={300}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | `"Search..."` | Placeholder text for the input |
| `onSearch` | `(value: string) => void` | Required | Callback function called with debounced search value |
| `debounceMs` | `number` | `300` | Debounce delay in milliseconds |
| `loading` | `boolean` | `false` | Shows loading spinner when true |
| `className` | `string` | `""` | Additional CSS classes |
| `defaultValue` | `string` | `""` | Initial value for the search input |

## Behavior

- The `onSearch` callback is debounced, meaning it will only be called after the user stops typing for the specified `debounceMs` duration
- The clear button only appears when there is text in the input and loading is false
- When loading is true, the loading spinner replaces the clear button
- The component uses `type="search"` for semantic HTML

## Accessibility

- Search input has `aria-label="Search"`
- Clear button has `aria-label="Clear search"`
- Loading spinner has `aria-label="Loading"`
- Search icon is marked with `aria-hidden="true"` as it's decorative

## Styling

The component uses CSS custom properties and follows the existing component styling patterns:
- Dark mode by default
- Light mode support via `@media (prefers-color-scheme: light)`
- Consistent with other form components (Input, Button)
- Focus states with outline
- Smooth transitions

## Testing

The component includes comprehensive tests covering:
- Rendering with default and custom props
- Debouncing behavior
- Clear button functionality
- Loading state
- Custom className application
- Default value support

Run tests with:
```bash
npm test -- SearchBar.test.tsx
```
