# Spinner Component Documentation

## Overview

The Spinner component is a loading indicator used to display progress during asynchronous operations. It includes a standalone `Spinner` component for flexible placement and a `FullPageLoader` component for full-screen loading states.

## Features

✅ **Multiple Size Variants** - sm, md (default), lg  
✅ **Color Variants** - primary, secondary, danger, success, white  
✅ **Loading Text** - Optional label to accompany the spinner  
✅ **Full-Page Overlay** - Ready-to-use full-screen loader  
✅ **Accessibility** - ARIA labels, semantic HTML, respects `prefers-reduced-motion`  
✅ **Dark Mode Support** - Automatically adapts to system theme

## Components

### Spinner

The base spinner component for flexible placement anywhere in your UI.

#### Basic Usage

```tsx
import { Spinner } from '@/components';

function MyComponent() {
  return <Spinner />;
}
```

#### With Label

```tsx
<Spinner label="Loading data..." />
```

#### Size Variants

```tsx
<Spinner size="sm" label="Small" />
<Spinner size="md" label="Medium (default)" />
<Spinner size="lg" label="Large" />
```

#### Color Variants

```tsx
<Spinner color="primary" label="Primary" />      {/* Blue (default) */}
<Spinner color="secondary" label="Secondary" />  {/* Dark */}
<Spinner color="danger" label="Danger" />        {/* Red */}
<Spinner color="success" label="Success" />      {/* Green */}
<Spinner color="white" label="White" />          {/* White - for dark backgrounds */}
```

#### API

```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';           // Default: 'md'
  color?: SpinnerColor;                 // Default: 'primary'
  label?: string;                       // Optional loading text
  ariaLabel?: string;                   // Accessibility label (Default: 'Loading')
}
```

### FullPageLoader

A full-screen overlay loader, perfect for page-level loading states.

#### Basic Usage

```tsx
import { FullPageLoader } from '@/components';
import { useState, useEffect } from 'react';

function MyPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data
    fetchData().finally(() => setLoading(false));
  }, []);

  return (
    <>
      <FullPageLoader loading={loading} message="Loading your data..." />
      {/* Page content */}
    </>
  );
}
```

#### API

```typescript
interface FullPageLoaderProps {
  loading: boolean;                                    // Whether to show the loader
  message?: string;                                    // Loading message (Default: 'Loading...')
  spinnerColor?: SpinnerColor;                         // Spinner color (Default: 'primary')
}
```

## Styling Customization

### CSS Classes

The component uses BEM methodology for CSS classes:

- `.spinner` - Base spinner element
- `.spinner-{size}` - Size variant (sm, md, lg)
- `.spinner-{color}` - Color variant (primary, secondary, danger, success, white)
- `.spinner-label` - Loading text element
- `.full-page-loader-overlay` - Full-page overlay
- `.full-page-loader-content` - Loader content container

### Override Styles

```css
/* Override spinner size */
.spinner-lg .spinner-track {
  width: 5rem;
  height: 5rem;
}

/* Override spinner animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

## Accessibility

### Built-in Features

- ✅ Semantic HTML with `role="status"` and `aria-label`
- ✅ `aria-live="polite"` for dynamic announcements
- ✅ `aria-hidden="true"` on decorative elements
- ✅ Respects `prefers-reduced-motion` for reduced animations
- ✅ Full keyboard accessible

### ARIA Best Practices

```tsx
// Custom aria-label
<Spinner ariaLabel="Processing payment..." />

// FullPageLoader with live region
<FullPageLoader loading={true} message="Fetching user data..." />
```

## Usage Examples

### Loading Button

```tsx
function SubmitButton() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitForm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button disabled={loading} onClick={handleSubmit}>
      {loading && <Spinner size="sm" />}
      {!loading && 'Submit'}
    </button>
  );
}
```

### Data Fetching

```tsx
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" label="Loading users..." />;
  return <div>{/* Render users */}</div>;
}
```

### Form Submission

```tsx
function LoginForm() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials) => {
    setLoading(true);
    try {
      await login(credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FullPageLoader loading={loading} message="Signing in..." />
      <form onSubmit={(e) => {
        e.preventDefault();
        handleLogin(formData);
      }}>
        {/* Form fields */}
      </form>
    </>
  );
}
```

## Browser Support

- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Mobile browsers

## Performance Considerations

- Uses CSS animations for smooth 60fps performance
- Minimal DOM footprint (single div)
- No dependencies beyond React
- Lightweight CSS (~2KB)

## Dark Mode

The component automatically adapts to the system color scheme:

```css
@media (prefers-color-scheme: dark) {
  .full-page-loader-content {
    background-color: rgba(26, 26, 26, 0.95);
    color: rgba(255, 255, 255, 0.87);
  }
}
```

## Testing Tips

### Unit Test Example

```typescript
import { render, screen } from '@testing-library/react';
import { Spinner } from '@/components';

describe('Spinner', () => {
  it('renders with loading label', () => {
    render(<Spinner label="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<Spinner ariaLabel="Processing" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Processing');
  });

  it('respects size variants', () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.querySelector('.spinner-lg')).toBeInTheDocument();
  });
});
```

## Migration Guide

If migrating from another spinner component:

- Replace custom spinners with `<Spinner />`
- Use `label` prop instead of separate text elements
- Use `FullPageLoader` for overlay loaders
- Customize via `size` and `color` props instead of custom CSS
